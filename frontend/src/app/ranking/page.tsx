/**
 * Página **Ranking** (`/ranking`).
 *
 * Protegida (qualquer papel logado). Mostra `RankingTable` com os melhores
 * profissionais. Filtro opcional por cidade e UF (aplicado ao submeter o form,
 * para não disparar uma chamada a cada tecla). Só tokens do design system.
 */
"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { useRequireAuth } from "@/hooks/use-auth";
import { BRAZIL_STATES } from "@/modules/profile/constants";
import { RankingTable } from "@/modules/gamification/ranking-table";
import type { RankingFilters } from "@/modules/gamification/types";

const RANKING_LIMIT = 50;

export default function RankingPage() {
  const { user, isAuthenticated, hasHydrated } = useRequireAuth();

  // Estado do formulário (rascunho) vs. filtros aplicados (usados na query).
  const [cityDraft, setCityDraft] = useState("");
  const [stateDraft, setStateDraft] = useState("");
  const [applied, setApplied] = useState<RankingFilters>({
    limit: RANKING_LIMIT,
  });

  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const hasFilters = Boolean(applied.city || applied.state);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApplied({
      limit: RANKING_LIMIT,
      city: cityDraft.trim() || undefined,
      state: stateDraft.trim() || undefined,
    });
  }

  function handleClear() {
    setCityDraft("");
    setStateDraft("");
    setApplied({ limit: RANKING_LIMIT });
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Ranking</h1>
        <p className="text-muted-foreground">
          Os profissionais com mais XP no FazTudo.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mb-6 grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      >
        <div className="space-y-2">
          <Label htmlFor="ranking-city">Cidade</Label>
          <Input
            id="ranking-city"
            placeholder="Ex.: Ariquemes"
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
            autoComplete="address-level2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ranking-state">Estado (UF)</Label>
          <Select
            id="ranking-state"
            value={stateDraft}
            onChange={(e) => setStateDraft(e.target.value)}
            className="sm:w-28"
          >
            <SelectOption value="">Todos</SelectOption>
            {BRAZIL_STATES.map((uf) => (
              <SelectOption key={uf} value={uf}>
                {uf}
              </SelectOption>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit">
            <Search className="mr-2 h-4 w-4" aria-hidden />
            Filtrar
          </Button>
          {hasFilters && (
            <Button type="button" variant="outline" onClick={handleClear}>
              <X className="mr-2 h-4 w-4" aria-hidden />
              Limpar
            </Button>
          )}
        </div>
      </form>

      <RankingTable filters={applied} />
    </main>
  );
}
