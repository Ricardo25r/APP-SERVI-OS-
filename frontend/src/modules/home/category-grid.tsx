/**
 * `CategoryGrid` — grid de "Categorias populares" (IconChip + nome).
 *
 * Usado na landing (deslogado) e na home do contratante. Busca categorias
 * ativas via `GET /categories/` com **fallback estático** (nunca renderiza
 * vazio) e estado de loading discreto (skeleton). Cada chip é um link cujo
 * destino é definido pelo chamador via `hrefFor` (ex.: `/leads/new` quando
 * logado, `/register` na landing).
 */
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";

import { IconChip } from "@/components/ui/icon-chip";
import { categoryImage } from "@/modules/leads/category-icon";
import {
  FALLBACK_CATEGORIES,
  OUTRAS_CATEGORY,
  chipColorForIndex,
  fetchCategoryItems,
  type CategoryItem,
} from "@/modules/home/categories";

export interface CategoryGridProps {
  /** Monta o href de cada categoria a partir do slug. */
  hrefFor: (slug: string) => string;
}

export function CategoryGrid({ hrefFor }: CategoryGridProps) {
  const [items, setItems] = React.useState<CategoryItem[]>(FALLBACK_CATEGORIES);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    fetchCategoryItems(7)
      .then((fetched) => {
        if (!active) return;
        // Anexa "Outras" ao final; se a API não retornar nada, mantém o fallback.
        if (fetched.length > 0) {
          setItems([...fetched, OUTRAS_CATEGORY]);
        }
      })
      .catch(() => {
        // Silencioso: o fallback estático já cobre a UI.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="grid grid-cols-4 gap-3 sm:grid-cols-4 lg:grid-cols-8"
        aria-busy="true"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 rounded-xl border bg-card p-3"
          >
            <span className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
            <span className="h-3 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {items.map((item, i) => {
        const img = categoryImage(item.slug);
        return (
          <Link
            key={item.slug}
            href={hrefFor(item.slug)}
            className="flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center transition-colors hover:border-primary/40 hover:bg-secondary"
          >
            {img ? (
              <Image
                src={img}
                width={88}
                height={88}
                alt=""
                aria-hidden
                className="h-11 w-11 rounded-xl object-cover object-top"
              />
            ) : (
              <IconChip icon={item.icon} color={chipColorForIndex(i)} />
            )}
            <span className="text-xs font-semibold leading-tight text-foreground">
              {item.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
