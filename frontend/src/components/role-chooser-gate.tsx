"use client";

/**
 * `RoleChooserGate` — seletor "Entrar como Contratante/Profissional" (papel duplo).
 *
 * Aparece quando o usuário autenticado pode assumir MAIS DE UM papel
 * (`available_roles.length > 1`) e ainda não escolheu nesta sessão do navegador
 * (flag em `sessionStorage`, limpa no logout). Ao escolher, troca o papel ativo
 * (`POST /auth/switch-role`), substitui os tokens e recarrega na home do papel.
 *
 * Vale para qualquer forma de login (e-mail/Google/Apple) — fica fora do fluxo
 * de login (que tem o reload "duro" anti-tela-branca do Google).
 */

import { useEffect, useState } from "react";
import { Briefcase, UserRound } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { apiGet, apiPost } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { homePathForRole, toSession } from "@/modules/auth";
import type { AuthResponse, User, UserRole } from "@/types";

export const ROLE_CHOSEN_KEY = "faztudo-role-chosen";

const ROLE_META: Record<
  "customer" | "professional",
  { label: string; desc: string; icon: typeof Briefcase }
> = {
  customer: {
    label: "Contratante",
    desc: "Quero contratar serviços.",
    icon: UserRound,
  },
  professional: {
    label: "Profissional",
    desc: "Quero oferecer meus serviços.",
    icon: Briefcase,
  },
};

export function RoleChooserGate() {
  const { user, isAuthenticated, hasHydrated } = useAuth();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const [chosen, setChosen] = useState(true);
  const [submitting, setSubmitting] = useState<UserRole | null>(null);

  // Lê o flag de escolha + atualiza available_roles em sessões antigas.
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !user) return;
    const already =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(ROLE_CHOSEN_KEY) === "1";
    setChosen(already);
    if (user.available_roles === undefined) {
      void apiGet<User>("/auth/me")
        .then((fresh) => setUser(fresh))
        .catch(() => {
          /* offline: tenta no próximo acesso */
        });
    }
  }, [hasHydrated, isAuthenticated, user, setUser]);

  const roles = (user?.available_roles ?? []).filter(
    (r): r is "customer" | "professional" =>
      r === "customer" || r === "professional"
  );
  const needs = hasHydrated && isAuthenticated && !chosen && roles.length > 1;
  if (!needs || !user) return null;

  async function choose(role: "customer" | "professional") {
    setSubmitting(role);
    try {
      const active = user!.active_role ?? user!.role;
      if (role !== active) {
        const resp = await apiPost<AuthResponse>("/auth/switch-role", {
          active_role: role,
        });
        setAuth(toSession(resp));
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(ROLE_CHOSEN_KEY, "1");
      }
      window.location.assign(homePathForRole(role));
    } catch {
      setSubmitting(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Escolher tipo de conta"
    >
      <div className="w-full max-w-md rounded-t-2xl border bg-card p-6 shadow-xl sm:rounded-2xl">
        <h2 className="text-center text-lg font-bold tracking-tight text-foreground">
          Como você quer entrar?
        </h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Sua conta pode ser usada das duas formas. Você pode trocar depois no
          menu.
        </p>

        <div className="mt-5 grid gap-3">
          {roles.map((role) => {
            const meta = ROLE_META[role];
            const Icon = meta.icon;
            const busy = submitting === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => void choose(role)}
                disabled={submitting !== null}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">
                    {meta.label}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {meta.desc}
                  </span>
                </span>
                {busy ? (
                  <span className="text-xs text-muted-foreground">...</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
