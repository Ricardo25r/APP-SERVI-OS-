/**
 * Exibição de erro de formulário (acessível via `role="alert"`).
 *
 * - `FormError`: banner de erro geral do formulário (ex.: falha da API).
 * - `FieldError`: mensagem de erro associada a um campo específico.
 */
import * as React from "react";

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

export function FieldError({
  id,
  message,
}: {
  id?: string;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}
