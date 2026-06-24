"use client";

/**
 * Painel admin — **Disputas** (`/admin/disputas`).
 *
 * Fila de disputas de pedido abertas pelos profissionais (`GET /disputes/admin`).
 * O admin **Reembolsa** (devolve o crédito) ou **Recusa**.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet, apiPatch } from "@/services/api";

interface DisputeItem {
  id: string;
  purchase_id: string;
  lead_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  professional_user_id: string;
  professional_name: string;
  lead_title: string | null;
  credits_used: number;
}

const REASON_LABEL: Record<string, string> = {
  telefone_invalido: "Telefone inválido",
  sem_resposta: "Cliente não responde",
  pedido_falso: "Pedido falso",
  duplicado: "Duplicado",
  outro: "Outro",
};

export default function AdminDisputesPage() {
  const auth = useRequireAuth("admin");
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("open");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "disputes", filter],
    queryFn: () =>
      apiGet<{ items: DisputeItem[]; total: number }>(
        `/disputes/admin${filter ? `?status=${filter}` : ""}`
      ),
    enabled: auth.isAdmin,
  });

  async function resolve(id: string, action: "refund" | "reject") {
    await apiPatch(`/disputes/admin/${id}`, { action });
    queryClient.invalidateQueries({ queryKey: ["admin", "disputes"] });
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
        <h1 className="text-3xl font-bold tracking-tight">Disputas</h1>
        <p className="text-muted-foreground">
          Pedidos de reembolso de crédito abertos pelos profissionais.
        </p>
      </header>

      <div className="flex gap-2">
        {[
          { v: "open", l: "Abertas" },
          { v: "refunded", l: "Reembolsadas" },
          { v: "rejected", l: "Recusadas" },
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
          Nenhuma disputa aqui.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <div
              key={d.id}
              className="space-y-2 rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive">
                  {REASON_LABEL[d.reason] ?? d.reason}
                </Badge>
                <Badge variant="outline">{d.credits_used} créditos</Badge>
                {d.status !== "open" ? (
                  <Badge variant="secondary">
                    {d.status === "refunded" ? "Reembolsada" : "Recusada"}
                  </Badge>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(d.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-sm text-foreground">
                <span className="font-medium">{d.professional_name}</span> ·
                pedido: {d.lead_title ?? d.lead_id.slice(0, 8)}
              </p>
              {d.description ? (
                <p className="text-sm text-muted-foreground">{d.description}</p>
              ) : null}
              {d.status === "open" ? (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => void resolve(d.id, "refund")}>
                    Reembolsar {d.credits_used} créditos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void resolve(d.id, "reject")}
                  >
                    Recusar
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
