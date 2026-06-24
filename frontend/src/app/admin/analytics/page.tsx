"use client";

/**
 * Painel admin — **Analytics de uso** (`/admin/analytics`).
 *
 * Páginas mais acessadas, por aparelho, por região (UF) e por papel, na janela
 * de dias. Sem PII (o backend agrega rota/aparelho/SO/UF/papel). Só tokens.
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet } from "@/services/api";

interface Count {
  label: string;
  count: number;
}
interface Overview {
  total_views: number;
  days: number;
  top_pages: Count[];
  by_device: Count[];
  by_region: Count[];
  by_role: Count[];
}

const ROLE_LABEL: Record<string, string> = {
  customer: "Contratante",
  professional: "Profissional",
  admin: "Administrador",
};

function BarList({
  title,
  items,
  format,
}: {
  title: string;
  items: Count[];
  format?: (label: string) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold tracking-tight">{title}</h2>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((i) => (
            <div key={i.label}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-foreground">
                  {format ? format(i.label) : i.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {i.count}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((i.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdminAnalyticsPage() {
  const auth = useRequireAuth("admin");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => apiGet<Overview>("/analytics/overview"),
    enabled: auth.isAdmin,
  });

  if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isAdmin) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar ao painel
      </Link>

      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Analytics de uso</h1>
        <p className="text-muted-foreground">
          Como as pessoas usam o app (últimos {data?.days ?? 30} dias).
        </p>
      </header>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Carregando dados...</p>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">
              Visualizações de página
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {data.total_views.toLocaleString("pt-BR")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <BarList title="Páginas mais acessadas" items={data.top_pages} />
            <BarList title="Por aparelho" items={data.by_device} />
            <BarList
              title="Por região (UF)"
              items={data.by_region}
            />
            <BarList
              title="Por tipo de conta"
              items={data.by_role}
              format={(l) => ROLE_LABEL[l] ?? l}
            />
          </div>
        </>
      )}
    </main>
  );
}
