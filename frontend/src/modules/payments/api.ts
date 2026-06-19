/**
 * Chamadas tipadas à API de PAGAMENTOS (Fase 6) — `contrato-fase-6.md` §4.
 *
 * O cliente HTTP (`apiGet`/`apiPost`) já prefixa `/api/v1` e injeta o
 * `Authorization: Bearer <access>`. O front nunca envia `amount`/`credits` —
 * só `package_id` (backend é a fonte da verdade do preço).
 */

import { apiGet, apiPost } from "@/services/api";
import type { Paginated } from "@/types";

import type { CreditPackage, DevConfirmEvent, PaymentOrder } from "./types";

/**
 * `GET /payments/packages` → lista de pacotes ativos.
 * Default (sem `active`) retorna só os ativos, conforme o contrato.
 */
export function fetchPackages(): Promise<CreditPackage[]> {
  return apiGet<CreditPackage[]>("/payments/packages");
}

/**
 * `POST /payments/orders` body `{ package_id }` → pedido criado (status
 * `pending`, com `pix_code`/`checkout_url`/`external_reference`).
 */
export function createOrder(packageId: string): Promise<PaymentOrder> {
  return apiPost<PaymentOrder>("/payments/orders", { package_id: packageId });
}

/**
 * `POST /payments/dev/confirm/{order_id}` (apenas modo dev) → confirma o
 * pagamento simulado. Pode retornar `200` (atualizado) ou `409` se o pedido já
 * não estiver `pending` (ex.: já pago). Default `event="paid"`.
 */
export function devConfirm(
  orderId: string,
  event: DevConfirmEvent = "paid"
): Promise<PaymentOrder> {
  return apiPost<PaymentOrder>(`/payments/dev/confirm/${orderId}`, { event });
}

/**
 * `GET /payments/orders` paginado (pedidos do próprio profissional).
 * Opcional na UI; exposto para reuso futuro / histórico de pedidos.
 */
export function listOrders(params?: {
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<Paginated<PaymentOrder>> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.page) search.set("page", String(params.page));
  if (params?.page_size) search.set("page_size", String(params.page_size));
  const qs = search.toString();
  return apiGet<Paginated<PaymentOrder>>(
    `/payments/orders${qs ? `?${qs}` : ""}`
  );
}
