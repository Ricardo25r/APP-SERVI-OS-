/**
 * Utilitários compartilhados pelas telas de CRÉDITOS (carteira) do profissional.
 *
 * - `formatDateTime` / `formatDate`: datas em PT-BR.
 * - `creditTransactionMeta`: rótulo + sinal + variante de Badge por tipo de
 *   transação (bonus/spend/...).
 * - `formatSignedAmount`: valor com sinal (+/-) conforme o tipo da transação.
 * - `messageFromError`: mensagem amigável (PT-BR) de erros da API.
 */

import { ApiError } from "@/services/api";
import type { CreditTransaction, CreditTransactionType } from "@/types";

/** Formata uma data ISO em `dd/mm/aaaa HH:MM` (PT-BR). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formata uma data ISO em `dd/mm/aaaa` (PT-BR). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success";

interface TransactionMeta {
  /** Rótulo em PT-BR. */
  label: string;
  /** Variante do Badge para o tipo. */
  variant: BadgeVariant;
  /** Se o valor é um crédito (entra na carteira) ou débito (sai). */
  isCredit: boolean;
}

/**
 * Metadados de exibição por tipo de transação. Tipos que não debitam
 * (purchase/bonus/refund/adjustment positivo) entram como crédito; `spend`
 * é débito. Para `adjustment` o sinal real depende do `amount`.
 */
export function creditTransactionMeta(
  tx: CreditTransaction
): TransactionMeta {
  const byType: Record<
    CreditTransactionType,
    Omit<TransactionMeta, "isCredit"> & { isCredit?: boolean }
  > = {
    purchase: { label: "Compra de créditos", variant: "success", isCredit: true },
    bonus: { label: "Bônus", variant: "success", isCredit: true },
    refund: { label: "Reembolso", variant: "secondary", isCredit: true },
    spend: { label: "Compra de lead", variant: "destructive", isCredit: false },
    adjustment: { label: "Ajuste", variant: "outline" },
  };

  const meta = byType[tx.transaction_type] ?? {
    label: tx.transaction_type,
    variant: "outline" as const,
  };

  // Para "adjustment" (ou tipos desconhecidos) inferimos o sinal pelo amount.
  const isCredit =
    meta.isCredit ?? (typeof tx.amount === "number" ? tx.amount >= 0 : true);

  return { label: meta.label, variant: meta.variant, isCredit };
}

/** Valor da transação com sinal explícito (+N / -N). */
export function formatSignedAmount(tx: CreditTransaction): string {
  const meta = creditTransactionMeta(tx);
  const magnitude = Math.abs(tx.amount);
  const sign = meta.isCredit ? "+" : "-";
  return `${sign}${magnitude}`;
}

/** Mensagem de erro amigável (PT-BR) para a área de créditos. */
export function messageFromError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message && error.message.trim().length > 0) {
      return error.message;
    }
    if (error.status === 401) return "Sessão expirada. Faça login novamente.";
    return "Não foi possível carregar seus créditos. Tente novamente.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Ocorreu um erro inesperado. Tente novamente.";
}
