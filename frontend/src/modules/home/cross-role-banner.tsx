"use client";

/**
 * `CrossRoleBanner` — convite cruzado de papel (papel duplo).
 *
 * - No modo **Profissional**: convida a ativar a conta de **Contratante**.
 * - No modo **Contratante**: convida a virar **Profissional**.
 *
 * Só aparece se o usuário AINDA NÃO tem o outro papel (`available_roles`). Leva
 * ao Perfil, onde o `AccountModeCard` faz a ativação (reusa cidade/estado).
 */

import Link from "next/link";
import { Briefcase, ChevronRight, UserRound } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";

export function CrossRoleBanner() {
  const { user, role, hasHydrated } = useAuth();
  if (!hasHydrated || !user || role === "admin") return null;
  // available_roles indefinido = sessão antiga; não mostra até saber (o
  // RoleChooserGate/me atualiza). Evita piscar o convite indevidamente.
  if (user.available_roles === undefined) return null;

  const other = role === "customer" ? "professional" : "customer";
  if ((user.available_roles ?? []).includes(other)) return null;

  const pro = other === "professional";
  const Icon = pro ? Briefcase : UserRound;

  return (
    <Link
      href="/profile"
      className="mt-6 flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4 transition-colors hover:bg-brand/10"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-foreground">
          {pro
            ? "Ganhe uma renda extra como profissional"
            : "Também precisa contratar um serviço?"}
        </span>
        <span className="block text-xs text-muted-foreground">
          {pro
            ? "Ofereça seus serviços na plataforma — ative sua conta de Profissional."
            : "Ative sua conta de Contratante e contrate quem você precisa."}
        </span>
      </span>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </Link>
  );
}
