"use client";

/**
 * `SubscriptionSettingsForm` — financeiro (admin): configura o plano de
 * assinatura (Plano PRO). Liga/desliga a modalidade + edita preço, créditos,
 * desconto e trial. Salva em `subscription_settings` (backend, #56).
 *
 * Entregue DESLIGADO: enquanto `enabled` for false, nada aparece para o
 * profissional — o dono ajusta os valores e liga quando quiser, sem deploy.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { apiGet, apiPut } from "@/services/api";

interface SubscriptionSettings {
  enabled: boolean;
  plan_name: string;
  price_cents: number;
  included_credits: number;
  discount_pct: number;
  trial_days: number;
  trial_credits: number;
}

const KEY = ["admin", "subscription-settings"] as const;

const NUM_FIELDS: ReadonlyArray<{
  key: keyof SubscriptionSettings;
  label: string;
  hint?: string;
}> = [
  { key: "price_cents", label: "Preço mensal (centavos)", hint: "4990 = R$ 49,90" },
  { key: "included_credits", label: "Créditos inclusos por mês" },
  { key: "discount_pct", label: "Desconto no crédito avulso (%)" },
  { key: "trial_days", label: "Dias de teste grátis" },
  { key: "trial_credits", label: "Créditos de cortesia do teste" },
];

export function SubscriptionSettingsForm() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: () =>
      apiGet<SubscriptionSettings>("/payments/subscription-settings"),
  });
  const [form, setForm] = useState<SubscriptionSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: SubscriptionSettings) =>
      apiPut<SubscriptionSettings>("/payments/subscription-settings", payload),
    onSuccess: (res) => {
      setForm(res);
      setSaved(true);
      void qc.invalidateQueries({ queryKey: KEY });
      window.setTimeout(() => setSaved(false), 2500);
    },
  });

  if (isLoading || !form) {
    return (
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Assinatura (Plano PRO)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Plano recorrente do profissional. Ajuste os valores e ligue quando
            quiser — enquanto desligado, nada aparece para o profissional.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <ToggleSwitch
            checked={form.enabled}
            onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            label="Assinatura habilitada"
          />
          <span
            className={
              form.enabled
                ? "text-xs font-semibold text-success"
                : "text-xs font-medium text-muted-foreground"
            }
          >
            {form.enabled ? "Ligada" : "Desligada"}
            {data && form.enabled !== data.enabled ? " (não salvo)" : ""}
          </span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ss-name">Nome do plano</Label>
          <Input
            id="ss-name"
            value={form.plan_name}
            onChange={(e) => setForm({ ...form, plan_name: e.target.value })}
          />
        </div>
        {NUM_FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`ss-${key}`}>{label}</Label>
            <Input
              id={`ss-${key}`}
              type="number"
              min={0}
              value={String(form[key] ?? 0)}
              onChange={(e) =>
                setForm({
                  ...form,
                  [key]: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
            {hint ? (
              <p className="text-xs text-muted-foreground">{hint}</p>
            ) : null}
          </div>
        ))}
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            )}
            Salvar
          </Button>
          {saved && <span className="text-sm text-success">Salvo!</span>}
          {!saved &&
          data &&
          JSON.stringify(form) !== JSON.stringify(data) ? (
            <span className="text-sm font-medium text-muted-foreground">
              Alterações não salvas — clique em Salvar.
            </span>
          ) : null}
          {save.isError && (
            <span className="text-sm text-destructive">Falha ao salvar.</span>
          )}
        </div>
      </form>
    </div>
  );
}
