"use client";

/**
 * Tela 26 — Onboarding (carrossel de apresentação).
 *
 * 3 slides com proposta de valor + ilustrações nativas (sem depender de imagem):
 *  1. Encontrar profissionais qualificados (lista + categorias)
 *  2. Contratar com segurança (pagamento protegido + avaliações)
 *  3. Trabalhar e ganhar mais (leads + crescimento)
 *
 * Navegação: "Pular" e "Já tenho uma conta" → /login; "Próximo" avança o slide;
 * no último, "Começar" → /escolha-perfil. Mobile-first, tokens do design system.
 * Apenas camada visual + estado local do slide — sem regra de negócio.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
  Droplets,
  Hammer,
  Paintbrush,
  Plug,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRedirectAuthenticated } from "@/modules/auth";

/* ---------------------------------- Slides --------------------------------- */

const PROS = [
  { name: "Eletricista", rating: "4,9", tone: "bg-blue-100 text-blue-700" },
  { name: "Encanador", rating: "4,8", tone: "bg-success/15 text-success" },
  { name: "Pintor", rating: "4,7", tone: "bg-orange-100 text-brand" },
  { name: "Pedreiro", rating: "4,9", tone: "bg-blue-100 text-blue-700" },
];

/** Slide 1 — lista de profissionais + categorias flutuantes. */
function IllustrationFind() {
  const chips = [
    { icon: Paintbrush, cls: "bg-blue-100 text-blue-700", pos: "left-0 top-6" },
    { icon: Plug, cls: "bg-orange-100 text-brand", pos: "left-2 top-32" },
    { icon: Droplets, cls: "bg-success/15 text-success", pos: "right-0 top-10" },
    { icon: Hammer, cls: "bg-purple-100 text-purple-700", pos: "right-1 top-36" },
  ];
  return (
    <div className="relative mx-auto h-72 w-full max-w-xs">
      {chips.map(({ icon: Icon, cls, pos }, i) => (
        <span
          key={i}
          className={cn(
            "absolute inline-flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm",
            cls,
            pos
          )}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      ))}

      {/* "Telefone" com a lista */}
      <div className="absolute left-1/2 top-1 h-[17rem] w-44 -translate-x-1/2 rounded-[1.75rem] border-4 border-foreground/10 bg-card p-2 shadow-xl">
        <div className="mx-auto mb-2 mt-1 h-1.5 w-10 rounded-full bg-foreground/10" />
        <div className="space-y-2">
          {PROS.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-background p-2"
            >
              <span
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  p.tone
                )}
              >
                {p.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-foreground">
                  {p.name}
                </p>
                <p className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Star className="h-3 w-3 fill-brand text-brand" aria-hidden />
                  {p.rating}
                </p>
              </div>
              <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-hidden />
            </div>
          ))}
        </div>
      </div>

      {/* Lupa */}
      <span className="absolute bottom-6 left-1/2 inline-flex h-14 w-14 translate-x-6 items-center justify-center rounded-full border-4 border-primary bg-card shadow-lg">
        <Search className="h-6 w-6 text-primary" aria-hidden />
      </span>
    </div>
  );
}

/** Slide 2 — segurança / pagamento + avaliações. */
function IllustrationSafe() {
  return (
    <div className="relative mx-auto flex h-72 w-full max-w-xs items-center justify-center">
      <div className="absolute h-52 w-52 rounded-full bg-primary/5" />
      <div className="relative w-52 rounded-2xl bg-card p-5 shadow-xl">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-bold text-foreground">Pagamento protegido</p>
        <div className="mt-1 flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-brand text-brand" aria-hidden />
          ))}
          <span className="ml-1 text-xs text-muted-foreground">4,9</span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-background p-2">
          <Wallet className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-[11px] font-medium text-foreground">
            Crédito liberado só no aceite
          </span>
        </div>
      </div>
      <span className="absolute -right-1 top-8 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-md">
        <BadgeCheck className="h-6 w-6" aria-hidden />
      </span>
    </div>
  );
}

/** Slide 3 — crescimento do profissional. */
function IllustrationGrow() {
  return (
    <div className="relative mx-auto flex h-72 w-full max-w-xs items-center justify-center">
      <div className="absolute h-52 w-52 rounded-full bg-success/10" />
      <div className="relative w-52 rounded-2xl bg-card p-5 shadow-xl">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success">
          <TrendingUp className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-bold text-foreground">Mais clientes</p>
        <div className="mt-3 flex items-end gap-1.5">
          {[28, 44, 36, 60, 76].map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}px` }}
              className={cn(
                "w-5 rounded-t-md",
                i === 4 ? "bg-brand" : "bg-primary/30"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const SLIDES = [
  {
    title: "Encontre profissionais qualificados",
    subtitle:
      "Milhares de profissionais prontos para realizar o serviço que você precisa.",
    illustration: <IllustrationFind />,
  },
  {
    title: "Contrate com segurança",
    subtitle:
      "Pagamento protegido e avaliações reais de quem já contratou pelo FazTudo.",
    illustration: <IllustrationSafe />,
  },
  {
    title: "Trabalhe e ganhe mais",
    subtitle:
      "Receba pedidos de clientes da sua região e faça seu negócio crescer.",
    illustration: <IllustrationGrow />,
  },
];

/* ---------------------------------- Página --------------------------------- */

export default function OnboardingPage() {
  const router = useRouter();
  const { hasHydrated } = useRedirectAuthenticated();
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  function handleNext() {
    if (isLast) {
      router.push("/escolha-perfil");
      return;
    }
    setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  }

  if (!hasHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const slide = SLIDES[index];

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-6">
        {/* Topo: progresso + pular */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2" aria-hidden>
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/25"
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-sm font-semibold text-primary"
          >
            Pular
          </button>
        </div>

        {/* Conteúdo do slide */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="max-w-xs text-2xl font-bold leading-snug tracking-tight text-foreground">
            {slide.title}
          </h1>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            {slide.subtitle}
          </p>
          <div className="mt-8 w-full">{slide.illustration}</div>

          {/* Indicador inferior (bolinhas) */}
          <div className="mt-8 flex items-center gap-2" aria-hidden>
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  i === index ? "bg-primary" : "bg-muted-foreground/25"
                )}
              />
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3 pt-4">
          <Button
            type="button"
            size="lg"
            onClick={handleNext}
            className="w-full gap-1"
          >
            {isLast ? "Começar" : "Próximo"}
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Button>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full text-center text-sm font-semibold text-primary"
          >
            Já tenho uma conta
          </button>
        </div>
      </div>
    </main>
  );
}
