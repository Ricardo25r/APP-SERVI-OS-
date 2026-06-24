"use client";

/**
 * `DisputeButton` — o profissional contesta um pedido comprado (telefone
 * inválido, cliente não responde, pedido falso) e pede reembolso, sem precisar
 * de GPS. `POST /disputes`. O admin reembolsa ou recusa.
 */

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { apiPost } from "@/services/api";

const REASONS: { value: string; label: string }[] = [
  { value: "sem_resposta", label: "Cliente não responde" },
  { value: "telefone_invalido", label: "Telefone/contato inválido" },
  { value: "pedido_falso", label: "Pedido falso ou teste" },
  { value: "duplicado", label: "Pedido duplicado" },
  { value: "outro", label: "Outro motivo" },
];

export function DisputeButton({ purchaseId }: { purchaseId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("sem_resposta");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setReason("sem_resposta");
    setDescription("");
    setDone(false);
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("/disputes", {
        purchase_id: purchaseId,
        reason,
        description: description.trim() || null,
      });
      setDone(true);
    } catch {
      setError(
        "Não foi possível abrir a disputa. Talvez já exista uma para este pedido."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
      >
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Reportar problema / pedir reembolso
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Disputar pedido"
        >
          <div className="w-full max-w-md rounded-2xl border bg-card p-5 text-card-foreground shadow-lg">
            {done ? (
              <div className="space-y-3 text-center">
                <p className="text-base font-bold text-foreground">
                  Disputa enviada
                </p>
                <p className="text-sm text-muted-foreground">
                  Vamos analisar e, se for o caso, devolver o crédito à sua
                  carteira. Você será avisado.
                </p>
                <Button onClick={close} className="w-full">
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-foreground">
                  Reportar problema com o pedido
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Se o lead foi ruim, peça o reembolso do crédito.
                </p>
                <div className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dispute-reason">Motivo</Label>
                    <Select
                      id="dispute-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    >
                      {REASONS.map((r) => (
                        <SelectOption key={r.value} value={r.value}>
                          {r.label}
                        </SelectOption>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dispute-desc">Detalhes (opcional)</Label>
                    <textarea
                      id="dispute-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="O que aconteceu?"
                      className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  {error ? (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={close} disabled={busy}>
                    Cancelar
                  </Button>
                  <Button onClick={() => void submit()} disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    Enviar disputa
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
