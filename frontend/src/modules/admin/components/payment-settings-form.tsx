"use client";

/**
 * `PaymentSettingsForm` — financeiro (admin): dados de recebimento (Pix/banco)
 * que o comprador vê para pagar os créditos. Salva em `payment_settings` (backend).
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentSettings } from "@/modules/payments/types";

import { fetchPaymentSettings, updatePaymentSettings } from "../api";
import { adminErrorMessage } from "../utils";

const EMPTY: PaymentSettings = {
  pix_key: null,
  pix_key_type: null,
  recipient_name: null,
  bank_name: null,
  bank_agency: null,
  bank_account: null,
  bank_account_type: null,
  holder_name: null,
  holder_document: null,
  instructions: null,
};

const FIELDS: ReadonlyArray<{ key: keyof PaymentSettings; label: string }> = [
  { key: "recipient_name", label: "Nome do recebedor" },
  { key: "pix_key", label: "Chave Pix" },
  { key: "pix_key_type", label: "Tipo da chave (CPF, telefone, e-mail, aleatória)" },
  { key: "bank_name", label: "Banco" },
  { key: "bank_agency", label: "Agência" },
  { key: "bank_account", label: "Conta (com dígito)" },
  { key: "bank_account_type", label: "Tipo de conta (corrente/poupança)" },
  { key: "holder_name", label: "Titular da conta" },
  { key: "holder_document", label: "CPF/CNPJ do titular" },
];

export function PaymentSettingsForm() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payment-settings"],
    queryFn: fetchPaymentSettings,
  });
  const [form, setForm] = useState<PaymentSettings>(EMPTY);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...EMPTY, ...data });
  }, [data]);

  const save = useMutation({
    mutationFn: () => updatePaymentSettings(form),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({
        queryKey: ["admin", "payment-settings"],
      });
      window.setTimeout(() => setSaved(false), 2500);
    },
  });

  function set(key: keyof PaymentSettings, value: string) {
    setForm((f) => ({ ...f, [key]: value || null }));
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Dados de recebimento</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        O comprador vê estes dados (Pix e/ou banco) para pagar os créditos. Depois
        de receber, confirme o pedido na lista abaixo.
      </p>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando...
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`ps-${key}`}>{label}</Label>
              <Input
                id={`ps-${key}`}
                value={form[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ps-instructions">Instruções (opcional)</Label>
            <textarea
              id="ps-instructions"
              value={form.instructions ?? ""}
              onChange={(e) => set("instructions", e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              )}
              Salvar dados
            </Button>
            {saved && <span className="text-sm text-success">Salvo!</span>}
            {save.isError && (
              <span className="text-sm text-destructive">
                {adminErrorMessage(save.error, "Falha ao salvar.")}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
