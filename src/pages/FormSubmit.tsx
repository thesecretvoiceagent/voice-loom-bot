import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; reg: string; phone: string }
  | { kind: "error"; message: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function FormSubmit() {
  const [params] = useSearchParams();
  const caseId = params.get("caseId") || "";
  const token = params.get("token") || "";

  const [regNo, setRegNo] = useState("");
  const [phone, setPhone] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  const paramsValid = useMemo(
    () => UUID_RE.test(caseId) && token.length > 0,
    [caseId, token],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submit.kind === "loading" || submit.kind === "success") return;

    const reg = regNo.trim();
    const ph = phone.trim();

    if (!reg) {
      setSubmit({ kind: "error", message: "Sisesta auto registreerimisnumber." });
      return;
    }
    if (!ph) {
      setSubmit({ kind: "error", message: "Sisesta tagasihelistamise number." });
      return;
    }

    if (token === "preview") {
      setSubmit({
        kind: "error",
        message: "See on eelvaate link. Päris saatmiseks on vaja allkirjastatud linki.",
      });
      return;
    }

    setSubmit({ kind: "loading" });

    try {
      const { data, error } = await supabase.functions.invoke("form-submit", {
        body: {
          caseId,
          token,
          reg_no: reg,
          callback_phone_number: ph,
        },
      });

      if (error) {
        setSubmit({ kind: "error", message: error.message || "Tundmatu viga" });
        return;
      }
      if (!data?.ok) {
        setSubmit({ kind: "error", message: data?.error || "Saatmine ebaõnnestus" });
        return;
      }

      setSubmit({
        kind: "success",
        reg: data.reg_no || reg,
        phone: data.callback_phone_number || ph,
      });
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

  const disabled = submit.kind === "loading" || submit.kind === "success";

  return (
    <div className="bg-background flex flex-col" style={{ minHeight: "100dvh" }}>
      <header className="px-5 pt-6 pb-3 space-y-2 shrink-0">
        <h1 className="text-2xl font-semibold text-foreground leading-tight">
          Sisesta oma andmed
        </h1>
        <p className="text-sm text-muted-foreground">
          AI assistent loeb need vestluses tagasi ja kasutab edaspidi.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex-1 px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4"
      >
        <div className="space-y-1.5">
          <label htmlFor="reg" className="text-sm font-medium text-foreground">
            Auto registreerimisnumber
          </label>
          <input
            id="reg"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={regNo}
            onChange={(e) => setRegNo(e.target.value.toUpperCase())}
            placeholder="nt 484DLC"
            maxLength={12}
            disabled={disabled}
            className="w-full h-12 px-3 rounded-md bg-muted border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary tracking-wider font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-sm font-medium text-foreground">
            Tagasihelistamise number
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="nt +372 5555 5555"
            maxLength={20}
            disabled={disabled}
            className="w-full h-12 px-3 rounded-md bg-muted border border-border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {token === "preview" && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            Eelvaate link näitab vormi, aga ei salvesta. Päris test vajab allkirjastatud linki.
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
            <div className="font-semibold">Andmed saadetud</div>
            <div className="text-sm opacity-90">
              Reg: <span className="font-mono">{submit.reg}</span>
              <br />
              Tel: <span className="font-mono">{submit.phone}</span>
            </div>
            <div className="text-xs opacity-75">
              AI assistent loeb need sulle vestluses tagasi.
            </div>
          </div>
        ) : (
          <button
            type="submit"
            disabled={disabled || !regNo.trim() || !phone.trim()}
            className="w-full h-14 rounded-lg bg-primary text-primary-foreground text-lg font-semibold shadow-md active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submit.kind === "loading" ? "Saadan…" : "Saada"}
          </button>
        )}
      </form>
    </div>
  );
}
