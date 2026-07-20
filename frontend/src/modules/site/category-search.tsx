"use client";

/**
 * `CategorySearch` — busca + grade de categorias da página `/categorias`.
 *
 * Filtra `ALL_CATEGORIES` pelo texto digitado (sem acento/caixa). Cada tile
 * leva ao cadastro (`/register`), onde o visitante cria a solicitação.
 */

import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ALL_CATEGORIES, appHref } from "@/modules/site/site-config";
import { CategoryTile } from "@/modules/site/marketing-ui";

/** Normaliza para busca: minúsculas e sem acento (remove diacríticos U+0300–U+036F). */
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function CategorySearch() {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return ALL_CATEGORIES;
    return ALL_CATEGORIES.filter((c) => normalize(c.name).includes(q));
  }, [query]);

  return (
    <div>
      <div className="relative mx-auto max-w-md">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar categoria"
          aria-label="Buscar categoria"
          className="h-12 pl-10"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((cat) => (
            <CategoryTile
              key={cat.name}
              name={cat.name}
              icon={cat.icon}
              href={appHref("/register")}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={Search}
            title="Nenhuma categoria encontrada"
            description="Tente outro termo — ou crie sua solicitação e descreva o serviço."
          />
        </div>
      )}
    </div>
  );
}
