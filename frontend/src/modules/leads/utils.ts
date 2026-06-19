import { ApiError } from "@/services/api";

/**
 * Converte um erro arbitrário em mensagem PT-BR amigável.
 * Trata casos comuns (403 sem permissão, 404 não encontrado, 422 inválido)
 * preferindo o `detail` do backend quando disponível.
 */
export function describeApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return err.message || "Você não tem permissão para esta ação.";
    }
    if (err.status === 404) {
      return err.message || "Solicitação não encontrada.";
    }
    if (err.status === 422) {
      return err.message || "Dados inválidos. Revise os campos e tente novamente.";
    }
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
