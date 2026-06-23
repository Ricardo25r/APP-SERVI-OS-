/**
 * Tipos da feature de PAGAMENTOS (Fase 6) — espelham os schemas `*Read` do
 * backend (`contrato-fase-6.md` §4.1). Fonte da verdade é sempre o backend.
 *
 * Dinheiro sempre em **centavos** (`price_cents` / `amount_cents`, inteiros);
 * a formatação para BRL é responsabilidade do front (ver `utils.formatBRLFromCents`).
 */

/** Status do pedido de pagamento (`payment_order_status`). */
export type PaymentOrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";

/** `CreditPackageRead` — pacote de créditos do catálogo. */
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  /** Preço em centavos de BRL (ex.: R$ 19,90 → 1990). */
  price_cents: number;
  /** Moeda ISO-4217 (ex.: "BRL"). */
  currency: string;
  active: boolean;
  /** Selo "X% OFF" (marketing). 0 = sem selo. */
  discount_percent?: number;
  /** Destaque "Mais escolhido". */
  is_popular?: boolean;
}

/** `PaymentOrderRead` — pedido de compra de um pacote. */
export interface PaymentOrder {
  id: string;
  package_id: string;
  provider: string;
  /** Valor em centavos (snapshot do pacote). */
  amount_cents: number;
  /** Créditos a serem creditados quando `paid` (snapshot do pacote). */
  credits: number;
  currency: string;
  status: PaymentOrderStatus;
  external_reference: string;
  pix_code: string | null;
  checkout_url: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

/** Evento simulado aceito por `POST /payments/dev/confirm/{id}`. */
export type DevConfirmEvent = "paid" | "failed" | "refunded";

/** `PaymentSettingsRead` — dados de recebimento (Pix/banco) editáveis no admin. */
export interface PaymentSettings {
  pix_key: string | null;
  pix_key_type: string | null;
  recipient_name: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: string | null;
  holder_name: string | null;
  holder_document: string | null;
  instructions: string | null;
}
