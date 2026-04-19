import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";

const markerIcon = new L.Icon({
  iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [32, 52],
  iconAnchor: [16, 52],
  popupAnchor: [0, -48],
  shadowSize: [41, 41],
});

const TALLINN: [number, number] = [59.437, 24.7536];

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; address: string }
  | { kind: "error"; message: string };

export default function LocationConfirm() {
  const [params] = useSearchParams();
  const caseId = params.get("caseId") || "";
  const token = params.get("token") || "";

  const [position, setPosition] = useState<[number, number] | null>(null);
  const [geoStatus, setGeoStatus] = useState("Küsime asukohta…");
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    let settled = false;

    const settle = (next: [number, number], status: string) => {
      if (settled) return;
      settled = true;
      setPosition(next);
      setGeoStatus(status);
    };

    const fallbackTimer = window.setTimeout(() => {
      settle(TALLINN, "Asukohta ei leitud — lohista nööpnõela õigesse kohta");
    }, 4000);

    if (!("geolocation" in navigator)) {
      settle(TALLINN, "Brauser ei toeta asukohta — lohista nööpnõela");
      return () => window.clearTimeout(fallbackTimer);
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          settle(
            [pos.coords.latitude, pos.coords.longitude],
            "Sinu asukoht — kinnita või lohista",
          );
        },
        () => settle(TALLINN, "Asukoht keelatud — lohista nööpnõela"),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
      );
    } catch {
      settle(TALLINN, "Asukoha viga — lohista nööpnõela");
    }

    return () => window.clearTimeout(fallbackTimer);
  }, []);

  useEffect(() => {
    if (!mapHostRef.current || !position || mapRef.current) return;

    const map = L.map(mapHostRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(position, 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(position, {
      draggable: true,
      icon: markerIcon,
    }).addTo(map);

    map.on("click", (event: L.LeafletMouseEvent) => {
      const next: [number, number] = [event.latlng.lat, event.latlng.lng];
      marker.setLatLng(next);
      setPosition(next);
    });

    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      setPosition([ll.lat, ll.lng]);
    });

    mapRef.current = map;
    markerRef.current = marker;

    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [position]);

  useEffect(() => {
    if (!position || !markerRef.current) return;
    markerRef.current.setLatLng(position);
  }, [position]);

  const requestGeoAgain = () => {
    if (!("geolocation" in navigator)) return;

    setGeoStatus("Küsime asukohta uuesti…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPosition(next);
        setGeoStatus("Sinu asukoht — kinnita või lohista");
        mapRef.current?.setView(next, Math.max(mapRef.current.getZoom(), 16));
      },
      () => setGeoStatus("Asukoht keelatud — luba see brauseri seadetes"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  const paramsValid = useMemo(() => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRe.test(caseId) && token.length > 0;
  }, [caseId, token]);

  const handleSubmit = async () => {
    if (!position || submit.kind === "loading" || submit.kind === "success") return;

    if (token === "preview") {
      setSubmit({
        kind: "error",
        message: "See on eelvaate link. Päris kinnitamiseks on vaja allkirjastatud linki.",
      });
      return;
    }

    setSubmit({ kind: "loading" });

    try {
      const { data, error } = await supabase.functions.invoke("location-confirm", {
        body: {
          caseId,
          token,
          lat: position[0],
          lng: position[1],
        },
      });

      if (error) {
        setSubmit({ kind: "error", message: error.message || "Tundmatu viga" });
        return;
      }

      if (!data?.ok) {
        setSubmit({ kind: "error", message: data?.error || "Asukoha kinnitamine ebaõnnestus" });
        return;
      }

      setSubmit({ kind: "success", address: data.address || "" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Võrgu viga";
      setSubmit({ kind: "error", message: msg });
    }
  };

  if (!paramsValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold text-foreground">Link on vigane</h1>
          <p className="text-muted-foreground">
            Avage palun SMS-ist saadud link uuesti. Kui see ei tööta, helistage tagasi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex flex-col" style={{ minHeight: "100dvh" }}>
      <header className="px-5 pt-6 pb-3 space-y-1 shrink-0">
        <h1 className="text-2xl font-semibold text-foreground leading-tight">
          Kinnita oma asukoht
        </h1>
        <p className="text-sm text-muted-foreground">{geoStatus}</p>
      </header>

      <div className="relative w-full bg-muted shrink-0" style={{ height: "55vh", minHeight: 320 }}>
        {position ? (
          <div ref={mapHostRef} className="absolute inset-0" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            Laeme kaarti…
          </div>
        )}
      </div>

      <div className="bg-card border-t border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground font-mono">
            {position ? `${position[0].toFixed(5)}, ${position[1].toFixed(5)}` : "—"}
          </p>
          <button
            type="button"
            onClick={requestGeoAgain}
            className="text-xs text-primary underline underline-offset-2"
          >
            Kasuta minu asukohta
          </button>
        </div>

        {token === "preview" && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            Eelvaate link näitab kaarti, aga ei salvesta. Päris test vajab allkirjastatud linki.
          </div>
        )}

        {submit.kind === "error" && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 text-sm"
          >
            {submit.message}
          </div>
        )}

        {submit.kind === "success" ? (
          <div
            role="status"
            className="rounded-md border border-success/40 bg-success/10 text-success px-4 py-3 space-y-1"
          >
            <div className="font-semibold">Asukoht kinnitatud</div>
            {submit.address && <div className="text-sm opacity-90">{submit.address}</div>}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!position || submit.kind === "loading"}
            className="w-full h-14 rounded-lg bg-primary text-primary-foreground text-lg font-semibold shadow-md active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submit.kind === "loading" ? "Kinnitan…" : "Kinnita asukoht"}
          </button>
        )}
      </div>
    </div>
  );
}
