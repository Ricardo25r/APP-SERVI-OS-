"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (PWA) — só na web pública (https + domínio real).
 * Em localhost (dev) e no app nativo (Capacitor: https://localhost / capacitor://)
 * não registra, evitando cache atrapalhar o desenvolvimento e o app.
 */
export function RegisterSW() {
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      window.location.protocol === "https:" &&
      window.location.hostname !== "localhost"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* falha de registro não é crítica */
      });
    }
  }, []);

  return null;
}
