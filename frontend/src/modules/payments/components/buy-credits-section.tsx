/**
 * `BuyCreditsSection` — seção "Comprar créditos" da tela `/credits` (Fase 6).
 *
 * - Lista os pacotes ativos (`GET /payments/packages`) como cards.
 * - "Comprar" cria um pedido (`POST /payments/orders`) e exibe o `OrderPanel`
 *   com o PIX/checkout e, em modo dev, o botão "Confirmar pagamento (simulado)".
 * - Ao confirmar, as queries de saldo/histórico/pedidos são invalidadas pelos
 *   hooks (`useDevConfirm`) → o `BalanceCard` da página re-busca o novo saldo.
 *
 * Estados de loading e erros (ApiError) são tratados em cada etapa.
 */
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useCreateOrder, usePackages } from "../hooks";
import type { CreditPackage, PaymentOrder } from "../types";
import { isDevPaymentProvider } from "../utils";
import { ErrorBanner, errorMessage } from "./feedback";
import { OrderPanel } from "./order-panel";
import { PackageCard } from "./package-card";

/** Chamado quando uma compra é confirmada (modo dev) — para o pai recarregar. */
interface BuyCreditsSectionProps {
  onPaid?: () => void;
  className?: string;
}

export function BuyCreditsSection({ onPaid, className }: BuyCreditsSectionProps) {
  const packagesQuery = usePackages();
  const createOrder = useCreateOrder();
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);

  function handleBuy(pkg: CreditPackage) {
    setPendingPackageId(pkg.id);
    createOrder.mutate(pkg.id, {
      onSuccess: (created) => {
        setOrder(created);
      },
      onSettled: () => {
        setPendingPackageId(null);
      },
    });
  }

  const packages = packagesQuery.data ?? [];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-xl">Comprar créditos</CardTitle>
        <CardDescription>
          Escolha um pacote e pague via PIX para adicionar créditos à sua
          carteira.
          {isDevPaymentProvider() && (
            <>
              {" "}
              <span className="font-medium">
                (Ambiente de testes: pagamento simulado.)
              </span>
            </>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {packagesQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-lg bg-muted/50"
              />
            ))}
          </div>
        ) : packagesQuery.isError ? (
          <div className="space-y-3">
            <ErrorBanner
              message={errorMessage(
                packagesQuery.error,
                "Não foi possível carregar os pacotes."
              )}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void packagesQuery.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : packages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum pacote disponível no momento.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onBuy={handleBuy}
                  loading={
                    createOrder.isPending && pendingPackageId === pkg.id
                  }
                  disabled={createOrder.isPending}
                />
              ))}
            </div>

            {createOrder.isError && (
              <ErrorBanner
                message={errorMessage(
                  createOrder.error,
                  "Não foi possível criar o pedido."
                )}
              />
            )}
          </>
        )}

        {order && (
          <OrderPanel
            order={order}
            onClose={() => setOrder(null)}
            onConfirmed={() => onPaid?.()}
          />
        )}
      </CardContent>
    </Card>
  );
}
