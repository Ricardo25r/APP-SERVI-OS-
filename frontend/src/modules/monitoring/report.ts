/**
 * Reporta erros de runtime do frontend para o painel de monitoramento
 * (`POST /monitoring/client-error`). Best-effort: nunca propaga e tem throttle
 * (anti-flood/loops). Usado pelos error boundaries do App Router.
 */

import { apiPost } from "@/services/api";

let lastSent = 0;

export function reportClientError(info: {
  name?: string;
  message: string;
  stack?: string;
  url?: string;
}): void {
  const now = Date.now();
  if (now - lastSent < 3000) return; // no máx. 1 a cada 3s
  lastSent = now;
  void apiPost<void>("/monitoring/client-error", {
    name: info.name,
    message: (info.message || "Erro no frontend").slice(0, 4000),
    stack: info.stack ? info.stack.slice(0, 12000) : undefined,
    url: info.url,
  }).catch(() => {
    /* reporte é best-effort — silencioso */
  });
}
