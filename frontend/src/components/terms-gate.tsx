"use client";

/**
 * `TermsGate` — bloqueio de aceite dos Termos de Uso.
 *
 * Para o usuário autenticado que ainda NÃO aceitou a versão vigente dos Termos
 * (`user.terms_accepted === false`), exibe um modal pedindo o aceite. Vale para
 * **prestadores e contratantes** e reaparece quando a versão dos Termos muda.
 *
 * Sessões antigas (store sem `terms_accepted`) são atualizadas via `GET
 * /auth/me` no mount, para que o banner apareça no próximo acesso.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { apiGet, apiPost } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import type { User } from "@/types";

import { TERMS_SUMMARY } from "@/modules/legal/terms";

export function TermsGate() {
  const { user, isAuthenticated, hasHydrated } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sessão antiga sem o campo → atualiza uma vez para conhecer o status.
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !user) return;
    if (user.terms_accepted !== undefined) return;
    let active = true;
    void apiGet<User>("/auth/me")
      .then((fresh) => {
        if (active) setUser(fresh);
      })
      .catch(() => {
        /* offline/erro: tenta de novo no próximo acesso */
      });
    return () => {
      active = false;
    };
  }, [hasHydrated, isAuthenticated, user, setUser]);

  const needsAccept =
    hasHydrated &&
    isAuthenticated &&
    user != null &&
    user.terms_accepted === false;

  if (!needsAccept) return null;

  async function accept() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiPost<User>("/auth/accept-terms", {});
      setUser(updated);
    } catch {
      setError("Não foi possível registrar o aceite. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Termos de Uso"
    >
      <div className="w-full max-w-lg rounded-t-2xl border bg-card p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Termos de Uso do FazTudo
          </h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {TERMS_SUMMARY}
        </p>

        <p className="mt-3 text-sm">
          <Link
            href="/termos"
            target="_blank"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Ler os Termos de Uso completos
          </Link>
        </p>

        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <Button
            onClick={() => void accept()}
            disabled={submitting}
            size="lg"
            className="w-full"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Li e concordo
          </Button>
          <button
            type="button"
            onClick={() => logout()}
            disabled={submitting}
            className="py-1 text-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Não concordo — sair
          </button>
        </div>
      </div>
    </div>
  );
}
