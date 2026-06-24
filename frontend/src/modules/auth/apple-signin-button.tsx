"use client";

/**
 * Botão "Entrar com Apple" (Sign in with Apple JS — fluxo de ID token, popup).
 *
 * Só renderiza quando `NEXT_PUBLIC_APPLE_CLIENT_ID` (o **Services ID**) está
 * definido; senão a tela de login mostra o placeholder "Em breve". Carrega o SDK
 * da Apple e, ao clicar, abre o popup de autorização, pega o `id_token` e chama
 * `POST /auth/apple`. A Apple só envia o **nome** na 1ª autorização — repassado
 * em `name` (depois ela não repete).
 *
 * Observação (export estático + Capacitor): este é o fluxo **web**
 * (faztudoapp.com.br, que precisa estar registrado como Return URL no Apple
 * Developer). No app nativo o login Apple usa plugin próprio (etapa futura).
 */

import { useEffect, useRef, useState } from "react";

import { apiPost } from "@/services/api";
import type { AuthResponse } from "@/types";

const APPLE_SRC =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

type AppleSignInResponse = {
  authorization?: { id_token?: string };
  user?: { name?: { firstName?: string; lastName?: string } };
};

type AppleId = {
  auth: {
    init: (cfg: Record<string, unknown>) => void;
    signIn: () => Promise<AppleSignInResponse>;
  };
};

function loadApple(): Promise<AppleId | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const existing = (window as unknown as { AppleID?: AppleId }).AppleID;
    if (existing?.auth) return resolve(existing);

    const onReady = () =>
      resolve((window as unknown as { AppleID?: AppleId }).AppleID ?? null);

    const tag = document.querySelector(`script[src="${APPLE_SRC}"]`);
    if (tag) {
      tag.addEventListener("load", onReady);
      return;
    }
    const script = document.createElement("script");
    script.src = APPLE_SRC;
    script.async = true;
    script.defer = true;
    script.onload = onReady;
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

interface AppleSignInButtonProps {
  onSuccess: (resp: AuthResponse) => void;
  onError: (message: string) => void;
  /** Papel para contas NOVAS (ignorado pelo backend se a conta já existe). */
  role?: "customer" | "professional";
}

export function AppleSignInButton({
  onSuccess,
  onError,
  role,
}: AppleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
  const appleRef = useRef<AppleId | null>(null);
  const roleRef = useRef(role);
  roleRef.current = role;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    void loadApple().then((apple) => {
      if (cancelled) return;
      if (!apple) {
        onError("Não foi possível carregar a Apple.");
        return;
      }
      apple.auth.init({
        clientId,
        scope: "name email",
        redirectURI: window.location.origin,
        usePopup: true,
      });
      appleRef.current = apple;
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, onError]);

  if (!clientId) return null;

  async function handleClick() {
    const apple = appleRef.current;
    if (!apple) return;
    try {
      const data = await apple.auth.signIn();
      const idToken = data.authorization?.id_token;
      if (!idToken) {
        onError("Login com Apple não retornou o token.");
        return;
      }
      const n = data.user?.name;
      const fullName = n
        ? `${n.firstName ?? ""} ${n.lastName ?? ""}`.trim() || undefined
        : undefined;
      const resp = await apiPost<AuthResponse>("/auth/apple", {
        id_token: idToken,
        name: fullName,
        role: roleRef.current,
      });
      onSuccess(resp);
    } catch (err) {
      // Fechar/cancelar o popup não é erro.
      const code = (err as { error?: string } | null)?.error;
      if (
        code === "popup_closed_by_user" ||
        code === "user_cancelled_authorize"
      ) {
        return;
      }
      onError("Não foi possível entrar com a Apple.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!ready}
      className="relative flex h-11 w-full items-center justify-center gap-3 rounded-md border border-input bg-card text-sm font-medium text-foreground transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span className="absolute left-4 inline-flex items-center">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden focusable="false">
          <path
            fill="currentColor"
            d="M16.365 1.43c0 1.14-.42 2.2-1.12 3.02-.74.88-1.95 1.56-3.08 1.47-.13-1.1.42-2.27 1.08-3.01.74-.86 2.03-1.5 3.12-1.48zM20.5 17.06c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.52-1.54.01-1.93-1.01-4.02-1-2.09.01-2.52 1.02-4.06 1.01-1.73-.02-3.05-1.78-4.04-3.34C-.07 16.62-.36 11.5 1.66 8.78c1.05-1.43 2.71-2.34 4.34-2.34 1.66 0 2.7 1.01 4.07 1.01 1.33 0 2.14-1.01 4.06-1.01 1.45 0 2.99.79 4.08 2.15-3.59 1.97-3.01 7.1-.71 8.47z"
          />
        </svg>
      </span>
      <span>Entrar com Apple</span>
    </button>
  );
}
