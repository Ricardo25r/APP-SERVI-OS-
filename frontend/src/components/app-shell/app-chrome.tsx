"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { TermsGate } from "@/components/terms-gate";
import { useUnreadMessagesCount } from "@/modules/chat";

/**
 * `AppChrome` — wrapper client que envolve o conteúdo das páginas e adiciona
 * a camada de navegação mobile (`BottomNav`).
 *
 * Quando o usuário está autenticado, renderiza o `BottomNav` (mobile) e aplica
 * `pb-20 lg:pb-0` ao conteúdo para não ficar coberto pela barra fixa. Em telas
 * deslogadas (login/register/landing), nada é adicionado — o `BottomNav` já
 * se auto-oculta quando não autenticado.
 *
 * O `SiteHeader` (nav do topo no desktop) segue no `layout.tsx`, intacto.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasHydrated } = useAuth();
  const showBottomNav = hasHydrated && isAuthenticated;
  const unreadMessages = useUnreadMessagesCount(showBottomNav);

  return (
    <>
      <div className={cn(showBottomNav ? "pb-20 lg:pb-0" : undefined)}>
        {children}
      </div>
      <BottomNav unreadCount={unreadMessages} />
      <TermsGate />
    </>
  );
}
