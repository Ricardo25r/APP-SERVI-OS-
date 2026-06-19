/**
 * Página **Avaliações** (`/avaliacoes`).
 *
 * Protegida (qualquer papel logado). Mostra:
 * - `PendingReviews` — avaliações que o usuário ainda precisa fazer.
 * - `ReviewList` — avaliações recebidas pelo próprio usuário.
 *
 * Estados de hidratação/auth tratados (evita render de conteúdo protegido
 * antes da sessão ser restaurada).
 */
"use client";

import { useRequireAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PendingReviews } from "@/modules/reviews/pending-reviews";
import { ReviewList } from "@/modules/reviews/review-list";

export default function AvaliacoesPage() {
  const { user, isAuthenticated, hasHydrated } = useRequireAuth();

  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Avaliações</h1>
        <p className="text-muted-foreground">
          Avalie quem você negociou e veja o que dizem sobre você.
        </p>
      </header>

      <div className="space-y-8">
        <PendingReviews />

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Avaliações recebidas</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewList
              userId={user.id}
              emptyLabel="Você ainda não recebeu avaliações."
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
