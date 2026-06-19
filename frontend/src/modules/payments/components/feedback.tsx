/**
 * Pequenos componentes de feedback locais à feature de PAGAMENTOS:
 * banner de erro (ApiError-friendly) e banner de sucesso. Mantidos locais ao
 * módulo para não acoplar a outras features nem inflar `components/ui`.
 */
"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api";

/** Extrai uma mensagem amigável (PT-BR) de um erro desconhecido. */
export function errorMessage(
  error: unknown,
  fallback = "Algo deu errado. Tente novamente."
): string {
  if (error instanceof ApiError) {
    if (error.message && error.message.trim().length > 0) return error.message;
    if (error.status === 401) return "Sessão expirada. Faça login novamente.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function ErrorBanner({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive",
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function SuccessBanner({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400",
        className
      )}
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
