"use client";

/**
 * ChatWidget.tsx — Ícono flotante de chat (abajo a la derecha).
 *
 * Modos:
 * - "inactive": sin sesión. Se ve, pero al tocarlo solo avisa que hay que
 *   iniciar sesión.
 * - "locked": con sesión pero sin la frase todavía. Al tocarlo se pide la
 *   frase.
 * - "own": miembros y admins. Abre sus chats (los `children`).
 * - "linked": en el monitor del fundador. Abre la cuenta de miembro
 *   vinculada, que corre en /vinculada dentro de un iframe del mismo sitio,
 *   con su propia sesión de Firebase.
 *
 * El panel ocupa toda la pantalla en el teléfono y flota en la computadora.
 * Se queda montado aunque esté cerrado, para que lleguen los mensajes, el
 * número de no leídos y las llamadas.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LINKED_PATH } from "@/lib/scope";

export type WidgetMode = "inactive" | "locked" | "own" | "linked";

function BubbleIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M8.2 5h7.6A5.2 5.2 0 0 1 21 10.2c0 2.2-1.3 4-3.1 4.8v3.6l-3.2-3.2H8.2A5.2 5.2 0 0 1 3 10.2 5.2 5.2 0 0 1 8.2 5Z"
      />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChatWidget({
  mode,
  open,
  onOpenChange,
  onLockedTap,
  unread = 0,
  linkedName,
  children,
}: {
  mode: WidgetMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLockedTap?: () => void;
  unread?: number;
  linkedName?: string;
  children?: ReactNode;
}) {
  const [hint, setHint] = useState(false);
  const [linkedUnread, setLinkedUnread] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const usable = mode === "own" || mode === "linked";

  const tap = () => {
    if (mode === "inactive") return setHint(true);
    if (mode === "locked") return onLockedTap?.();
    onOpenChange(!open);
  };

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(false), 3500);
    return () => window.clearTimeout(t);
  }, [hint]);

  // ---------- Conversación con la cuenta vinculada (iframe) ----------
  const postOpen = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "canal-widget", open: openRef.current }, window.location.origin);
  }, []);

  useEffect(() => {
    if (mode !== "linked") return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: string; n?: unknown } | null;
      if (d?.type === "canal-hello") postOpen();
      else if (d?.type === "canal-unread" && typeof d.n === "number") setLinkedUnread(d.n);
      else if (d?.type === "canal-attention") onOpenChange(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mode, onOpenChange, postOpen]);

  useEffect(() => {
    if (mode === "linked") postOpen();
  }, [mode, open, postOpen]);

  // Escape cierra el panel (computadora).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const count = mode === "linked" ? linkedUnread : unread;

  return (
    <>
      {usable && (
        <div
          className={`${open ? "flex" : "hidden"} fixed inset-0 z-40 flex-col overflow-hidden bg-neutral-950 text-neutral-100 md:inset-auto md:bottom-24 md:right-5 md:h-[min(44rem,calc(100dvh-8rem))] md:w-[min(60rem,calc(100vw-2.5rem))] md:rounded-2xl md:border md:border-neutral-800 md:shadow-2xl`}
          // Las ventanas "fijas" de la app (fotos, llamadas, menús) quedan
          // dentro del panel y no se salen de él.
          style={{ transform: "translateZ(0)" }}
          role="dialog"
          aria-label="Mensajes"
          aria-hidden={!open}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-900 px-3 pb-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] md:pt-1.5">
            <p className="truncate text-sm font-medium text-neutral-300">
              Mensajes{mode === "linked" && linkedName ? ` · ${linkedName}` : ""}
            </p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-2 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
              aria-label="Cerrar mensajes"
            >
              <ChevronDown />
            </button>
          </div>
          <div className="in-panel relative min-h-0 flex-1">
            <div className="absolute inset-0 overflow-hidden">
              {mode === "own" ? (
                children
              ) : (
                <iframe
                  ref={frame}
                  src={LINKED_PATH}
                  title="Mensajes"
                  className="h-full w-full border-0 bg-neutral-950"
                  allow="microphone; camera; autoplay; clipboard-write"
                  onLoad={postOpen}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className={`${open ? "hidden md:flex" : "flex"} fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 flex-col items-end gap-2`}
      >
        {hint && (
          <p role="status" className="max-w-[16rem] rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 shadow-xl">
            Inicia sesión para usar el chat.
          </p>
        )}
        <button
          type="button"
          onClick={tap}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-transform active:scale-95 ${
            usable ? "bg-white text-neutral-950" : "bg-neutral-800 text-neutral-400"
          }`}
          aria-label={open ? "Cerrar mensajes" : count > 0 ? `Mensajes, ${count} sin leer` : "Mensajes"}
        >
          <BubbleIcon />
          {usable && count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
