/**
 * Barrel da feature de PAGAMENTOS (Fase 6 — compra de créditos).
 *
 * Reexporta a API pública do módulo para uso na rota `/credits`.
 */

export { BuyCreditsSection } from "./components/buy-credits-section";
export { PackageCard } from "./components/package-card";
export { OrderPanel } from "./components/order-panel";

export {
  fetchPackages,
  createOrder,
  devConfirm,
  listOrders,
} from "./api";
export {
  usePackages,
  useCreateOrder,
  useDevConfirm,
  PAYMENTS_KEYS,
  CREDITS_KEYS,
} from "./hooks";
export {
  formatBRLFromCents,
  isDevPaymentProvider,
  paymentOrderStatusMeta,
} from "./utils";
export type {
  CreditPackage,
  PaymentOrder,
  PaymentOrderStatus,
  DevConfirmEvent,
} from "./types";
