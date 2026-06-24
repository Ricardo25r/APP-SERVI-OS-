"use client";

/**
 * Botão "Entrar com Google" (Google Identity Services — fluxo de ID token).
 *
 * Só renderiza quando `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` está definido (senão a
 * tela mostra o placeholder "Em breve"). Carrega o GIS, renderiza o botão
 * oficial do Google e, ao receber a credencial (ID token), chama
 * `POST /auth/google` e devolve a `AuthResponse` ao pai.
 *
 * Observação (export estático + Capacitor): o GIS web só funciona no site
 * (faztudoapp.com.br). Dentro do app nativo a origem do webview é rejeitada pelo
 * Google — o login nativo usa um plugin Capacitor (etapa futura). Por isso o
 * botão só é exibido no ambiente web.
 */

import { useEffect, useRef } from "react";

import { apiPost } from "@/services/api";
import type { AuthResponse } from "@/types";

const GIS_SRC = "https://accounts.google.com/gsi/client";

type GoogleId = {
  accounts: {
    id: {
      initialize: (cfg: {
        client_id: string;
        callback: (r: { credential: string }) => void;
      }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
};

function loadGis(): Promise<GoogleId | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const existing = (window as unknown as { google?: GoogleId }).google;
    if (existing?.accounts?.id) return resolve(existing);

    const onReady = () =>
      resolve((window as unknown as { google?: GoogleId }).google ?? null);

    const tag = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (tag) {
      tag.addEventListener("load", onReady);
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = onReady;
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

interface GoogleSignInButtonProps {
  onSuccess: (resp: AuthResponse) => void;
  onError: (message: string) => void;
  /** Papel para contas NOVAS (ignorado pelo backend se a conta já existe). */
  role?: "customer" | "professional";
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  role,
}: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const ref = useRef<HTMLDivElement>(null);
  const roleRef = useRef(role);
  roleRef.current = role;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;

    void loadGis().then((google) => {
      if (cancelled || !google || !ref.current) {
        if (!google) onError("Não foi possível carregar o Google.");
        return;
      }
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (r) => {
          void apiPost<AuthResponse>("/auth/google", {
            id_token: r.credential,
            role: roleRef.current,
          })
            .then(onSuccess)
            .catch(() => onError("Não foi possível entrar com o Google."));
        },
      });
      google.accounts.id.renderButton(ref.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 320,
        locale: "pt-BR",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, onSuccess, onError]);

  if (!clientId) return null;
  return <div ref={ref} className="flex justify-center" />;
}
