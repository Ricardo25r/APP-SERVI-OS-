"use client";

/**
 * `AlertWatcher` — alerta in-app (som + popup) de **nova oportunidade** (para o
 * prestador) e de **nova notificação** (para todos — cobre "prestador aceitou"
 * do lado do contratante). Detecta o aumento das contagens (oportunidades /
 * não lidas) e dispara som + um popup no topo. O som é destravado no 1º toque.
 *
 * Funciona com o app **aberto**. Notificação na tela bloqueada (push) e o som
 * com o app fechado são etapas seguintes (Web Push / app nativo).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, Briefcase, X } from "lucide-react";

import { playAlertSound, unlockAlertSound } from "@/lib/alert-sound";
import { useAuth } from "@/hooks/use-auth";
import { useOpportunitiesCount } from "@/modules/leads/marketplace/use-opportunities-count";
import { fetchUnreadCount } from "@/modules/notifications/api";

interface Popup {
  id: number;
  kind: "opportunity" | "notification";
  title: string;
  body: string;
  href: string;
}

export function AlertWatcher() {
  const { isAuthenticated, hasHydrated, role } = useAuth();
  const enabled = hasHydrated && isAuthenticated;

  const [popup, setPopup] = useState<Popup | null>(null);
  const prevOpp = useRef<number | null>(null);
  const prevNotif = useRef<number | null>(null);
  const idRef = useRef(0);

  // Destrava o som no 1º gesto do usuário (exigência dos navegadores).
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => unlockAlertSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [enabled]);

  // Oportunidades (prestador): alerta quando a contagem AUMENTA.
  const oppCount = useOpportunitiesCount(enabled && role === "professional");
  useEffect(() => {
    if (!(enabled && role === "professional")) return;
    if (prevOpp.current === null) {
      prevOpp.current = oppCount;
      return;
    }
    if (oppCount > prevOpp.current) {
      const novas = oppCount - prevOpp.current;
      playAlertSound();
      setPopup({
        id: ++idRef.current,
        kind: "opportunity",
        title: novas > 1 ? `${novas} novas oportunidades!` : "Nova oportunidade!",
        body: "Toque para ver os leads disponíveis.",
        href: "/marketplace",
      });
    }
    prevOpp.current = oppCount;
  }, [oppCount, enabled, role]);

  // Notificações (todos): cobre "o prestador aceitou" para o contratante.
  const { data: notifCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: fetchUnreadCount,
    enabled,
    refetchInterval: 20_000,
  });
  useEffect(() => {
    if (!enabled) return;
    if (prevNotif.current === null) {
      prevNotif.current = notifCount;
      return;
    }
    if (notifCount > prevNotif.current) {
      playAlertSound();
      setPopup({
        id: ++idRef.current,
        kind: "notification",
        title: "Nova notificação",
        body: "Você tem uma novidade no FazTudo.",
        href: "/notificacoes",
      });
    }
    prevNotif.current = notifCount;
  }, [notifCount, enabled]);

  // Some sozinho após 8s.
  useEffect(() => {
    if (!popup) return;
    const t = window.setTimeout(() => setPopup(null), 8000);
    return () => window.clearTimeout(t);
  }, [popup]);

  if (!popup) return null;
  const Icon = popup.kind === "opportunity" ? Briefcase : Bell;

  return (
    <div className="fixed inset-x-0 top-2 z-[70] flex justify-center px-3">
      <Link
        href={popup.href}
        onClick={() => setPopup(null)}
        className="flex w-full max-w-md items-center gap-3 rounded-xl border border-brand/40 bg-card p-3 shadow-xl ring-1 ring-brand/20"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-foreground">
            {popup.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {popup.body}
          </span>
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPopup(null);
          }}
          aria-label="Fechar"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </Link>
    </div>
  );
}
