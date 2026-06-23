/**
 * `OrderPanel` — painel exibido após criar um pedido (`POST /payments/orders`).
 *
 * Mostra o status (`pending`), o `pix_code` (com botão copiar) e/ou o
 * `checkout_url`. Em **modo dev** (`NEXT_PUBLIC_PAYMENT_PROVIDER === "dev"` ou
 * indefinido) exibe o botão "Confirmar pagamento (simulado)" deixando claro que
 * é simulação (pagamento real = Fase 6 com gateway).
 *
 * Não é um modal (o projeto não tem componente Dialog) — renderiza inline,
 * abaixo do catálogo, e pode ser fechado pelo usuário.
 */
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Loader2, X } from "lucide-react";

import { apiGet } from "@/services/api";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useDevConfirm } from "../hooks";
import type { PaymentOrder, PaymentSettings } from "../types";
import {
  formatBRLFromCents,
  isDevPaymentProvider,
  isManualPixProvider,
  paymentOrderStatusMeta,
} from "../utils";
import { ErrorBanner, SuccessBanner, errorMessage } from "./feedback";

interface OrderPanelProps {
  order: PaymentOrder;
  /** Chamado quando o usuário fecha o painel. */
  onClose: () => void;
  /** Chamado após confirmar o pagamento simulado com sucesso (status `paid`). */
  onConfirmed?: (order: PaymentOrder) => void;
}

export function OrderPanel({ order, onClose, onConfirmed }: OrderPanelProps) {
  const devMode = isDevPaymentProvider();
  const manualMode = isManualPixProvider();
  const confirm = useDevConfirm();
  const [current, setCurrent] = useState<PaymentOrder>(order);
  const [copied, setCopied] = useState(false);

  const statusMeta = paymentOrderStatusMeta(current.status);
  const isPaid = current.status === "paid";

  const { data: payInfo } = useQuery({
    queryKey: ["payment-info"],
    queryFn: () => apiGet<PaymentSettings>("/payments/payment-info"),
    enabled: manualMode && !isPaid,
    staleTime: 60_000,
  });

  async function handleCopy() {
    if (!current.pix_code) return;
    try {
      await navigator.clipboard.writeText(current.pix_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível (contexto inseguro): ignora silenciosamente.
    }
  }

  function handleConfirm() {
    confirm.mutate(
      { orderId: current.id, event: "paid" },
      {
        onSuccess: (updated) => {
          setCurrent(updated);
          onConfirmed?.(updated);
        },
      }
    );
  }

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-lg">Pedido criado</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            <span className="text-sm text-muted-foreground tabular-nums">
              {current.credits} créditos ·{" "}
              {formatBRLFromCents(current.amount_cents, current.currency)}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {isPaid ? (
          <SuccessBanner message="Pagamento confirmado! Seus créditos foram adicionados ao saldo." />
        ) : (
          <>
            {current.pix_code && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">PIX copia-e-cola</p>
                <div className="flex items-stretch gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    {current.pix_code}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopy()}
                  >
                    {copied ? (
                      <>
                        <Check className="mr-1.5 h-4 w-4" aria-hidden />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {current.checkout_url && !devMode && (
              <div className="space-y-1.5">
                <a
                  href={current.checkout_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "w-full gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
                  )}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Pagar com Pix ou cartão
                </a>
                <p className="text-center text-xs text-muted-foreground">
                  Você vai para o ambiente seguro do Mercado Pago. O saldo é
                  creditado automaticamente após a confirmação.
                </p>
              </div>
            )}

            {current.checkout_url && devMode && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Checkout</p>
                <a
                  href={current.checkout_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Abrir página de pagamento
                </a>
              </div>
            )}

            {manualMode && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
                <p className="font-medium text-foreground">
                  Pague{" "}
                  {formatBRLFromCents(current.amount_cents, current.currency)} via
                  Pix ou transferência:
                </p>
                {payInfo ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {payInfo.pix_key ? (
                      <p>
                        <span className="font-semibold text-foreground">Pix:</span>{" "}
                        {payInfo.pix_key}
                        {payInfo.pix_key_type ? ` (${payInfo.pix_key_type})` : ""}
                      </p>
                    ) : null}
                    {payInfo.recipient_name ? (
                      <p>
                        <span className="font-semibold text-foreground">
                          Recebedor:
                        </span>{" "}
                        {payInfo.recipient_name}
                      </p>
                    ) : null}
                    {payInfo.bank_name ? (
                      <p>
                        <span className="font-semibold text-foreground">
                          Banco:
                        </span>{" "}
                        {payInfo.bank_name}
                        {payInfo.bank_agency
                          ? ` · Ag. ${payInfo.bank_agency}`
                          : ""}
                        {payInfo.bank_account
                          ? ` · Conta ${payInfo.bank_account}`
                          : ""}
                        {payInfo.bank_account_type
                          ? ` (${payInfo.bank_account_type})`
                          : ""}
                      </p>
                    ) : null}
                    {payInfo.holder_name ? (
                      <p>
                        <span className="font-semibold text-foreground">
                          Titular:
                        </span>{" "}
                        {payInfo.holder_name}
                        {payInfo.holder_document
                          ? ` (${payInfo.holder_document})`
                          : ""}
                      </p>
                    ) : null}
                    {payInfo.instructions ? (
                      <p className="pt-1">{payInfo.instructions}</p>
                    ) : null}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Depois de pagar, envie o comprovante pelo{" "}
                  <a
                    href="/suporte"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Suporte
                  </a>
                  . Seus créditos são liberados após a confirmação.
                </p>
              </div>
            )}

            {devMode && (
              <div className="space-y-3 rounded-md border border-dashed bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">
                  Modo de desenvolvimento: o pagamento é{" "}
                  <strong>simulado</strong>. Em produção, o saldo será creditado
                  automaticamente após a confirmação do gateway (PIX/cartão).
                </p>

                {confirm.isError && (
                  <ErrorBanner
                    message={errorMessage(
                      confirm.error,
                      "Não foi possível confirmar o pagamento simulado."
                    )}
                  />
                )}

                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirm.isPending}
                >
                  {confirm.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Confirmar pagamento (simulado)
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
