/**
 * Utilitários da feature de Avaliações: extração defensiva de nomes, formatação
 * de data PT-BR e mensagens de erro amigáveis (403/409/422).
 */

import { ApiError } from "@/services/api";

import type { PendingReviewItem, ReceivedReview } from "./types";

/** Nome do autor de uma avaliação recebida (vários formatos possíveis). */
export function reviewAuthorName(review: ReceivedReview): string {
  return (
    review.author?.name ||
    review.reviewer?.name ||
    review.author_name ||
    review.reviewer_name ||
    "Usuário"
  );
}

/** Título do lead de um item pendente (defensivo). */
export function pendingLeadTitle(item: PendingReviewItem): string {
  return item.lead?.title || item.lead_title || "Solicitação";
}

/** Nome da contraparte a ser avaliada (defensivo). */
export function pendingCounterpartyName(
  item: PendingReviewItem
): string | null {
  return (
    item.counterparty?.name ||
    item.counterparty_name ||
    item.professional?.name ||
    item.customer?.name ||
    null
  );
}

/** Categoria do lead pendente, quando disponível. */
export function pendingCategoryName(item: PendingReviewItem): string | null {
  return item.lead?.category?.name || null;
}

/** Formata uma data ISO para o padrão brasileiro (dd/mm/aaaa). */
export function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Converte um erro de criação de avaliação em mensagem PT-BR.
 * Trata 403 (não participou), 409 (já avaliou) e 422 (score inválido).
 */
export function reviewErrorMessage(
  err: unknown,
  fallback = "Não foi possível enviar a avaliação. Tente novamente."
): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return "Você não participou desta negociação e não pode avaliá-la.";
    }
    if (err.status === 409) {
      return "Você já avaliou esta solicitação.";
    }
    if (err.status === 422) {
      return "Nota inválida. Escolha de 1 a 5 estrelas.";
    }
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
