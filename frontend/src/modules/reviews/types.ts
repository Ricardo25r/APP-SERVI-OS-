/**
 * Tipos da feature de **Avaliações** (Fase 7).
 *
 * Espelham, de forma defensiva, os schemas do backend para os endpoints de
 * reviews. Como o contrato exato dos itens "pendentes" pode variar, modelamos
 * os campos opcionais e os usamos sempre com fallback.
 */

import type { Paginated } from "@/types";

/** Nota de uma avaliação (1 a 5 estrelas). */
export type ReviewScore = 1 | 2 | 3 | 4 | 5;

/**
 * Autor de uma avaliação recebida. O backend pode aninhar os dados em
 * `author`/`reviewer` ou expô-los inline — tratamos ambos defensivamente.
 */
export interface ReviewAuthor {
  id?: string;
  name?: string;
}

/** Uma avaliação RECEBIDA por um usuário (`GET /reviews/{user_id}`). */
export interface ReceivedReview {
  id?: string;
  score: number;
  comment?: string | null;
  created_at: string;
  /** Autor pode vir aninhado... */
  author?: ReviewAuthor | null;
  reviewer?: ReviewAuthor | null;
  /** ...ou inline. */
  author_name?: string | null;
  reviewer_name?: string | null;
}

/** Resposta paginada de avaliações recebidas. */
export type ReceivedReviewsResponse = Paginated<ReceivedReview>;

/**
 * Item retornado por `GET /reviews/me/pending` — um lead que o usuário ainda
 * pode avaliar. O formato exato é incerto; mantemos `lead_id` como único campo
 * garantido e capturamos o resto defensivamente.
 */
export interface PendingReviewItem {
  lead_id: string;
  /** Dados do lead (quando o backend os incluir). */
  lead?: {
    id?: string;
    title?: string | null;
    category?: { name?: string | null } | null;
  } | null;
  /** Título do lead pode também vir inline. */
  lead_title?: string | null;
  /** Contraparte a ser avaliada (nome pode vir aninhado ou inline). */
  counterparty?: { id?: string; name?: string | null } | null;
  counterparty_name?: string | null;
  professional?: { id?: string; name?: string | null } | null;
  customer?: { id?: string; name?: string | null } | null;
}

/** Body de criação de avaliação (`POST /reviews/`). */
export interface CreateReviewInput {
  lead_id: string;
  score: number;
  comment?: string;
}
