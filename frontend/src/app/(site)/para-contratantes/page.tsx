/**
 * `/para-contratantes` — jornada de quem busca um serviço.
 *
 * Explica o modelo para o cliente (grátis para publicar e receber propostas;
 * paga só o profissional pelo serviço), passo a passo, segurança e uma vitrine
 * de categorias. Foco em atrair e dar confiança a quem contrata.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Star,
  Lock,
  BadgeCheck,
  ArrowRight,
  Wallet,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appHref, POPULAR_CATEGORIES } from "@/modules/site/site-config";
import {
  Container,
  Section,
  SectionTitle,
  NumberedStep,
  FeatureTile,
  CategoryTile,
  HeroFigure,
} from "@/modules/site/marketing-ui";

export const metadata: Metadata = {
  title: "Para contratantes | FazTudo",
  description:
    "Descreva o serviço e receba propostas de profissionais avaliados perto de você. Grátis para você — pague só o profissional pelo serviço.",
};

const STEPS = [
  {
    title: "Conte o que precisa",
    description: "Descreva o serviço e a região. Leva minutos e é de graça.",
  },
  {
    title: "Receba propostas",
    description:
      "Profissionais avaliados da sua região entram em contato com você.",
  },
  {
    title: "Compare e converse",
    description: "Veja perfis, avaliações e fale direto com quem te atendeu.",
  },
  {
    title: "Contrate com segurança",
    description: "Feche com o profissional em quem você confiar. Simples assim.",
  },
];

const TRUST = [
  {
    icon: ShieldCheck,
    title: "Profissionais verificados",
    description: "Cadastro com verificação de identidade (KYC).",
    color: "green" as const,
  },
  {
    icon: Star,
    title: "Avaliações reais",
    description: "Notas e comentários da própria comunidade.",
    color: "orange" as const,
  },
  {
    icon: Lock,
    title: "Seus dados protegidos",
    description: "Seu contato fica seguro e sob seu controle.",
    color: "blue" as const,
  },
];

export default function ParaContratantesPage() {
  return (
    <>
      {/* Herói */}
      <section className="bg-gradient-to-br from-primary to-blue-900 text-white">
        <Container className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:py-20">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Resolva qualquer serviço, sem dor de cabeça
            </h1>
            <p className="mx-auto mt-4 max-w-md text-blue-100 sm:text-lg lg:mx-0">
              Descreva o que precisa e receba propostas de profissionais
              avaliados perto de você. <strong>Rápido, seguro e grátis.</strong>
            </p>
            <Link
              href={appHref("/register")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-7 bg-brand text-brand-foreground hover:bg-brand/90"
              )}
            >
              Criar solicitação grátis
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
            <p className="mt-3 text-xs text-blue-100/80">
              Sem custo • sem compromisso • profissionais avaliados
            </p>
          </div>
          <HeroFigure
            src="/brand/duo-contratante.png"
            alt="Contratantes usando o FazTudo"
            tone="dark"
            priority
          />
        </Container>
      </section>

      {/* Faixa de destaque — é grátis pra você */}
      <div className="bg-brand text-brand-foreground">
        <Container className="flex flex-col items-center justify-center gap-3 py-5 text-center sm:flex-row sm:gap-5">
          <Wallet className="h-9 w-9 shrink-0" aria-hidden />
          <p className="text-lg font-extrabold leading-tight sm:text-xl">
            Criar sua solicitação é 100% grátis — você paga só o profissional
            pelo serviço.
          </p>
          <Link
            href={appHref("/register")}
            className={cn(
              buttonVariants({ size: "lg" }),
              "shrink-0 bg-white text-brand hover:bg-white/90"
            )}
          >
            Começar agora
          </Link>
        </Container>
      </div>

      {/* Como funciona */}
      <Section>
        <Container>
          <SectionTitle
            title="Como funciona pra você"
            subtitle="Do pedido à contratação, em 4 passos simples."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-2xl border bg-card p-6">
                <NumberedStep
                  n={i + 1}
                  title={step.title}
                  description={step.description}
                />
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Segurança e confiança */}
      <Section className="bg-secondary/40">
        <Container>
          <SectionTitle
            title="Contrate com segurança"
            subtitle="Confiança do primeiro contato ao serviço concluído."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {TRUST.map((item) => (
              <FeatureTile key={item.title} {...item} />
            ))}
          </div>
        </Container>
      </Section>

      {/* Vitrine de categorias */}
      <Section>
        <Container>
          <SectionTitle
            title="Para qualquer serviço"
            subtitle="Dos reparos do dia a dia às grandes reformas."
          />
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {POPULAR_CATEGORIES.map((cat) => (
              <CategoryTile
                key={cat.name}
                name={cat.name}
                icon={cat.icon}
                image={cat.image}
                href="/categorias"
              />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/categorias"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Ver todas as categorias
            </Link>
          </div>
        </Container>
      </Section>

      {/* CTA final */}
      <Section className="pb-16">
        <Container>
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-gradient-to-br from-primary to-blue-900 px-6 py-12 text-center text-white sm:px-10">
            <BadgeCheck className="h-9 w-9 text-brand" aria-hidden />
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Precisa de um serviço agora?
            </h2>
            <p className="max-w-lg text-blue-100">
              Crie sua solicitação gratuita e receba propostas de profissionais
              de confiança hoje mesmo.
            </p>
            <Link
              href={appHref("/register")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-brand text-brand-foreground hover:bg-brand/90"
              )}
            >
              Criar solicitação grátis
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
