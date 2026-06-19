/**
 * Página **Nível** (`/gamificacao`).
 *
 * Protegida (qualquer papel logado). Para profissionais, mostra:
 * - `XpProgress` — XP atual, nível e barra de progresso até o próximo nível.
 * - `XpHistory` — transações recentes de XP.
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
import { Card, CardContent } from "@/components/ui/card";
import { useRequireAuth } from "@/hooks/use-auth";
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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Seu nível</h1>
        <p className="text-muted-foreground">
          Acompanhe seu XP, seu nível e o que falta para evoluir.
        </p>
      </header>

      {isProfessional ? (
        <div className="space-y-8">
          <XpProgress />
          <XpHistory />
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-brand">
              <Trophy className="h-7 w-7" aria-hidden />
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                XP e níveis são para profissionais
              </h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                A pontuação e os níveis recompensam quem presta serviços no
                FazTudo. Você ainda pode conferir o ranking dos melhores
                profissionais da sua região.
              </p>
            </div>
            <Link href="/ranking" className={buttonVariants()}>
              Ver ranking
            </Link>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
