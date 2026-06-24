"use client";

/**
 * `useIsNativeApp` — `true` quando rodando dentro do app nativo (Capacitor),
 * mesmo carregando o site ao vivo (o runtime injeta `window.Capacitor`).
 *
 * Usado para esconder a COMPRA de créditos (bem digital) no Android, evitando
 * violar a política de pagamentos do Google Play (Play Billing). A venda
 * continua disponível no site/PWA. Default `false` (web) — atualiza após montar
 * para não causar mismatch de hidratação no export estático.
 */

import { useEffect, useState } from "react";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

export function useIsNativeApp(): boolean {
  const [native, setNative] = useState(false);

  useEffect(() => {
    try {
      const cap = (window as unknown as { Capacitor?: CapacitorGlobal })
        .Capacitor;
      setNative(Boolean(cap?.isNativePlatform?.()));
    } catch {
      setNative(false);
    }
  }, []);

  return native;
}
