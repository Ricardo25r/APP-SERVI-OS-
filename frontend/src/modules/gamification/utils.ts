/**
 * Utilitários da feature de **Gamificação** (Fase 9).
 *
 * - `xpSourceLabel`: traduz a `source` técnica de uma transação de XP p/ PT-BR.
 * - `formatXpDate`: data ISO em PT-BR (dd/mm/aaaa).
 * - `formatXp`: número de XP com separador de milhar (PT-BR).
 * - `levelProgress`: calcula a % de progresso e o XP restante até o próximo nível.
 * - `gamificationErrorMessage`: mensagem de erro amigável (PT-BR).
 */

import { ApiError } from "@/services/api";

import type { GamificationMe } from "./types";

/** Rótulos PT-BR por `source` conhecida de transação de XP. */
const XP_SOURCE_LABELS: Record<string, string> = {
  lead_purchase: "Compra de lead",
  review_5star: "Avaliação 5 estrelas",
  review_positive: "Avaliação positiva",
  review_negative: "Avaliação negativa",
  profile_complete: "Perfil completo",
  signup: "Cadastro",
  bonus: "Bônus",
};

/** Traduz a `source` técnica para PT-BR (fallback: humaniza a própria chave). */
export function xpSourceLabel(source: string): string {
  if (XP_SOURCE_LABELS[source]) return XP_SOURCE_LABELS[source];
  // Fallback defensivo: "some_unknown_source" -> "Some unknown source".
  const humanized = source.replace(/[_-]+/g, " ").trim();
  if (!humanized) return "Atividade";
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

/** Formata uma data ISO em `dd/mm/aaaa` (PT-BR). */
export function formatXpDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formata um número de XP com separador de milhar (PT-BR). */
export function formatXp(xp: number): string {
  if (!Number.isFinite(xp)) return "0";
  return Math.round(xp).toLocaleString("pt-BR");
}

/** XP com sinal explícito (+N / -N). */
export function formatSignedXp(amount: number): string {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${formatXp(Math.abs(amount))}`;
}

export interface LevelProgress {
  /** % de progresso (0–100) dentro da faixa do nível atual. */
  percent: number;
  /** XP que ainda falta para o próximo nível (≥ 0). */
  xpRemaining: number;
  /** Verdadeiro quando não há próximo nível (nível máximo). */
  isMaxLevel: boolean;
}

/**
 * Calcula o progresso até o próximo nível de forma defensiva.
 *
 * Estratégia (na ordem de disponibilidade dos dados do backend):
 * 1. Se `next_level_xp` (alvo) e `level_min_xp` (base) existem, usa a faixa real.
 * 2. Senão, se `xp_for_next_level` (faltante) existe, deriva o alvo de `xp`.
 * 3. Se não há próximo nível → nível máximo (100%).
 */
export function levelProgress(me: GamificationMe): LevelProgress {
  const xp = typeof me.xp === "number" ? me.xp : 0;

  const hasNextLevel =
    me.next_level != null ||
    me.next_level_xp != null ||
    me.xp_for_next_level != null;

  if (!hasNextLevel) {
    return { percent: 100, xpRemaining: 0, isMaxLevel: true };
  }

  // Alvo absoluto de XP para o próximo nível.
  let target: number | null =
    typeof me.next_level_xp === "number" ? me.next_level_xp : null;

  // Quando só temos o "faltante", derivamos o alvo do XP atual.
  if (target == null && typeof me.xp_for_next_level === "number") {
    target = xp + Math.max(0, me.xp_for_next_level);
  }

  if (target == null || target <= 0) {
    return { percent: 0, xpRemaining: 0, isMaxLevel: false };
  }

  const base =
    typeof me.level_min_xp === "number" && me.level_min_xp <= xp
      ? me.level_min_xp
      : 0;

  const span = target - base;
  const done = xp - base;
  const percent =
    span > 0 ? Math.max(0, Math.min(100, Math.round((done / span) * 100))) : 0;
  const xpRemaining = Math.max(0, Math.round(target - xp));

  return { percent, xpRemaining, isMaxLevel: false };
}

/** Mensagem de erro amigável (PT-BR) para a área de gamificação. */
export function gamificationErrorMessage(
  err: unknown,
  fallback = "Não foi possível carregar os dados. Tente novamente."
): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Sessão expirada. Faça login novamente.";
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
