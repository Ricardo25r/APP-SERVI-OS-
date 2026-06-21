"use client";

/**
 * Error boundary RAIZ (App Router). Captura erros que escapam do layout raiz —
 * substitui todo o documento, então usa marcação mínima. Também reporta ao
 * painel de monitoramento.
 */

import { useEffect } from "react";

import { reportClientError } from "@/modules/monitoring/report";

export default function GlobalError({
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
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          color: "#0A357D",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
          Algo deu errado
        </h1>
        <p style={{ color: "#555", maxWidth: "28rem" }}>
          Tivemos um problema inesperado. Já registramos o erro para a nossa
          equipe.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            background: "#FF6D00",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.6rem 1.2rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
