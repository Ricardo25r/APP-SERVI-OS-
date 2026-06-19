/**
 * Hooks React Query da feature de PAGAMENTOS (Fase 6).
 *
 * - `usePackages`: catálogo de pacotes ativos (`GET /payments/packages`).
 * - `useCreateOrder`: cria o pedido (`POST /payments/orders`).
 * - `useDevConfirm`: confirma o pagamento simulado e **invalida** saldo,
 *   histórico e pedidos para refletir o novo saldo na UI.
 *
 * As query keys de créditos (`['credits','balance']`, `['credits','history']`)
 * são compartilhadas para que a confirmação atualize o `BalanceCard` e o
 * histórico exibidos na própria `/credits`.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createOrder, devConfirm, fetchPackages } from "./api";
import type { CreditPackage, DevConfirmEvent, PaymentOrder } from "./types";

/** Query keys reutilizáveis (créditos + pagamentos). */
export const PAYMENTS_KEYS = {
  packages: ["payments", "packages"] as const,
  orders: ["payments", "orders"] as const,
};

export const CREDITS_KEYS = {
  balance: ["credits", "balance"] as const,
  history: ["credits", "history"] as const,
};

/** Catálogo público de pacotes de créditos (ativos). */
export function usePackages() {
  return useQuery<CreditPackage[]>({
    queryKey: PAYMENTS_KEYS.packages,
    queryFn: fetchPackages,
    staleTime: 5 * 60 * 1000,
  });
}

/** Cria um pedido a partir de um `package_id`. */
export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation<PaymentOrder, unknown, string>({
    mutationFn: (packageId: string) => createOrder(packageId),
    onSuccess: () => {
      // Um novo pedido entra no histórico de pedidos.
      void queryClient.invalidateQueries({ queryKey: PAYMENTS_KEYS.orders });
    },
  });
}

/**
 * Confirma o pagamento simulado (modo dev). Ao sucesso, invalida saldo,
 * histórico de transações e pedidos — o `BalanceCard` re-busca o novo saldo.
 */
export function useDevConfirm() {
  const queryClient = useQueryClient();
  return useMutation<
    PaymentOrder,
    unknown,
    { orderId: string; event?: DevConfirmEvent }
  >({
    mutationFn: ({ orderId, event = "paid" }) => devConfirm(orderId, event),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CREDITS_KEYS.balance });
      void queryClient.invalidateQueries({ queryKey: CREDITS_KEYS.history });
      void queryClient.invalidateQueries({ queryKey: PAYMENTS_KEYS.orders });
    },
  });
}
