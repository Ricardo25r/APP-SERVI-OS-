/**
 * `/para-contratantes` — jornada de quem busca um serviço.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Star, Lock, ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appHref } from "@/modules/site/site-config";
import {
  Container,
  Section,
  SectionTitle,
  NumberedStep,
  FeatureTile,
  HeroFigure,
} from "@/modules/site/marketing-ui";

export const metadata: Metadata = {
  title: "Para contratantes | FazTudo",
  description:
    "Descreva o serviço, receba propostas de profissionais avaliados perto de você e contrate com confiança.",
};

const STEPS = [
  { title: "Descreva o que precisa", description: "Serviço, região e detalhes." },
  { title: "Receba propostas", description: "Compare perfis e avaliações." },
  {
    title: "Escolha e contrate",
    description: "Combine direto com o profissional.",
  },
];

const TRUST = [
  {
    icon: ShieldCheck,
    title: "Profissionais verificados",
    description: "Cadastro com verificação de identidade.",
    color: "green" as const,
  },
  {
    icon: Star,
    title: "Avaliações reais",
    description: "Notas e comentários da comunidade.",
    color: "orange" as const,
  },
  {
    icon: Lock,
    title: "Dados protegidos",
    description: "Seu contato fica sob seu controle.",
    color: "blue" as const,
  },
];

export default function ParaContratantesPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-primary to-blue-900 text-white">
        <Container className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:py-20">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Encontre o profissional certo em minutos
            </h1>
            <p className="mx-auto mt-4 max-w-md text-blue-100 sm:text-lg lg:mx-0">
              Descreva o serviço e receba propostas de quem está perto de você.
            </p>
            <Link
              href={appHref("/register")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-7 bg-brand text-brand-foreground hover:bg-brand/90"
              )}
            >
              Criar solicitação
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </div>
          <HeroFigure
            src="/brand/duo-contratante.png"
            alt="Contratantes usando o FazTudo"
            tone="dark"
            priority
          />
        </Container>
      </section>

      <Section>
        <Container>
          <SectionTitle title="Como funciona pra você" />
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
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

      <Section className="bg-secondary/40">
        <Container>
          <SectionTitle title="Segurança e confiança" />
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {TRUST.map((item) => (
              <FeatureTile key={item.title} {...item} />
            ))}
          </div>
        </Container>
      </Section>

      <Section className="pb-16">
        <Container>
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-gradient-to-br from-primary to-blue-900 px-6 py-12 text-center text-white sm:px-10">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Precisa de um serviço agora?
            </h2>
            <Link
              href={appHref("/register")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-brand text-brand-foreground hover:bg-brand/90"
              )}
            >
              Criar solicitação
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
