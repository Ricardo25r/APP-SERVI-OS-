/**
 * Página **Nível** (`/gamificacao`).
 *
 * Protegida (qualquer papel logado). Para profissionais, mostra:
 * - `XpProgress` — card de destaque com nível, XP atual e barra de progresso.
 * - `XpHistory` — transações recentes de XP (IconChip verde/vermelho).
 *
 * Para contratantes (customer), exibe um aviso amigável de que XP/nível é um
 * recurso para profissionais (sem disparar as chamadas de API do profissional).
 *
 * Estados de hidratação/auth tratados (evita render protegido antes da sessão).
 */
"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useRequireAuth } from "@/hooks/use-auth";
import { AchievementsSection } from "@/modules/gamification/achievements-section";
import { LevelJourney } from "@/modules/gamification/level-journey";
import { XpHistory } from "@/modules/gamification/xp-history";
import { XpProgress } from "@/modules/gamification/xp-progress";

export default function GamificacaoPage() {
  const { user, role, isAuthenticated, hasHydrated } = useRequireAuth();

  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const isProfessional = role === "professional";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Seu nível
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe seu XP, seu nível e o que falta para evoluir.
        </p>
      </header>

      {isProfessional ? (
        <div className="space-y-6">
          <XpProgress />
          <LevelJourney />
          <AchievementsSection />
          <XpHistory />
        </div>
      ) : (
        <EmptyState
          icon={Trophy}
          title="XP e níveis são para profissionais"
          description="A pontuação e os níveis recompensam quem presta serviços no FazTudo. Você ainda pode conferir o ranking dos melhores profissionais da sua região."
          action={
            <Link href="/ranking" className={buttonVariants()}>
              Ver ranking
            </Link>
          }
          className="py-14"
        />
      )}
    </main>
  );
}
