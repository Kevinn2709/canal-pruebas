"use client";

/**
 * MonitorDominios.tsx — Lo que ve un fundador al iniciar sesión.
 *
 * Estado de los dominios configurados en Vercel (MONITOR_DOMAINS): respuesta
 * HTTP, certificado SSL (días que le quedan) y latencia. Lo mide la función
 * /api/monitor desde el servidor de Vercel, cada minuto mientras la pantalla
 * está a la vista.
 *
 * Si en "Filtrar dominio…" se escribe exactamente `root`, el campo se limpia
 * y se abre la consola del fundador (los chats).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { logoutHere } from "@/lib/logout";

export const MONITOR_TITLE = "Monitor de dominios";
const REFRESH_MS = 60_000;
const HISTORY = 20;
const SLOW_MS = 1500;
const SSL_WARN_DAYS = 14;

interface DomainResult {
  domain: string;
  http: { status: number | null; ms: number | null; error: string | null; finalUrl: string | null };
  ssl: { valid: boolean; daysLeft: number | null; validTo: string | null; issuer: string | null; error: string | null };
}

interface MonitorData {
  checkedAt: string;
  region: string | null;
  results: DomainResult[];
}

type Health = "ok" | "warn" | "down";

function healthOf(r: DomainResult): Health {
  const s = r.http.status;
  if (s === null || s >= 500 || !r.ssl.valid) return "down";
  if (s >= 400 || (r.ssl.daysLeft !== null && r.ssl.daysLeft < SSL_WARN_DAYS) || (r.http.ms ?? 0) > SLOW_MS) return "warn";
  return "ok";
}

const DOT: Record<Health, string> = { ok: "bg-emerald-400", warn: "bg-amber-400", down: "bg-red-500" };
const LABEL: Record<Health, string> = { ok: "Operativo", warn: "Revisar", down: "Caído" };

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function date(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function Bars({ values }: { values: (number | null)[] }) {
  const max = Math.max(300, ...values.map((v) => v ?? 0));
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-sm ${v === null ? "bg-red-500/70" : v > SLOW_MS ? "bg-amber-400/80" : "bg-emerald-400/70"}`}
          style={{ height: v === null ? "100%" : `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function MonitorDominios({ user, onRoot }: { user: User; onRoot: () => void }) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [history, setHistory] = useState<Record<string, (number | null)[]>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    document.title = MONITOR_TITLE;
  }, []);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/monitor", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 403 ? "Sin permiso para ver el monitor." : "No se pudo consultar el estado.");
      const d = (await res.json()) as MonitorData;
      setData(d);
      setError(null);
      setHistory((prev) => {
        const next: Record<string, (number | null)[]> = {};
        for (const r of d.results) next[r.domain] = [...(prev[r.domain] ?? []), r.http.ms].slice(-HISTORY);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar el estado.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [user]);

  // Cada minuto, solo con la pantalla a la vista.
  useEffect(() => {
    void check();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  const onFilter = (value: string) => {
    if (value === "root") {
      setQ("");
      inputRef.current?.blur();
      onRoot();
      return;
    }
    setQ(value);
  };

  const results = data?.results ?? [];
  const term = q.trim().toLowerCase();
  const shown = term ? results.filter((r) => r.domain.includes(term)) : results;
  const up = results.filter((r) => healthOf(r) !== "down").length;

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 border-b border-neutral-900 bg-neutral-950/95 px-4 pb-3 pt-[max(0.875rem,env(safe-area-inset-top))] backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight">{MONITOR_TITLE}</h1>
            <p className="truncate text-xs text-neutral-500">
              {data
                ? `${up} de ${results.length} en línea · ${time(data.checkedAt)}${data.region ? ` · desde ${data.region}` : ""}`
                : loading
                  ? "Consultando…"
                  : "Sin datos todavía"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void check()}
              disabled={loading}
              className="rounded-full px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900 disabled:opacity-40"
            >
              {loading ? "Revisando…" : "Actualizar"}
            </button>
            <button
              type="button"
              onClick={() => void logoutHere(user.uid)}
              className="rounded-full px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
            >
              Salir
            </button>
          </div>
        </div>
        <div className="mx-auto mt-3 max-w-4xl">
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => onFilter(e.target.value)}
            placeholder="Filtrar dominio..."
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-base outline-none transition-colors placeholder:text-neutral-600 focus:border-neutral-600 sm:text-sm"
            aria-label="Filtrar dominio"
          />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-3 px-4 py-5 pb-28 sm:px-8">
        {error && <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}

        {data && shown.length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-500">
            {results.length === 0 ? "No hay dominios configurados." : "Ningún dominio coincide."}
          </p>
        )}

        {shown.map((r) => {
          const h = healthOf(r);
          return (
            <article key={r.domain} className="rounded-xl border border-neutral-900 bg-neutral-900/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[h]}`} aria-hidden="true" />
                    <a
                      href={`https://${r.domain}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate font-medium text-neutral-100 hover:underline"
                    >
                      {r.domain}
                    </a>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{LABEL[h]}</p>
                </div>
                <Bars values={history[r.domain] ?? []} />
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg bg-neutral-950/60 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wider text-neutral-500">HTTP</dt>
                  <dd className={r.http.status && r.http.status < 400 ? "text-emerald-300" : "text-red-300"}>
                    {r.http.status ?? "—"}
                  </dd>
                </div>
                <div className="rounded-lg bg-neutral-950/60 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wider text-neutral-500">SSL</dt>
                  <dd className={!r.ssl.valid ? "text-red-300" : (r.ssl.daysLeft ?? 99) < SSL_WARN_DAYS ? "text-amber-300" : "text-emerald-300"}>
                    {r.ssl.valid ? `Válido · ${r.ssl.daysLeft} d` : "Inválido"}
                  </dd>
                </div>
                <div className="rounded-lg bg-neutral-950/60 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wider text-neutral-500">Latencia</dt>
                  <dd className={(r.http.ms ?? 0) > SLOW_MS ? "text-amber-300" : "text-neutral-100"}>
                    {r.http.ms !== null ? `${r.http.ms} ms` : "—"}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-xs text-neutral-500">
                {r.ssl.validTo ? `Certificado hasta ${date(r.ssl.validTo)}` : "Sin certificado"}
                {r.ssl.issuer ? ` · ${r.ssl.issuer}` : ""}
              </p>
              {(r.http.error || r.ssl.error) && (
                <p className="mt-1 text-xs text-red-300">{[r.http.error, r.ssl.error].filter(Boolean).join(" · ")}</p>
              )}
            </article>
          );
        })}
      </main>
    </div>
  );
}
