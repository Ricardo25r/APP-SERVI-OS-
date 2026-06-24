/**
 * `BuyCreditsSection` — "Comprar créditos" (Tela 05) no estilo da referência:
 * lista de pacotes **selecionável** (radio) com preço por crédito e selo de
 * desconto, seleção de **forma de pagamento** (Pix) e um único CTA
 * "Continuar com Pix" que cria o pedido (`POST /payments/orders`) e abre o
 * `OrderPanel` (PIX + confirmação simulada em dev). Só tokens do design system.
 */
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Loader2, QrCode, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useCreateOrder, usePackages } from "../hooks";
import type { CreditPackage, PaymentOrder } from "../types";
import { isDevPaymentProvider } from "../utils";
import { ErrorBanner, errorMessage } from "./feedback";
import { OrderPanel } from "./order-panel";

interface BuyCreditsSectionProps {
  onPaid?: () => void;
  className?: string;
}

/** Formata centavos (pode ser fracionário) em BRL. */
function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

interface PackageMeta {
  pkg: CreditPackage;
  perCredit: number; // centavos por crédito
  discount: number; // % vs. o pior preço por crédito
  highlight: boolean; // melhor oferta
}

export function BuyCreditsSection({ onPaid, className }: BuyCreditsSectionProps) {
  const packagesQuery = usePackages();
  const createOrder = useCreateOrder();
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const packages = useMemo(
    () =>
      [...(packagesQuery.data ?? [])].sort((a, b) => a.credits - b.credits),
    [packagesQuery.data]
  );

  // Preço por crédito (exibição) + selo de desconto e destaque vindos do backend.
  const metas = useMemo<PackageMeta[]>(
    () =>
      packages.map((pkg) => ({
        pkg,
        perCredit: pkg.price_cents / pkg.credits,
        discount: pkg.discount_percent ?? 0,
        highlight: Boolean(pkg.is_popular),
      })),
    [packages]
  );

  // Seleção padrão: o pacote "mais escolhido" (ou o primeiro).
  useEffect(() => {
    if (selectedId || metas.length === 0) return;
    const def = metas.find((m) => m.highlight) ?? metas[0];
    setSelectedId(def.pkg.id);
  }, [metas, selectedId]);

  function handleContinue() {
    if (!selectedId) return;
    createOrder.mutate(selectedId, {
      onSuccess: (created) => setOrder(created),
    });
  }

  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="text-base font-bold tracking-tight sm:text-lg">
        Escolha um pacote
      </h2>

      {packagesQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
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
      ) : metas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum pacote disponível no momento.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {metas.map(({ pkg, perCredit, discount, highlight }) => {
              const selected = selectedId === pkg.id;
              return (
                <li key={pkg.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(pkg.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected && "border-primary ring-1 ring-primary"
                    )}
                  >
                    <Image
                      src="/brand/moedas.png"
                      alt=""
                      width={48}
                      height={48}
                      className="h-11 w-11 shrink-0 object-contain"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-base font-bold tabular-nums text-foreground">
                          {pkg.credits}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          créditos
                        </span>
                        {highlight ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                            Mais escolhido
                          </span>
                        ) : discount > 0 ? (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                            {discount}% OFF
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {brl(perCredit)} por crédito
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold tabular-nums text-primary">
                        {brl(pkg.price_cents)}
                      </p>
                    </div>

                    <span
                      aria-hidden
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {selected && <Check className="h-3 w-3" aria-hidden />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Forma de pagamento */}
          <div className="space-y-2 pt-2">
            <h2 className="text-base font-bold tracking-tight sm:text-lg">
              Forma de pagamento
            </h2>
            <div className="flex items-center gap-3 rounded-xl border border-primary bg-card p-3 shadow-sm ring-1 ring-primary">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success">
                <QrCode className="h-5 w-5" aria-hidden />
              </span>
              <span className="flex-1 text-sm font-semibold text-foreground">
                Pix
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground">
                <Check className="h-3 w-3" aria-hidden />
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" aria-hidden />
              </span>
              <span className="flex-1 text-sm font-semibold text-foreground">
                Cartão de crédito e boleto
              </span>
              <span className="text-xs font-medium text-success">
                Disponível
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Você escolhe entre Pix, cartão ou boleto na tela segura do Mercado
              Pago.
            </p>
          </div>

          {createOrder.isError && (
            <ErrorBanner
              message={errorMessage(
                createOrder.error,
                "Não foi possível criar o pedido."
              )}
            />
          )}

          {/* Selo de segurança + CTA */}
          <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
            Compra 100% segura — seus dados são protegidos e criptografados.
          </p>

          <Button
            type="button"
            size="lg"
            className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={handleContinue}
            disabled={createOrder.isPending || !selectedId}
          >
            {createOrder.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <QrCode className="h-4 w-4" aria-hidden />
            )}
            Continuar com Pix
          </Button>

          {isDevPaymentProvider() && (
            <p className="text-center text-[11px] text-muted-foreground">
              Ambiente de testes — pagamento simulado.
            </p>
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
    </section>
  );
}
