"use client";

/**
 * Tela **Indique e ganhe** (`/indique`).
 *
 * Mostra o link/código de indicação do usuário, um botão de compartilhar
 * (Web Share API com fallback de copiar) e os ganhos. Quem se cadastrar pelo
 * link fica vinculado; o indicador ganha créditos na 1ª compra do indicado.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Gift, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet } from "@/services/api";

interface ReferralInfo {
  code: string;
  total_referrals: number;
  credits_earned: number;
}

export default function IndiquePage() {
  const auth = useRequireAuth();
  const [copied, setCopied] = useState(false);

  const { data } = useQuery({
    queryKey: ["referral", "me"],
    queryFn: () => apiGet<ReferralInfo>("/users/me/referral"),
    enabled: auth.isAuthenticated,
  });

  if (!auth.hasHydrated || !auth.isAuthenticated) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://faztudoapp.com.br";
  const link = data ? `${origin}/register?ref=${data.code}` : "";
  const message = `Conheça o FazTudo! Cadastre-se pelo meu link: ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }
  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "FazTudo", text: message, url: link });
        return;
      } catch {
        /* usuário cancelou ou não suportado → cai no copiar */
      }
    }
    await copy();
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Gift className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Indique e ganhe</h1>
          <p className="text-sm text-muted-foreground">
            Compartilhe com amigos e ganhe créditos.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="text-sm text-foreground">
          Compartilhe seu link. Quando seu amigo se cadastrar e fizer a{" "}
          <strong>primeira compra de créditos</strong>, você ganha um{" "}
          <strong className="text-brand">bônus de créditos</strong>.
        </p>

        <div className="mt-4 space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Seu link de indicação
          </span>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {link || "—"}
            </span>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label="Copiar link"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          {data ? (
            <p className="text-xs text-muted-foreground">
              Seu código: <strong className="tracking-wide">{data.code}</strong>
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          size="lg"
          onClick={() => void share()}
          className="mt-4 w-full bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <Share2 className="mr-2 h-4 w-4" aria-hidden />
          Compartilhar com um amigo
        </Button>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Indicados</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {data?.total_referrals ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Créditos ganhos</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-brand">
            {data?.credits_earned ?? "—"}
          </p>
        </div>
      </section>
    </main>
  );
}
