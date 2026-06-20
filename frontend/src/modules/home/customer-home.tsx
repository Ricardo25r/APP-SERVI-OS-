/**
 * `CustomerHome` — Home logada do contratante (Tela 01 / Dashboard).
 *
 * Hero azul (saudação + busca + CTA "Nova solicitação" + selos de confiança +
 * mascote) → Categorias populares → "Como funciona" (3 passos) → Atalhos.
 * Segue o design system (tokens, sem cor hardcoded) e os primitivos do app
 * (SearchInput, SectionHeader, IconChip, CategoryGrid). Somente camada visual;
 * usa as rotas existentes.
 */
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ClipboardList,
  CreditCard,
  Handshake,
  Inbox,
  MessageSquare,
  PencilLine,
  Plus,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { IconChip } from "@/components/ui/icon-chip";
import type { User } from "@/types";
import { CategoryGrid } from "@/modules/home/category-grid";

const TRUST: { icon: LucideIcon; label: string }[] = [
  { icon: ShieldCheck, label: "Profissionais verificados" },
  { icon: Star, label: "Avaliações reais" },
  { icon: CreditCard, label: "Pagamento seguro" },
];

const STEPS: {
  icon: LucideIcon;
  color: "blue" | "orange" | "green";
  title: string;
  desc: string;
}[] = [
  {
    icon: PencilLine,
    color: "blue",
    title: "Descreva o serviço",
    desc: "Conte o que você precisa em menos de 1 minuto.",
  },
  {
    icon: Inbox,
    color: "orange",
    title: "Receba propostas",
    desc: "Profissionais da sua região entram em contato.",
  },
  {
    icon: Handshake,
    color: "green",
    title: "Contrate o melhor",
    desc: "Compare avaliações e escolha com segurança.",
  },
];

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
      {/* Hero: saudação + busca + CTA + selos + mascote */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-blue-700 px-5 py-6 text-primary-foreground sm:px-8 sm:py-8">
        {/* Brilho decorativo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary-foreground/10 blur-3xl"
        />

        {/* Mascotes: boneca + boneco (decorativo, desktop) */}
        <div className="pointer-events-none absolute -bottom-3 right-2 hidden items-end sm:flex lg:right-8">
          <Image
            src="/brand/mascote-tudo.png"
            width={300}
            height={440}
            alt=""
            aria-hidden
            priority
            className="h-40 w-auto drop-shadow-xl lg:h-48"
          />
          <Image
            src="/brand/mascote-profissional.webp"
            width={300}
            height={440}
            alt=""
            aria-hidden
            priority
            className="-ml-5 h-44 w-auto drop-shadow-xl lg:h-52"
          />
        </div>

        <div className="relative z-10 max-w-xl">
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

          {/* Selos de confiança */}
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            {TRUST.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground/90"
              >
                <Icon className="h-4 w-4 text-brand" aria-hidden />
                {label}
              </li>
            ))}
          </ul>

          {/* Mascotes (mobile, abaixo do conteúdo) */}
          <div className="mt-6 flex items-end justify-center gap-1 sm:hidden">
            <Image
              src="/brand/mascote-tudo.png"
              width={300}
              height={440}
              alt=""
              aria-hidden
              className="h-28 w-auto drop-shadow-xl"
            />
            <Image
              src="/brand/mascote-profissional.webp"
              width={300}
              height={440}
              alt=""
              aria-hidden
              className="-ml-3 h-32 w-auto drop-shadow-xl"
            />
          </div>
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

      {/* Como funciona */}
      <section className="pb-4">
        <SectionHeader title="Como funciona" className="mb-4" />
        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-xl border bg-card p-4"
            >
              <span
                aria-hidden
                className="absolute right-3 top-3 text-2xl font-extrabold text-muted-foreground/15"
              >
                {i + 1}
              </span>
              <IconChip icon={step.icon} color={step.color} />
              <p className="mt-3 text-sm font-bold tracking-tight">
                {step.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Atalhos */}
      <section className="pb-4 pt-4">
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
