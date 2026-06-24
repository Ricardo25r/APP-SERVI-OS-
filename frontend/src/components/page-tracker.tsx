"use client";

/**
 * `PageTracker` — registra a visualização de página (analytics, sem PII).
 *
 * A cada mudança de rota, envia `POST /analytics/track` com a rota + o papel
 * ativo (o backend deriva aparelho/SO do User-Agent). Best-effort: falha não
 * afeta nada. Não envia dados pessoais nem IP.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import { apiPost } from "@/services/api";

export function PageTracker() {
  const pathname = usePathname();
  const { role, hasHydrated } = useAuth();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!hasHydrated || !pathname || last.current === pathname) return;
    last.current = pathname;
    void apiPost("/analytics/track", {
      path: pathname,
      role: role ?? undefined,
    }).catch(() => {
      /* best-effort */
    });
  }, [pathname, role, hasHydrated]);

  return null;
}
