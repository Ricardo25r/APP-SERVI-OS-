"use client";

/**
 * `ReportButton` — botão + diálogo de denúncia reutilizável (exigência das app
 * stores p/ conteúdo de usuário). Envia `POST /reports` com o alvo
 * (user/lead/message/review), o motivo e uma descrição opcional.
 */

import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { apiPost } from "@/services/api";
import { cn } from "@/lib/utils";

type TargetType = "user" | "lead" | "message" | "review";

const REASONS: { value: string; label: string }[] = [
  { value: "golpe", label: "Golpe ou fraude" },
  { value: "assedio", label: "Assédio ou ofensa" },
  { value: "conteudo", label: "Conteúdo impróprio" },
  { value: "perfil_falso", label: "Perfil falso" },
  { value: "spam", label: "Spam" },
  { value: "outro", label: "Outro" },
];

interface ReportButtonProps {
  targetType: TargetType;
  targetId: string;
  label?: string;
  className?: string;
}

export function ReportButton({
  targetType,
  targetId,
  label = "Denunciar",
  className,
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("golpe");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setReason("golpe");
    setDescription("");
    setDone(false);
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("/reports", {
        target_type: targetType,
        target_id: targetId,
        reason,
        description: description.trim() || null,
      });
      setDone(true);
    } catch {
      setError("Não foi possível enviar a denúncia. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive",
          className
        )}
      >
        <Flag className="h-3.5 w-3.5" aria-hidden />
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Denunciar"
        >
          <div className="w-full max-w-md rounded-2xl border bg-card p-5 text-card-foreground shadow-lg">
            {done ? (
              <div className="space-y-3 text-center">
                <p className="text-base font-bold text-foreground">
                  Denúncia enviada
                </p>
                <p className="text-sm text-muted-foreground">
                  Obrigado. Nossa equipe vai analisar. Em caso de risco,
                  acione também as autoridades.
                </p>
                <Button onClick={close} className="w-full">
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-foreground">
                  Denunciar
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Conte o que aconteceu. Denúncias são confidenciais.
                </p>
                <div className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="report-reason">Motivo</Label>
                    <Select
                      id="report-reason"
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
                    <Label htmlFor="report-desc">Detalhes (opcional)</Label>
                    <textarea
                      id="report-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="Descreva o ocorrido..."
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
                  <Button
                    onClick={() => void submit()}
                    disabled={busy}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    Enviar denúncia
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
