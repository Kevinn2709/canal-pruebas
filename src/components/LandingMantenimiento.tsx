"use client";

/**
 * LandingMantenimiento.tsx — Lo que ve cualquiera al entrar a la raíz (/):
 * sitio en mantenimiento, con "Iniciar sesión" arriba a la derecha.
 *
 * Miembros y admins se quedan aquí después de iniciar sesión y usan el ícono
 * de chat. Los fundadores pasan al monitor de dominios.
 */

import { useEffect } from "react";

export const LANDING_TITLE = "Sitio en mantenimiento";

function ConeIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
      <path d="M27.5 8h9l11 40h-31l11-40Z" fill="#f59e0b" />
      <path d="M24.4 20h15.2l2.2 8H22.2l2.2-8Z M20 36h24l2.2 8H17.8L20 36Z" fill="#fef3c7" />
      <rect x="10" y="48" width="44" height="6" rx="2" fill="#d97706" />
    </svg>
  );
}

export function LandingMantenimiento({
  authLabel,
  onAuth,
}: {
  /** Texto del botón de arriba ("Iniciar sesión", "Continuar") o null para ocultarlo. */
  authLabel: string | null;
  onAuth: () => void;
}) {
  useEffect(() => {
    document.title = LANDING_TITLE;
  }, []);

  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
          En mantenimiento
        </div>
        {authLabel && (
          <button
            type="button"
            onClick={onAuth}
            className="rounded-full border border-neutral-700 px-4 py-1.5 text-sm text-neutral-100 transition-colors hover:border-neutral-500 hover:bg-neutral-900"
          >
            {authLabel}
          </button>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-neutral-900 ring-1 ring-neutral-800">
            <ConeIcon />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sitio en mantenimiento</h1>
          <p className="mt-3 text-base text-neutral-400">En construcción para un mejor servicio de los usuarios.</p>
          <div className="mx-auto mt-8 h-1 w-48 overflow-hidden rounded-full bg-neutral-800" aria-hidden="true">
            <div className="h-full w-1/3 animate-[landing-progress_2.4s_ease-in-out_infinite] rounded-full bg-amber-400" />
          </div>
          <p className="mt-4 text-xs text-neutral-600">Vuelve pronto.</p>
        </div>
      </main>

      <footer className="px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs text-neutral-600">
        © {year}
      </footer>
    </div>
  );
}
