"use client";

/**
 * Vitrine de **profissionais** (`/profissionais`) — busca pelo cliente.
 *
 * O cliente busca por categoria + cidade + texto e vê uma lista ordenada por
 * reputação (nota, selo de verificado). Sem busca, mostra "Salvos" no topo.
 * Cada card abre o perfil público. `GET /users/professionals` + `/users/favorites`.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, BellRing, Crown, MapPin, Search, X } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiDelete, apiGet, apiPost } from "@/services/api";
import { StarRating } from "@/modules/reviews/star-rating";
import type { Category } from "@/types";

interface ProItem {
  user_id: string;
  name: string;
  avatar_url: string | null;
  headline: string | null;
  city: string | null;
  state: string | null;
  rating: number;
  total_reviews: number;
  verified: boolean;
  is_pro?: boolean;
}

interface SavedAlert {
  id: string;
  category_id: string;
  category_name: string;
  category_slug: string | null;
  city: string | null;
  created_at: string;
}

function ProCard({ p }: { p: ProItem }) {
  return (
    <Link
      href={`/profissionais/perfil?id=${p.user_id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <Avatar src={p.avatar_url} name={p.name} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-bold text-foreground">{p.name}</span>
          {p.verified ? (
            <BadgeCheck
              className="h-4 w-4 shrink-0 text-success"
              aria-label="Verificado"
            />
          ) : null}
          {p.is_pro ? (
            <Crown className="h-4 w-4 shrink-0 text-brand" aria-label="PRO" />
          ) : null}
        </div>
        {p.headline ? (
          <p className="truncate text-sm text-muted-foreground">{p.headline}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <StarRating value={p.rating} size="sm" />
            <span className="tabular-nums">
              {p.rating.toFixed(1)} ({p.total_reviews})
            </span>
          </span>
          {p.city ? (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {p.city}
              {p.state ? `/${p.state}` : ""}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function ProfissionaisPage() {
  const auth = useRequireAuth();
  const [categoryId, setCategoryId] = useState("");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState({ categoryId: "", city: "", q: "" });

  const { data: cats } = useQuery({
    queryKey: ["categories", "all-public"],
    queryFn: () => apiGet<Category[]>("/categories/"),
    enabled: auth.isAuthenticated,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["professionals", applied],
    queryFn: () => {
      const p = new URLSearchParams();
      if (applied.categoryId) p.set("category_id", applied.categoryId);
      if (applied.city.trim()) p.set("city", applied.city.trim());
      if (applied.q.trim()) p.set("q", applied.q.trim());
      const qs = p.toString();
      return apiGet<{ items: ProItem[]; total: number }>(
        `/users/professionals${qs ? `?${qs}` : ""}`
      );
    },
    enabled: auth.isAuthenticated,
  });

  const { data: favs } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => apiGet<{ items: ProItem[] }>("/users/favorites"),
    enabled: auth.isAuthenticated,
  });

  const qc = useQueryClient();
  const { data: alertsData } = useQuery({
    queryKey: ["saved-alerts"],
    queryFn: () => apiGet<{ items: SavedAlert[] }>("/saved-alerts/"),
    enabled: auth.isAuthenticated,
  });

  async function saveAlert() {
    if (!categoryId) return;
    try {
      await apiPost("/saved-alerts/", {
        category_id: categoryId,
        city: city.trim() || null,
      });
      await qc.invalidateQueries({ queryKey: ["saved-alerts"] });
    } catch {
      /* silencioso */
    }
  }

  async function removeAlert(id: string) {
    try {
      await apiDelete(`/saved-alerts/${id}`);
      await qc.invalidateQueries({ queryKey: ["saved-alerts"] });
    } catch {
      /* silencioso */
    }
  }

  if (!auth.hasHydrated || !auth.isAuthenticated) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const items = data?.items ?? [];
  const categories = cats ?? [];
  const favItems = favs?.items ?? [];
  const alerts = alertsData?.items ?? [];
  const noSearch =
    !applied.categoryId && !applied.city.trim() && !applied.q.trim();

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Encontrar profissionais
        </h1>
        <p className="text-sm text-muted-foreground">
          Busque por categoria e cidade, compare avaliações e escolha.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ categoryId, city, q });
        }}
        className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm"
      >
        <div className="space-y-1.5">
          <Label htmlFor="cat">Categoria</Label>
          <Select
            id="cat"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <SelectOption value="">Todas</SelectOption>
            {categories.map((c) => (
              <SelectOption key={c.id} value={c.id}>
                {c.name}
              </SelectOption>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex.: Ariquemes"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q">Nome ou serviço</Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex.: eletricista"
            />
          </div>
        </div>
        <Button type="submit" className="w-full gap-1.5">
          <Search className="h-4 w-4" aria-hidden />
          Buscar
        </Button>
        <button
          type="button"
          onClick={() => void saveAlert()}
          disabled={!categoryId}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-input py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <BellRing className="h-4 w-4" aria-hidden />
          Avise-me sobre novos profissionais
        </button>
      </form>

      {alerts.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Alertas salvos
          </h2>
          <div className="flex flex-wrap gap-2">
            {alerts.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => {
                    setCategoryId(a.category_id);
                    setCity(a.city ?? "");
                    setApplied({
                      categoryId: a.category_id,
                      city: a.city ?? "",
                      q: "",
                    });
                  }}
                  className="font-medium text-foreground"
                >
                  {a.category_name}
                  {a.city ? ` · ${a.city}` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => void removeAlert(a.id)}
                  aria-label="Remover alerta"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {noSearch && favItems.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">
            Seus profissionais salvos
          </h2>
          <ul className="space-y-3">
            {favItems.map((p) => (
              <li key={p.user_id}>
                <ProCard p={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Carregando...
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum profissional encontrado. Ajuste os filtros ou{" "}
          <Link href="/leads/new" className="font-medium text-primary hover:underline">
            publique um pedido
          </Link>
          .
        </p>
      ) : (
        <section className="space-y-3">
          {noSearch && favItems.length > 0 ? (
            <h2 className="text-sm font-bold text-foreground">
              Todos os profissionais
            </h2>
          ) : null}
          <ul className="space-y-3">
            {items.map((p) => (
              <li key={p.user_id}>
                <ProCard p={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
