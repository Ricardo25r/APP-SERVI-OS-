/**
 * Tipos da feature de **Gamificação** (Fase 9).
 *
 * Espelham, de forma defensiva, os schemas do backend para os endpoints de
 * gamificação. Como o contrato exato pode variar (campos opcionais de progresso
 * de nível, respostas paginadas vs. lista crua), modelamos campos opcionais e os
 * usamos sempre com fallback.
 */

/**
 * Uma transação de XP recente (`recent_transactions` em `GET /gamification/me`).
 * `source` é a chave técnica do motivo (ex.: `lead_purchase`, `review_5star`);
 * traduzimos para PT-BR na UI.
 */
export interface XpTransaction {
  amount: number;
  source: string;
  description?: string | null;
  created_at: string;
}

/** Resposta de `GET /gamification/me` — progresso de XP/nível do profissional. */
export interface GamificationMe {
  xp: number;
  level: number;
  level_name?: string | null;
  /** Próximo nível (número), quando houver. Ausente no nível máximo. */
  next_level?: number | null;
  /** Nome do próximo nível, quando o backend o expõe. */
  next_level_name?: string | null;
  /** XP mínimo para alcançar o próximo nível. */
  next_level_xp?: number | null;
  /** XP que ainda falta para o próximo nível (alguns backends já o calculam). */
  xp_for_next_level?: number | null;
  /** XP mínimo do nível atual (para calcular a faixa da barra). */
  level_min_xp?: number | null;
  recent_transactions?: XpTransaction[] | null;
}

/** Um nível na tabela de níveis (`GET /gamification/levels`). */
export interface GamificationLevel {
  level: number;
  name: string;
  min_xp: number;
}

/** Item do ranking (`GET /gamification/ranking`). */
export interface RankingItem {
  user_id?: string | null;
  name?: string | null;
  headline?: string | null;
  city?: string | null;
  state?: string | null;
  xp?: number | null;
  level?: number | null;
  level_name?: string | null;
  rating?: number | null;
}

/** Uma conquista + status do usuário (`GET /gamification/achievements`). */
export interface Achievement {
  slug: string;
  name: string;
  description?: string | null;
  xp_reward: number;
  earned: boolean;
  earned_at?: string | null;
}

export interface AchievementsResponse {
  items: Achievement[];
  earned_count: number;
  total: number;
}

/** Minha posição no ranking (`GET /gamification/ranking/me`). */
export interface MyRank {
  is_ranked: boolean;
  rank: number | null;
  total: number;
  xp: number;
  level: number;
  level_name?: string | null;
}

/** Filtros opcionais do ranking. */
export interface RankingFilters {
  limit?: number;
  city?: string;
  state?: string;
}
