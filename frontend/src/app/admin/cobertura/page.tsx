"use client";

/**
 * Painel administrativo — **Cobertura de prestadores** (`/admin/cobertura`).
 *
 * Protegido para `admin`. Mostra a média de idade dos prestadores e um "mapa"
 * de quantos prestadores existem em cada categoria (quais já têm e quais ainda
 * não têm nenhum). Base para decidir lançamento por região. Apenas tokens.
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet } from "@/services/api";

interface CategoryCoverage {
  category: string;
  count: number;
}

interface Coverage {
  total_professionals: number;
  professionals_with_birth_date: number;
  average_age: number | null;
  categories_total: number;
  categories_with_professionals: number;
  categories_without_professionals: number;
  categories: CategoryCoverage[];
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

export default function AdminCoberturaPage() {
  const auth = useRequireAuth("admin");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "coverage"],
    queryFn: () => apiGet<Coverage>("/admin/coverage"),
    enabled: auth.isAdmin,
  });

  if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isAdmin) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const maxCount = data
    ? Math.max(1, ...data.categories.map((c) => c.count))
    : 1;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar ao painel
      </Link>

      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Cobertura de prestadores
        </h1>
        <p className="text-muted-foreground">
          Média de idade e quantos profissionais há em cada categoria.
        </p>
      </header>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Carregando dados...</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              label="Idade média"
              value={
                data.average_age != null
                  ? `${data.average_age} anos`
                  : "—"
              }
            />
            <Kpi
              label="Prestadores"
              value={String(data.total_professionals)}
            />
            <Kpi
              label="Categorias com prestador"
              value={`${data.categories_with_professionals}/${data.categories_total}`}
            />
            <Kpi
              label="Categorias sem ninguém"
              value={String(data.categories_without_professionals)}
            />
          </section>

          {data.average_age != null ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Idade média calculada sobre {data.professionals_with_birth_date} de{" "}
              {data.total_professionals} prestadores que já informaram a data de
              nascimento.
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Ainda não há prestadores com data de nascimento informada.
            </p>
          )}

          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">
              Prestadores por categoria
            </h2>
            <div className="space-y-3">
              {data.categories.map((c) => {
                const zero = c.count === 0;
                const pct = zero
                  ? 0
                  : Math.max(6, Math.round((c.count / maxCount) * 100));
                return (
                  <div key={c.category}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {c.category}
                      </span>
                      {zero ? (
                        <span className="font-semibold text-destructive">
                          Sem prestadores
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {c.count}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      {zero ? null : (
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
