import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";

// Default Leaflet marker icons don't load via bundlers — point them to CDN.
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

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationConfirm() {
  const [params] = useSearchParams();
  const caseId = params.get("caseId") || "";
  const token = params.get("token") || "";

  const [position, setPosition] = useState<[number, number] | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const markerRef = useRef<L.Marker | null>(null);

  // Initial geolocation. We use a hard wall-clock fallback because some
  // environments (e.g. iframes without `allow="geolocation"`, or browsers
  // that silently swallow the permission prompt) never fire either callback,
  // which would leave the user staring at "Laeme kaarti…" forever.
  useEffect(() => {
    let settled = false;
    const settle = (pos: [number, number]) => {
      if (settled) return;
      settled = true;
      setPosition(pos);
    };

    const fallbackTimer = window.setTimeout(() => settle(TALLINN), 4000);

    if (!("geolocation" in navigator)) {
      settle(TALLINN);
      return () => window.clearTimeout(fallbackTimer);
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => settle([pos.coords.latitude, pos.coords.longitude]),
        () => settle(TALLINN),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
      );
    } catch {
      settle(TALLINN);
    }

    return () => window.clearTimeout(fallbackTimer);
  }, []);

  const paramsValid = useMemo(() => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRe.test(caseId) && token.length > 0;
  }, [caseId, token]);

  const handleSubmit = async () => {
    if (!position || submit.kind === "loading" || submit.kind === "success") return;
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-5 pt-6 pb-4 space-y-2">
        <h1 className="text-2xl font-semibold text-foreground leading-tight">
          Kinnita oma asukoht
        </h1>
        <p className="text-sm text-muted-foreground">
          1. Kontrolli asukohta &nbsp;·&nbsp; 2. Vajuta kinnita
        </p>
      </header>

      {/* Map — explicit height (not flex) so Leaflet can compute its size on first paint */}
      <div
        className="relative w-full"
        style={{ height: "60vh", minHeight: 320 }}
      >
        {position ? (
          <MapContainer
            center={position}
            zoom={16}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onPick={(lat, lng) => setPosition([lat, lng])} />
            <Marker
              position={position}
              draggable
              icon={markerIcon}
              ref={(ref) => {
                markerRef.current = ref;
              }}
              eventHandlers={{
                dragend: () => {
                  const m = markerRef.current;
                  if (!m) return;
                  const ll = m.getLatLng();
                  setPosition([ll.lat, ll.lng]);
                },
              }}
            />
          </MapContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            Laeme kaarti…
          </div>
        )}
      </div>

      {/* Footer card */}
      <div className="bg-card border-t border-border px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 mt-auto">
        <p className="text-sm text-muted-foreground">
          Liigutage vajadusel nööpnõela ja vajutage kinnita.
        </p>
        <p className="text-xs text-muted-foreground">
          Kui kaart ei näita õiget kohta, liigutage nööpnõela.
        </p>

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
            className="rounded-md border border-success/40 bg-success/10 text-success-foreground px-4 py-3 space-y-1"
            style={{
              borderColor: "hsl(142 71% 45% / 0.4)",
              background: "hsl(142 71% 45% / 0.12)",
              color: "hsl(142 71% 35%)",
            }}
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
