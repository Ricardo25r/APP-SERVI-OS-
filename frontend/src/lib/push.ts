"use client";

/**
 * Helpers de Web Push (inscrição no navegador). A chave pública VAPID vem de
 * `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (assada no build). Só funciona em HTTPS no
 * domínio real (o SW não registra em localhost — ver register-sw.tsx).
 */

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Converte a chave VAPID base64url no Uint8Array que o PushManager espera. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Garante a inscrição Web Push e devolve o JSON (endpoint + keys) para enviar
 * ao backend. Retorna null se não suportado / sem chave.
 */
export async function ensurePushSubscription(
  vapidPublicKey: string,
): Promise<PushSubscriptionJSON | null> {
  if (!isPushSupported() || !vapidPublicKey) return null;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }
  return sub.toJSON();
}
