"use client";

/**
 * Error boundary de rota (App Router). Captura erros de runtime de uma tela,
 * **reporta ao painel** e mostra uma mensagem amigável com "Tentar novamente".
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { reportClientError } from "@/modules/monitoring/report";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      name: error.name,
      message: error.message,
      stack: error.stack,
      url: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-7 w-7" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground">
          Tivemos um problema ao carregar esta tela. Já registramos o erro para
          a nossa equipe.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => reset()} className="gap-1.5">
          <RefreshCw className="h-4 w-4" aria-hidden />
          Tentar novamente
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
