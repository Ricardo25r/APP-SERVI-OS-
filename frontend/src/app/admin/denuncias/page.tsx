"use client";

/**
 * Painel admin — **Denúncias** (`/admin/denuncias`).
 *
 * Fila de denúncias de abuso (`GET /reports/admin`). O admin marca como
 * "Analisada" (procede) ou "Descartada". Filtro por status.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet, apiPatch } from "@/services/api";

interface ReportItem {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  reporter_name: string;
  reporter_email: string;
}

const TARGET_LABEL: Record<string, string> = {
  user: "Perfil",
  lead: "Pedido",
  message: "Mensagem",
  review: "Avaliação",
};
const REASON_LABEL: Record<string, string> = {
  golpe: "Golpe ou fraude",
  assedio: "Assédio ou ofensa",
  conteudo: "Conteúdo impróprio",
  perfil_falso: "Perfil falso",
  spam: "Spam",
  outro: "Outro",
};

export default function AdminReportsPage() {
  const auth = useRequireAuth("admin");
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("open");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reports", filter],
    queryFn: () =>
      apiGet<{ items: ReportItem[]; total: number }>(
        `/reports/admin${filter ? `?status=${filter}` : ""}`
      ),
    enabled: auth.isAdmin,
  });

  async function resolve(id: string, status: "reviewed" | "dismissed") {
    await apiPatch(`/reports/admin/${id}`, { status });
    queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
  }

  if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const items = data?.items ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar ao painel
      </Link>
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Denúncias</h1>
        <p className="text-muted-foreground">
          Denúncias de abuso enviadas pelos usuários.
        </p>
      </header>

      <div className="flex gap-2">
        {[
          { v: "open", l: "Abertas" },
          { v: "reviewed", l: "Analisadas" },
          { v: "dismissed", l: "Descartadas" },
          { v: "", l: "Todas" },
        ].map((t) => (
          <Button
            key={t.v}
            size="sm"
            variant={filter === t.v ? "default" : "outline"}
            onClick={() => setFilter(t.v)}
          >
            {t.l}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma denúncia aqui.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div
              key={r.id}
              className="space-y-2 rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {TARGET_LABEL[r.target_type] ?? r.target_type}
                </Badge>
                <Badge variant="destructive">
                  {REASON_LABEL[r.reason] ?? r.reason}
                </Badge>
                {r.status !== "open" ? (
                  <Badge variant="secondary">
                    {r.status === "reviewed" ? "Analisada" : "Descartada"}
                  </Badge>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              {r.description ? (
                <p className="text-sm text-foreground">{r.description}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Por {r.reporter_name} ({r.reporter_email}) · alvo{" "}
                <span className="font-mono">{r.target_id.slice(0, 8)}</span>
              </p>
              {r.status === "open" ? (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => void resolve(r.id, "reviewed")}>
                    Marcar como analisada
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void resolve(r.id, "dismissed")}
                  >
                    Descartar
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
