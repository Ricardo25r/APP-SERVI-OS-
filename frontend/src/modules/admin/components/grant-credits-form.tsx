"use client";

/**
 * `GrantCreditsForm` — concessão de créditos a um profissional (admin).
 *
 * Campos: `professional_id` (UUID), valor (inteiro positivo) e descrição
 * opcional. Envia `POST /credits/grant` com `transaction_type: "bonus"`.
 * Mostra feedback de sucesso/erro e limpa o formulário ao concluir.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { grantCredits } from "../api";
import type { GrantCreditsInput } from "../types";
import { adminErrorMessage } from "../utils";

/** Valida UUID v4-ish (formato canônico 8-4-4-4-12). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function GrantCreditsForm() {
  const [professionalId, setProfessionalId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: GrantCreditsInput) => grantCredits(input),
    onSuccess: () => {
      setProfessionalId("");
      setAmount("");
      setDescription("");
      setValidationError(null);
    },
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationError(null);
    mutation.reset();

    const id = professionalId.trim();
    if (!UUID_RE.test(id)) {
      setValidationError("Informe um ID de profissional válido (UUID).");
      return;
    }

    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      setValidationError("Informe um valor inteiro maior que zero.");
      return;
    }

    mutation.mutate({
      professional_id: id,
      amount: value,
      transaction_type: "bonus",
      description: description.trim() || undefined,
    });
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand/10 text-brand">
          <Gift className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Conceder créditos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Crédito de bônus para a carteira do profissional.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="grant-pro-id">ID do profissional (UUID)</Label>
          <Input
            id="grant-pro-id"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="font-mono"
            autoComplete="off"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="grant-amount">Valor (créditos)</Label>
          <Input
            id="grant-amount"
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ex.: 10"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="grant-description">Descrição (opcional)</Label>
          <Textarea
            id="grant-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Motivo da concessão (ex.: bônus de boas-vindas)"
            rows={3}
            maxLength={255}
          />
        </div>

        {validationError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {validationError}
          </p>
        ) : null}

        {mutation.isError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {adminErrorMessage(
              mutation.error,
              "Não foi possível conceder os créditos."
            )}
          </p>
        ) : null}

        {mutation.isSuccess ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-foreground"
          >
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />
            Créditos concedidos com sucesso.
          </p>
        ) : null}

        <Button type="submit" disabled={mutation.isPending} className="gap-1.5">
          <Gift className="h-4 w-4" aria-hidden />
          {mutation.isPending ? "Concedendo..." : "Conceder créditos"}
        </Button>
      </form>
    </div>
  );
}
