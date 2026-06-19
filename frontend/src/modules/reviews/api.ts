/**
 * Camada de acesso à API para **Avaliações** (Fase 7).
 *
 * Encapsula as chamadas a `/reviews/*` e normaliza respostas que podem vir
 * paginadas (`{items,...}`) ou como lista crua — ambas tratadas defensivamente.
 *
 * Endpoints (Bearer injetado automaticamente por `@/services/api`):
 * - `GET  /reviews/me/pending`  → leads que o usuário ainda pode avaliar.
 * - `POST /reviews/`            → cria avaliação ({lead_id, score, comment?}).
 * - `GET  /reviews/{user_id}`   → avaliações recebidas por um usuário.
 */

import { apiGet, apiPost } from "@/services/api";

import type {
  CreateReviewInput,
  PendingReviewItem,
  ReceivedReview,
  ReceivedReviewsResponse,
} from "./types";

/**
 * Extrai a lista de itens de uma resposta que pode ser:
 * - um array cru `T[]`;
 * - um envelope paginado `{ items: T[], ... }`.
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

/** Leads que o usuário logado ainda pode avaliar. */
export async function fetchPending(): Promise<PendingReviewItem[]> {
  const data = await apiGet<unknown>("/reviews/me/pending");
  return unwrapList<PendingReviewItem>(data);
}

/** Cria uma avaliação. Pode lançar `ApiError` (403/409/422). */
export function createReview(input: CreateReviewInput): Promise<unknown> {
  const body: CreateReviewInput = {
    lead_id: input.lead_id,
    score: input.score,
  };
  const comment = input.comment?.trim();
  if (comment) body.comment = comment;
  return apiPost<unknown>("/reviews/", body);
}

/** Avaliações RECEBIDAS por um usuário (`GET /reviews/{user_id}`). */
export async function fetchUserReviews(
  userId: string
): Promise<ReceivedReview[]> {
  const data = await apiGet<
    ReceivedReviewsResponse | ReceivedReview[]
  >(`/reviews/${userId}`);
  return unwrapList<ReceivedReview>(data);
}
