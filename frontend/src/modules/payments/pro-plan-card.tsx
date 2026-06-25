"use client";

/**
 * `ProPlanCard` — assinatura (Plano PRO) na tela de créditos do profissional (#56).
 *
 * Aparece SÓ quando o admin habilitou a modalidade (`enabled`, lido em runtime
 * de `GET /payments/subscription`) e NÃO no app Android (política do Google Play
 * — assinatura/pagamento só no site/PWA). Mostra o plano + benefícios e leva ao
 * checkout do Mercado Pago; se já é PRO, mostra o status + cancelar.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIsNativeApp } from "@/hooks/use-native-app";
import { ApiError, apiGet, apiPost } from "@/services/api";

interface SubscriptionInfo {
  enabled: boolean;
  plan_name: string;
  price_cents: number;
  included_credits: number;
  discount_pct: number;
  trial_days: number;
  trial_credits: number;
  is_pro: boolean;
  status: string | null;
  current_period_end: string | null;
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ProPlanCard() {
  const qc = useQueryClient();
  const isNativeApp = useIsNativeApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => apiGet<SubscriptionInfo>("/payments/subscription"),
  });

  // Google Play: nada de assinatura/pagamento dentro do app Android.
  if (isNativeApp) return null;
  // Desligado pelo admin → some; mas um assinante ATIVO ainda vê o card (para
  // poder cancelar) mesmo que o admin tenha desligado a oferta para novos.
  if (!data || (!data.enabled && !data.is_pro)) return null;

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ checkout_url: string }>(
        "/payments/subscription/subscribe",
        {}
      );
      if (res?.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Não foi possível assinar agora. Tente novamente."
      );
    }
    setBusy(false);
  }

  async function cancel() {
    if (!window.confirm("Cancelar sua assinatura PRO?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost("/payments/subscription/cancel", {});
      await qc.invalidateQueries({ queryKey: ["subscription", "me"] });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Não foi possível cancelar agora. Tente novamente."
      );
    } finally {
      setBusy(false);
    }
  }

  const benefits = [
    `${data.included_credits} créditos por mês`,
    `${data.discount_pct}% de desconto no crédito avulso`,
    "Selo PRO no seu perfil",
    "Você aparece no topo da lista de profissionais",
  ];

  if (data.is_pro) {
    return (
      <Card className="border-brand/30 bg-brand/5">
        <CardContent className="space-y-3 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-brand" aria-hidden />
            <h2 className="text-lg font-bold text-foreground">
              Você é {data.plan_name}
            </h2>
          </div>
          <ul className="space-y-1.5">
            {benefits.map((b) => (
              <li
                key={b}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void cancel()}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Cancelar assinatura
          </Button>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-brand" aria-hidden />
            <h2 className="text-lg font-bold text-foreground">
              {data.plan_name}
            </h2>
          </div>
          <p className="text-right leading-tight">
            <span className="text-2xl font-extrabold tracking-tight text-foreground">
              {brl(data.price_cents)}
            </span>
            <span className="text-sm text-muted-foreground">/mês</span>
          </p>
        </div>
        {data.trial_days > 0 ? (
          <p className="text-sm font-medium text-success">
            {data.trial_days} dias grátis para testar
          </p>
        ) : null}
        <ul className="space-y-1.5">
          {benefits.map((b) => (
            <li
              key={b}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
              {b}
            </li>
          ))}
        </ul>
        <Button
          className="w-full gap-1.5"
          disabled={busy}
          onClick={() => void subscribe()}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Crown className="h-4 w-4" aria-hidden />
          )}
          Assinar o {data.plan_name}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
