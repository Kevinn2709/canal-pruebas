"use client";

/**
 * page.tsx — Qué se ve en la raíz (/), según la sesión y el papel.
 *
 * Sin sesión:
 *   Landing de mantenimiento + "Iniciar sesión" arriba. El ícono de chat se
 *   ve, pero al tocarlo solo avisa que hay que iniciar sesión.
 *
 * Miembros y admins (los papeles salen de las listas de firestore.rules, como
 * siempre):
 *   Se quedan en la landing y el ícono de chat abre sus chats, con sus
 *   permisos de siempre.
 *
 * Fundadores (lista founders() de las reglas):
 *   Monitor de dominios. Escribiendo `root` en "Filtrar dominio…" se abre la
 *   consola (sus chats). Si vincularon una cuenta de miembro, el ícono de chat
 *   del monitor abre esa cuenta. Si la web pasa a segundo plano, la consola
 *   vuelve sola al monitor.
 *
 * Tocar una notificación abre la web en "/#c=<chat>": en el monitor se guarda
 * ese chat y se abre directo al escribir `root`; en la landing se abre el
 * ícono de chat en ese chat.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebase, isConfigured } from "@/lib/firebase";
import type { Session } from "@/lib/session";
import { restoreSession } from "@/lib/restore";
import { getLinked, onLinkedChange, type LinkedAccount } from "@/lib/linked";
import { Login } from "@/components/Login";
import { Unlock } from "@/components/Unlock";
import { Waiting } from "@/components/Waiting";
import { AppReady } from "@/components/AppReady";
import { ChatWidget } from "@/components/ChatWidget";
import { LandingMantenimiento } from "@/components/LandingMantenimiento";
import { MonitorDominios } from "@/components/MonitorDominios";
import { ConsolaFundador } from "@/components/ConsolaFundador";

const CHAT_HASH = /^#c=([A-Za-z0-9_-]+)$/;

export default function Page() {
  const [configured, setConfigured] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [view, setView] = useState<"monitor" | "consola">("monitor");
  const [linked, setLinked] = useState<LinkedAccount | null>(null);
  const [unread, setUnread] = useState(0);
  const pendingChat = useRef<string | null>(null);
  const currentUid = useRef<string | null>(null);

  // Al abrir: si viene de tocar una notificación (#c=…), se recuerda el chat.
  // La URL queda limpia (sin chat abierto ni marcas de una visita anterior).
  useEffect(() => {
    const m = window.location.hash.match(CHAT_HASH);
    if (m) pendingChat.current = m[1];
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    setLinked(getLinked());
    return onLinkedChange(setLinked);
  }, []);

  useEffect(() => {
    if (!isConfigured()) {
      setConfigured(false);
      setReady(true);
      return;
    }
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, (u) => {
      // Si cambia la cuenta (o se cierra sesión), se olvidan las llaves y se
      // vuelve al inicio.
      const uid = u ? u.uid : null;
      if (uid !== currentUid.current) {
        currentUid.current = uid;
        setSession(null);
        setView("monitor");
        setWidgetOpen(false);
        setUnread(0);
      }
      setUser(u);
      setReady(true);
    });
  }, []);

  // Con "Recordar en este dispositivo", la sesión se abre sola.
  useEffect(() => {
    if (!user || session) return;
    let cancelled = false;
    setRestoring(true);
    void restoreSession(user)
      .then((s) => {
        if (!cancelled && s) setSession(s);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, session]);

  useEffect(() => {
    if (session) setAuthOpen(false);
  }, [session]);

  // Tocar una notificación con la web ya abierta (y sin chats montados).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; chatId?: string } | null;
      if (d?.type === "open-chat" && d.chatId) pendingChat.current = d.chatId;
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, []);

  const founderView = !!session && session.founder && !!session.ws;

  // Miembros y admins: si venía de una notificación, se abre ese chat.
  useEffect(() => {
    if (!session || founderView) return;
    const id = pendingChat.current;
    if (!id) return;
    pendingChat.current = null;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#c=${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    setWidgetOpen(true);
  }, [session, founderView]);

  const enterConsole = useCallback(() => {
    const id = pendingChat.current;
    pendingChat.current = null;
    window.history.replaceState(null, "", `${window.location.pathname}${id ? `#c=${id}` : ""}`);
    setWidgetOpen(false);
    setView("consola");
  }, []);

  const exitConsole = useCallback(() => setView("monitor"), []);
  const openWidget = useCallback(() => setWidgetOpen(true), []);

  if (!ready) return <div className="h-dvh bg-neutral-950" />;

  if (!configured) {
    return (
      <div className="flex h-dvh items-center justify-center bg-neutral-950 px-6 text-neutral-200">
        <div className="max-w-sm space-y-2 text-center">
          <p className="text-base font-medium">Falta la configuración de Firebase</p>
          <p className="text-sm text-neutral-500">
            Agrega las variables NEXT_PUBLIC_FIREBASE_… en Vercel (Settings → Environment Variables) y vuelve a
            desplegar.
          </p>
        </div>
      </div>
    );
  }

  // ---------- Fundador: monitor o consola ----------
  if (founderView && user && session) {
    if (view === "consola") {
      return <ConsolaFundador user={user} session={session} onSession={setSession} onExit={exitConsole} />;
    }
    return (
      <>
        <MonitorDominios user={user} onRoot={enterConsole} />
        {linked && <ChatWidget mode="linked" open={widgetOpen} onOpenChange={setWidgetOpen} linkedName={linked.name} />}
      </>
    );
  }

  // ---------- Landing: visitantes, miembros y admins ----------
  const widgetMode = !user ? "inactive" : !session ? "locked" : "own";
  const authLabel = !user ? "Iniciar sesión" : !session && !restoring ? "Continuar" : null;

  return (
    <>
      <LandingMantenimiento authLabel={authLabel} onAuth={() => setAuthOpen(true)} />

      <ChatWidget
        mode={widgetMode}
        open={widgetOpen && widgetMode === "own"}
        onOpenChange={setWidgetOpen}
        onLockedTap={() => setAuthOpen(true)}
        unread={unread}
      >
        {user && session ? (
          session.ws ? (
            <AppReady
              user={user}
              session={session}
              onSession={setSession}
              embedded
              active={widgetOpen}
              onUnread={setUnread}
              onAttention={openWidget}
            />
          ) : (
            <Waiting session={session} email={user.email ?? ""} onSession={setSession} />
          )
        ) : null}
      </ChatWidget>

      {authOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950" role="dialog" aria-modal="true" aria-label="Iniciar sesión">
          <div className="in-panel relative h-full overflow-y-auto">
            <button
              type="button"
              onClick={() => setAuthOpen(false)}
              className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 rounded-full p-2 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
              aria-label="Cerrar"
            >
              ✕
            </button>
            {user ? <Unlock key={user.uid} user={user} onReady={setSession} /> : <Login />}
          </div>
        </div>
      )}
    </>
  );
}
