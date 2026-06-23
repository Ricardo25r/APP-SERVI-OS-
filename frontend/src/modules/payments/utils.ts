/**
 * Utilitários da feature de PAGAMENTOS (Fase 6).
 *
 * - `formatBRLFromCents`: formata um valor em **centavos** (inteiro) como BRL
 *   (ex.: 1990 → "R$ 19,90"). Nunca somar/exibir float cru — o backend é a
 *   fonte da verdade do preço (sempre em centavos).
 * - `isDevPaymentProvider`: detecta o modo dev (botão "Confirmar pagamento
 *   simulado"), espelhando `NEXT_PUBLIC_PAYMENT_PROVIDER`.
 * - `paymentOrderStatusMeta`: rótulo + variante de Badge por status do pedido.
 */

import type { PaymentOrderStatus } from "./types";

/**
 * Formata centavos (inteiro) como moeda BRL: 1990 → "R$ 19,90".
 *
 * @param cents valor em centavos (price_cents/amount_cents do backend).
 * @param currency código ISO-4217 (default "BRL").
 */
export function formatBRLFromCents(cents: number, currency = "BRL"): string {
  const value = (Number.isFinite(cents) ? cents : 0) / 100;
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    // currency inválida → fallback simples mantendo 2 casas.
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }
}

/**
 * Indica se o front está em modo de pagamento simulado (dev).
 * Mostra o botão "Confirmar pagamento (simulado)" quando
 * `NEXT_PUBLIC_PAYMENT_PROVIDER === "dev"` OU a variável estiver indefinida.
 */
export function isDevPaymentProvider(): boolean {
  const provider = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER;
  return provider === undefined || provider === "" || provider === "dev";
}

/** Indica o modo **Pix manual** (sem gateway) — confirmação feita pelo admin. */
export function isManualPixProvider(): boolean {
  return process.env.NEXT_PUBLIC_PAYMENT_PROVIDER === "manual_pix";
}

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success";

interface OrderStatusMeta {
  label: string;
  variant: BadgeVariant;
}

/** Rótulo (PT-BR) + variante de Badge para o status do pedido. */
export function paymentOrderStatusMeta(
  status: PaymentOrderStatus
): OrderStatusMeta {
  const byStatus: Record<PaymentOrderStatus, OrderStatusMeta> = {
    pending: { label: "Aguardando pagamento", variant: "secondary" },
    paid: { label: "Pago", variant: "success" },
    failed: { label: "Falhou", variant: "destructive" },
    refunded: { label: "Reembolsado", variant: "outline" },
    cancelled: { label: "Cancelado", variant: "outline" },
  };
  return byStatus[status] ?? { label: status, variant: "outline" };
}
