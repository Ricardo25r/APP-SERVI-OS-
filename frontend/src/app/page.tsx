"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/services/api";

type HealthStatus = "loading" | "online" | "offline";

export default function HomePage() {
  const [status, setStatus] = useState<HealthStatus>("loading");

  useEffect(() => {
    let active = true;

    const controller = new AbortController();
    fetch(`${API_URL}/api/v1/health`, { signal: controller.signal })
      .then((res) => {
        if (active) setStatus(res.ok ? "online" : "offline");
      })
      .catch(() => {
        if (active) setStatus("offline");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const statusLabel: Record<HealthStatus, string> = {
    loading: "Verificando conexão com a API...",
    online: "API conectada",
    offline: "API indisponível",
  };

  const statusColor: Record<HealthStatus, string> = {
    loading: "bg-muted-foreground",
    online: "bg-green-500",
    offline: "bg-destructive",
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
        <span className="text-primary">Faz</span>
        <span className="text-brand">Tudo</span>
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        Marketplace de prestadores de serviços locais
      </p>

      <Button size="lg">Começar</Button>

      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor[status]}`}
          aria-hidden
        />
        <span>{statusLabel[status]}</span>
      </div>
    </main>
  );
}
