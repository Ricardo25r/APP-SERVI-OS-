"use client";

/**
 * `PushSetup` — registra a inscrição Web Push do dispositivo no backend.
 *
 * Para o usuário autenticado, em HTTPS no domínio real: se a permissão de
 * notificação já foi concedida, inscreve em silêncio; se ainda não foi pedida,
 * pede no 1º gesto do usuário (navegadores/iOS exigem gesto — não pedimos na
 * carga pra não ser spam). Tudo best-effort: falha não quebra nada.
 */

import { useEffect, useRef } from "react";

import { useAuth } from "@/hooks/use-auth";
import { apiPost } from "@/services/api";
import { ensurePushSubscription, isPushSupported } from "@/lib/push";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function PushSetup() {
  const { isAuthenticated, hasHydrated } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || done.current) return;
    if (!isPushSupported() || !VAPID) return;
    if (typeof Notification === "undefined") return;

    async function register() {
      try {
        const sub = await ensurePushSubscription(VAPID);
        if (!sub || !sub.endpoint || !sub.keys) return;
        await apiPost("/push/subscribe", {
          endpoint: sub.endpoint,
          keys: sub.keys,
        });
        done.current = true;
      } catch {
        /* best-effort: tenta de novo no próximo acesso */
      }
    }

    if (Notification.permission === "granted") {
      void register();
      return;
    }
    if (Notification.permission === "default") {
      const ask = () => {
        void Notification.requestPermission().then((perm) => {
          if (perm === "granted") void register();
        });
      };
      window.addEventListener("pointerdown", ask, { once: true });
      return () => window.removeEventListener("pointerdown", ask);
    }
  }, [hasHydrated, isAuthenticated]);

  return null;
}
