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

import { Fragment, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
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
  { name: "Eletricista", rating: "4,9", img: "/brand/avatar-1.png" },
  { name: "Encanador", rating: "4,8", img: "/brand/avatar-2.png" },
  { name: "Pintor", rating: "4,7", img: "/brand/avatar-3.png" },
  { name: "Pedreiro", rating: "4,9", img: "/brand/avatar-4.png" },
];

/** Slide 1 — lista de profissionais (fotos) + categorias flutuantes + lupa. */
function IllustrationFind() {
  const chips = [
    { src: "/brand/icon-rolo.png", pos: "left-0 top-10" },
    { src: "/brand/icon-tomada.png", pos: "left-1 top-44" },
    { src: "/brand/icon-torneira.png", pos: "right-0 top-14" },
    { src: "/brand/icon-tijolo.png", pos: "right-1 top-48" },
  ];
  return (
    <div className="relative mx-auto h-[24rem] w-full max-w-sm">
      {chips.map((c, i) => (
        <Image
          key={i}
          src={c.src}
          width={96}
          height={96}
          alt=""
          aria-hidden
          className={cn(
            "absolute h-12 w-12 object-contain drop-shadow-sm",
            c.pos
          )}
        />
      ))}

      {/* "Telefone" (mais alto) com a lista de profissionais */}
      <div className="absolute left-1/2 top-0 h-[22rem] w-56 -translate-x-1/2 overflow-hidden rounded-[2.25rem] border-4 border-foreground/10 bg-card p-2.5 shadow-xl">
        <div className="mx-auto mb-3 mt-1 h-1.5 w-12 rounded-full bg-foreground/10" />
        <div className="space-y-3">
          {PROS.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background p-2.5 text-left"
            >
              <Image
                src={p.img}
                width={88}
                height={88}
                alt=""
                aria-hidden
                className="h-11 w-11 shrink-0 rounded-full bg-muted object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {p.name}
                </p>
                <p className="mt-0.5 flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3 w-3 fill-brand text-brand"
                      aria-hidden
                    />
                  ))}
                  <span className="ml-0.5">{p.rating}</span>
                </p>
              </div>
              <BadgeCheck className="h-5 w-5 shrink-0 text-success" aria-hidden />
            </div>
          ))}
        </div>
        {/* Degradê branco: a lista "some" no rodapé do telefone */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card via-card/80 to-transparent" />
      </div>

      {/* Lupa grande, sobre a direita do telefone (altura do Encanador) */}
      <Image
        src="/brand/icon-lupa.png"
        width={180}
        height={180}
        alt=""
        aria-hidden
        className="absolute right-1 top-28 h-24 w-24 object-contain drop-shadow-lg"
      />
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
        {/* Topo: progresso (stepper de 3 pontos ligados) + pular */}
        <div className="flex items-center gap-4">
          <div className="flex flex-1 items-center" aria-hidden>
            {SLIDES.map((_, i) => (
              <Fragment key={i}>
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    i <= index ? "border-primary" : "border-muted-foreground/30"
                  )}
                >
                  {i <= index ? (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  ) : null}
                </span>
                {i < SLIDES.length - 1 ? (
                  <span
                    className={cn(
                      "h-0.5 flex-1 rounded-full transition-colors",
                      i < index ? "bg-primary" : "bg-muted-foreground/25"
                    )}
                  />
                ) : null}
              </Fragment>
            ))}
          </div>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="shrink-0 text-sm font-semibold text-primary"
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
