/**
 * `CustomerHome` — Home logada do contratante (dashboard).
 *
 * Saudação personalizada + busca + CTA "Nova solicitação" (→ /leads/new) +
 * grid de Categorias populares + atalhos (Minhas solicitações, Mensagens).
 * Visual de dashboard com cards. Somente camada visual; usa rotas existentes.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  ClipboardList,
  MessageSquare,
  Star,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { IconChip } from "@/components/ui/icon-chip";
import type { User } from "@/types";
import { CategoryGrid } from "@/modules/home/category-grid";

interface Shortcut {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: "blue" | "orange" | "green";
}

const SHORTCUTS: Shortcut[] = [
  {
    href: "/leads",
    label: "Minhas solicitações",
    description: "Acompanhe e gerencie seus pedidos",
    icon: ClipboardList,
    color: "blue",
  },
  {
    href: "/conversas",
    label: "Mensagens",
    description: "Converse com os profissionais",
    icon: MessageSquare,
    color: "orange",
  },
  {
    href: "/avaliacoes",
    label: "Avaliações",
    description: "Avalie os serviços contratados",
    icon: Star,
    color: "green",
  },
];

export function CustomerHome({ user }: { user: User }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const firstName = user.name?.trim().split(/\s+/)[0] ?? "";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/leads/new?busca=${encodeURIComponent(q)}` : "/leads/new");
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      {/* Saudação + busca + CTA */}
      <section className="rounded-2xl bg-primary px-5 py-6 text-primary-foreground sm:px-8 sm:py-8">
        <p className="text-sm font-medium text-primary-foreground/80">
          Olá{firstName ? `, ${firstName}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          O que você precisa hoje?
        </h1>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <form onSubmit={handleSearch} className="flex-1">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar serviço (ex.: faxina, eletricista)"
              aria-label="Buscar serviço"
              className="h-11 bg-card text-foreground"
            />
          </form>
          <Link href="/leads/new" className="shrink-0">
            <Button
              size="lg"
              className="w-full bg-brand font-semibold text-brand-foreground hover:bg-brand/90"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Nova solicitação
            </Button>
          </Link>
        </div>
      </section>

      {/* Categorias populares */}
      <section className="py-8">
        <SectionHeader
          title="Categorias populares"
          actionLabel="Ver todas"
          actionHref="/leads/new"
          className="mb-4"
        />
        <CategoryGrid
          hrefFor={(slug) =>
            slug === "outras"
              ? "/leads/new"
              : `/leads/new?categoria=${encodeURIComponent(slug)}`
          }
        />
      </section>

      {/* Atalhos */}
      <section className="pb-4">
        <SectionHeader title="Atalhos" className="mb-4" />
        <div className="grid gap-3 sm:grid-cols-3">
          {SHORTCUTS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary"
            >
              <IconChip icon={item.icon} color={item.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold tracking-tight">
                  {item.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
