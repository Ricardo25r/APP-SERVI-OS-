"use client";

import { Button } from "@/components/ui/button";

/**
 * Modal de confirmação simples (overlay nativo, sem libs externas).
 * Usado pelas ações destrutivas/ sensíveis do painel admin (bloquear usuário,
 * cancelar lead, desativar categoria). Renderizado apenas quando `open`.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** Conteúdo extra (ex.: campo de motivo). */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "default" | "destructive";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Voltar",
  confirmVariant = "default",
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg border bg-card p-6 text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? "Aguarde..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
