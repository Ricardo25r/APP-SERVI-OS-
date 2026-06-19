/**
 * Camada de acesso à API para **Gamificação** (Fase 9).
 *
 * Encapsula as chamadas a `/gamification/*` e normaliza respostas que podem vir
 * paginadas (`{items,...}`) ou como lista crua — ambas tratadas defensivamente.
 *
 * Endpoints (Bearer injetado automaticamente por `@/services/api`):
 * - `GET /gamification/me`      → XP/nível + progresso do profissional logado.
 * - `GET /gamification/ranking` → top profissionais (filtros opcionais).
 * - `GET /gamification/levels`  → tabela de níveis.
 */

import { apiGet } from "@/services/api";

import type {
  GamificationLevel,
  GamificationMe,
  RankingFilters,
  RankingItem,
} from "./types";

/**
 * Extrai a lista de itens de uma resposta que pode ser:
 * - um array cru `T[]`;
 * - um envelope `{ items: T[], ... }`.
 * Qualquer outro formato resulta em lista vazia (defensivo).
 */
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray((data as { items: unknown }).items)
  ) {
    return (data as { items: T[] }).items;
  }
  return [];
}

/** Progresso de XP/nível do profissional logado. */
export function fetchMe(): Promise<GamificationMe> {
  return apiGet<GamificationMe>("/gamification/me");
}

/** Tabela de níveis (ordenada por `level`). */
export async function fetchLevels(): Promise<GamificationLevel[]> {
  const data = await apiGet<unknown>("/gamification/levels");
  const items = unwrapList<GamificationLevel>(data);
  return [...items].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
}

/** Ranking de profissionais. Aceita filtros opcionais por limite/cidade/UF. */
export async function fetchRanking(
  filters: RankingFilters = {}
): Promise<RankingItem[]> {
  const params = new URLSearchParams();
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.city?.trim()) params.set("city", filters.city.trim());
  if (filters.state?.trim()) params.set("state", filters.state.trim());

  const query = params.toString();
  const path = query ? `/gamification/ranking?${query}` : "/gamification/ranking";

  const data = await apiGet<unknown>(path);
  return unwrapList<RankingItem>(data);
}
