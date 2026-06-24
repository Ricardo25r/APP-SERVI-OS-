/**
 * Tela de **Perfil** do FazTudo (`/profile`).
 *
 * Protegida por `useRequireAuth()` — redireciona para `/login` se não houver
 * sessão (após a hidratação). Renderiza conforme o papel do usuário:
 *
 * - **customer**     → `CustomerProfileSection` (city/state; cria ou edita).
 * - **professional** → `ProfessionalProfileSection` (dados + saldo de créditos)
 *                      seguida de `ProfessionalCategoriesSection` (categorias).
 *
 * O topo exibe o `ProfileHeaderCard` (Avatar + nome + papel; nota/nível quando
 * profissional) e o `ProfileLinksSection` (atalhos p/ Configurações e Suporte).
 *
 * A camada de **lógica** (carregar/criar/editar perfis, categorias, reputação,
 * nível) permanece intacta nas seções; aqui só houve reestilização.
 *
 * Estados de loading (hidratação/auth) e erro são tratados aqui e nas seções.
 */
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Gift } from "lucide-react";

import { useRequireAuth } from "@/hooks/use-auth";
import { ApiError, apiGet } from "@/services/api";
import type { ProfessionalProfile } from "@/types";

import { AccountModeCard } from "@/modules/profile/account-mode-card";
import { CustomerProfileSection } from "@/modules/profile/customer-profile-section";
import { DeleteAccountCard } from "@/modules/profile/delete-account-card";
import { KycSection } from "@/modules/profile/kyc-section";
import { ProfessionalProfileSection } from "@/modules/profile/professional-profile-section";
import { ProfessionalCategoriesSection } from "@/modules/profile/professional-categories-section";
import { ProfileHeaderCard } from "@/modules/profile/profile-header-card";
import { ProfileLinksSection } from "@/modules/profile/profile-links-section";
import { LoadingState } from "@/modules/profile/feedback";

type ProfessionalProfileResponse = ProfessionalProfile & { balance?: number };

/**
 * Lê a reputação do profissional a partir do **cache compartilhado** da query
 * `["professional-profile"]` (a mesma usada por `ProfessionalProfileSection`).
 * O React Query deduplica a requisição — não há fetch extra nem lógica nova.
 */
function useProfessionalReputation(enabled: boolean) {
  const { data } = useQuery<ProfessionalProfileResponse | null>({
    queryKey: ["professional-profile"],
    queryFn: async () => {
      try {
        return await apiGet<ProfessionalProfileResponse>(
          "/users/me/professional-profile"
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled,
  });

  if (!data) return undefined;
  return {
    rating: data.rating ?? 0,
    totalReviews: data.total_reviews ?? 0,
    level: data.level ?? 0,
    xp: data.xp ?? 0,
  };
}

export default function ProfilePage() {
  const { user, role, isAuthenticated, hasHydrated } = useRequireAuth();
  const reputation = useProfessionalReputation(role === "professional");

  // Enquanto a sessão persistida não foi restaurada (ou o redirect de
  // `useRequireAuth` ainda não rodou), evitamos renderizar conteúdo protegido.
  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <LoadingState label="Carregando..." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Meu perfil
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas informações, preferências e suporte.
        </p>
      </header>

      <ProfileHeaderCard
        user={user}
        reputation={role === "professional" ? reputation : undefined}
      />

      <AccountModeCard />

      <Link
        href="/indique"
        className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Gift className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">
            Indique e ganhe créditos
          </span>
          <span className="block text-xs text-muted-foreground">
            Compartilhe com amigos e ganhe créditos.
          </span>
        </span>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </Link>

      <ProfileLinksSection />

      {role === "customer" && <CustomerProfileSection />}

      {role === "professional" && (
        <div className="space-y-6">
          <ProfessionalProfileSection />
          <ProfessionalCategoriesSection />
          <KycSection />
        </div>
      )}

      {role === "admin" && (
        <p className="text-sm text-muted-foreground">
          Administradores não possuem perfil de cliente ou profissional.
        </p>
      )}

      {role !== "admin" && <DeleteAccountCard />}
    </main>
  );
}
