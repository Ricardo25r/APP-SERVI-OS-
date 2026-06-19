/**
 * `Landing` — Home pública (deslogado).
 *
 * Estrutura (ver mockup "Home Contratante", adaptado para web responsivo):
 * - Herói: wordmark + mascotes + headline + busca + CTA laranja "Criar
 *   solicitação agora" (→ /register).
 * - Categorias populares (grid de IconChip; busca da API com fallback).
 * - Como funciona (3 passos com IconChip).
 * - CTA final.
 *
 * A busca e os CTAs levam o visitante para `/register` (precisa de conta para
 * criar uma solicitação). O status discreto da API é mantido no rodapé do
 * herói (não bloqueia a UI).
 */
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Users, ShieldCheck, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { IconChip } from "@/components/ui/icon-chip";
import { SectionHeader } from "@/components/ui/section-header";
import { API_URL } from "@/services/api";
import { CategoryGrid } from "@/modules/home/category-grid";

type HealthStatus = "loading" | "online" | "offline";

const STEPS = [
  {
    icon: ClipboardList,
    color: "blue" as const,
    title: "Crie sua solicitação",
    description: "Conte o que você precisa em poucos minutos, sem custo.",
  },
  {
    icon: Users,
    color: "orange" as const,
    title: "Receba profissionais",
    description: "Profissionais próximos e qualificados entram em contato.",
  },
  {
    icon: ShieldCheck,
    color: "green" as const,
    title: "Escolha o melhor",
    description: "Compare perfis verificados, avaliações e contrate com segurança.",
  },
];

export function Landing() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<HealthStatus>("loading");

  React.useEffect(() => {
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/register?busca=${encodeURIComponent(q)}` : "/register");
  };

  const statusLabel: Record<HealthStatus, string> = {
    loading: "Verificando conexão...",
    online: "Serviço online",
    offline: "Serviço temporariamente indisponível",
  };
  const statusColor: Record<HealthStatus, string> = {
    loading: "bg-muted-foreground",
    online: "bg-success",
    offline: "bg-destructive",
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      {/* ---------------------------------------------------------------- */}
      {/* Herói */}
      {/* ---------------------------------------------------------------- */}
      <section className="grid items-center gap-8 py-10 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <div className="order-2 flex flex-col items-center text-center lg:order-1 lg:items-start lg:text-left">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Encontre profissionais de{" "}
            <span className="text-brand">confiança</span> perto de você
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
            Babá, faxina, reformas e muito mais. Crie uma solicitação grátis e
            receba contato de profissionais avaliados da sua região.
          </p>

          <form
            onSubmit={handleSearch}
            className="mt-6 flex w-full max-w-md flex-col gap-3 sm:flex-row"
          >
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Qual serviço você precisa?"
              aria-label="Buscar serviço"
              containerClassName="flex-1"
              className="h-11 bg-card"
            />
            <Button type="submit" variant="outline" size="lg" className="shrink-0">
              Buscar
            </Button>
          </form>

          <Link href="/register" className="mt-4 w-full max-w-md">
            <Button
              size="lg"
              className="w-full bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
            >
              Criar solicitação agora
            </Button>
          </Link>

          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`inline-block h-2 w-2 rounded-full ${statusColor[status]}`}
              aria-hidden
            />
            <span>{statusLabel[status]}</span>
          </div>
        </div>

        {/* Mascotes + wordmark */}
        <div className="order-1 flex flex-col items-center lg:order-2">
          <Image
            src="/brand/wordmark.png"
            width={300}
            height={96}
            alt="FazTudo — Encontre profissionais de confiança"
            priority
            className="h-auto w-48 sm:w-64"
          />
          <div className="mt-2 flex items-end justify-center">
            <Image
              src="/brand/mascote-profissional.webp"
              width={220}
              height={300}
              alt="Mascote Faz"
              priority
              className="h-auto w-32 sm:w-40 lg:w-48"
            />
            <Image
              src="/brand/mascote-tudo.png"
              width={220}
              height={300}
              alt="Mascote Tudo"
              priority
              className="-ml-4 h-auto w-32 sm:w-40 lg:w-48"
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Categorias populares */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-6">
        <SectionHeader
          title="Categorias populares"
          actionLabel="Ver todas"
          actionHref="/register"
          className="mb-4"
        />
        <CategoryGrid hrefFor={() => "/register"} />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Como funciona */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-8">
        <SectionHeader title="Como funciona" className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="flex flex-col gap-3 rounded-xl border bg-card p-5"
            >
              <div className="flex items-center gap-3">
                <IconChip icon={step.icon} color={step.color} />
                <span className="text-xs font-bold text-muted-foreground">
                  Passo {i + 1}
                </span>
              </div>
              <h3 className="text-base font-bold tracking-tight">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* CTA final */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-6">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground sm:px-10">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Pronto para resolver?
          </h2>
          <p className="max-w-lg text-sm text-primary-foreground/80 sm:text-base">
            Crie sua conta gratuita e encontre o profissional certo hoje mesmo.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/register">
              <Button
                size="lg"
                className="bg-brand font-semibold text-brand-foreground hover:bg-brand/90"
              >
                Criar solicitação agora
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
