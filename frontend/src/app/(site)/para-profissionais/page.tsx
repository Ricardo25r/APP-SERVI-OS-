/**
 * `/para-profissionais` — jornada de quem presta serviços.
 *
 * Explica o modelo (como funciona, como ganha, como paga a plataforma) sem
 * expor preço: leads pagos por créditos, sem comissão sobre o serviço, créditos
 * de boas-vindas e "indique e ganhe". Foco em atrair o profissional.
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Clock,
  MapPin,
  Star,
  Lock,
  Coins,
  TrendingUp,
  Wallet,
  Gift,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";

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
  title: "Para profissionais | FazTudo",
  description:
    "Receba clientes da sua região e fique com 100% do valor do serviço. Você paga só por lead (créditos), sem comissão e sem mensalidade obrigatória.",
};

/** Passo a passo do modelo (como funciona pra ele). */
const STEPS = [
  {
    title: "Crie sua conta grátis",
    description:
      "Cadastre-se e complete seu perfil para ganhar 10 créditos de boas-vindas.",
  },
  {
    title: "Receba pedidos da sua região",
    description:
      "Clientes publicam o que precisam e você vê as oportunidades — sem custo para receber.",
  },
  {
    title: "Desbloqueie quem te interessa",
    description:
      "Gostou de um pedido? Use créditos para liberar o contato do cliente e falar direto.",
  },
  {
    title: "Feche e seja avaliado",
    description:
      "Combine o serviço direto com o cliente. O valor é 100% seu — e boas avaliações trazem mais trabalho.",
  },
];

/** Como paga a plataforma (clareza de custo, sem preço). */
const PAGAMENTO = [
  {
    icon: Coins,
    title: "Você paga por lead",
    description:
      "Compre créditos e gaste apenas quando quiser o contato de um cliente. Nada de pagar por trabalho que não te serve.",
    color: "blue" as const,
  },
  {
    icon: TrendingUp,
    title: "Sem comissão no serviço",
    description:
      "A plataforma não fica com nenhum percentual do que você combina. O lucro do serviço é todo seu.",
    color: "green" as const,
  },
  {
    icon: Wallet,
    title: "Sem mensalidade obrigatória",
    description:
      "Você decide quanto investir e quando. Recarrega quando quiser, no seu ritmo.",
    color: "orange" as const,
  },
];

const BENEFITS = [
  { icon: MapPin, title: "Clientes perto de você", color: "blue" as const },
  { icon: Clock, title: "Agenda no seu controle", color: "blue" as const },
  { icon: Star, title: "Construa sua reputação", color: "orange" as const },
  { icon: Lock, title: "Contato protegido", color: "green" as const },
];

export default function ParaProfissionaisPage() {
  return (
    <>
      {/* Herói */}
      <section className="bg-gradient-to-br from-blue-900 to-primary text-white">
        <Container className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:py-20">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Mais clientes. Mais trabalho. Mais lucro.
            </h1>
            <p className="mx-auto mt-4 max-w-md text-blue-100 sm:text-lg lg:mx-0">
              Transforme a FazTudo na sua fonte de clientes. Você escolhe os
              serviços, negocia direto e fica com <strong>100% do valor</strong>{" "}
              do trabalho.
            </p>
            <Link
              href={appHref("/register")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-7 bg-brand text-brand-foreground hover:bg-brand/90"
              )}
            >
              Começar agora — é grátis
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
            <p className="mt-3 text-xs text-blue-100/80">
              Cadastro gratuito • 10 créditos de boas-vindas • sem comissão
            </p>
          </div>
          <HeroFigure
            src="/brand/duo-profissional.png"
            alt="Profissionais FazTudo"
            tone="dark"
            priority
          />
        </Container>
      </section>

      {/* Faixa de destaque — bônus de boas-vindas */}
      <div className="bg-brand text-brand-foreground">
        <Container className="flex flex-col items-center justify-center gap-3 py-5 text-center sm:flex-row sm:gap-5">
          <Image
            src="/brand/moedas.png"
            width={80}
            height={80}
            alt="Créditos FazTudo"
            className="h-14 w-14 shrink-0 object-contain drop-shadow-md"
          />
          <p className="text-lg font-extrabold leading-tight sm:text-xl">
            Cadastre-se e ganhe 10 créditos grátis — para você já começar
            faturando!
          </p>
          <Link
            href={appHref("/register")}
            className={cn(
              buttonVariants({ size: "lg" }),
              "shrink-0 bg-white text-brand hover:bg-white/90"
            )}
          >
            Quero meus créditos
          </Link>
        </Container>
      </div>

      {/* Como funciona pra você */}
      <Section>
        <Container>
          <SectionTitle
            title="Como funciona pra você"
            subtitle="Do cadastro ao serviço fechado, em 4 passos simples."
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

      {/* Como você paga a plataforma */}
      <Section className="bg-secondary/40">
        <Container>
          <SectionTitle
            title="Como você paga a plataforma"
            subtitle="Simples e no seu controle — você só investe no que traz retorno."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PAGAMENTO.map((item) => (
              <FeatureTile key={item.title} {...item} />
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
            Em resumo: você compra <strong>créditos</strong> e usa um crédito só
            para desbloquear o contato de um cliente. O que você combina pelo
            serviço é todo seu.
          </p>
        </Container>
      </Section>

      {/* Indique e ganhe */}
      <Section>
        <Container>
          <div className="flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-brand/30 bg-brand/10 px-6 py-10 text-center sm:px-10">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
              <Gift className="h-7 w-7" aria-hidden />
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Indique um amigo e ganhe créditos
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Compartilhe seu link de indicação. Quando o amigo se cadastrar e
              começar a usar, <strong>você ganha créditos</strong> para receber
              mais clientes. Sua rede vale dinheiro.
            </p>
            <Link
              href={appHref("/register")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-brand text-brand-foreground hover:bg-brand/90"
              )}
            >
              Criar conta e indicar
            </Link>
          </div>
        </Container>
      </Section>

      {/* Benefícios */}
      <Section className="bg-secondary/40">
        <Container>
          <SectionTitle title="Por que trabalhar com a FazTudo" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((item) => (
              <FeatureTile key={item.title} {...item} />
            ))}
          </div>
        </Container>
      </Section>

      {/* CTA final */}
      <Section className="pb-16">
        <Container>
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-gradient-to-br from-blue-900 to-primary px-6 py-12 text-center text-white sm:px-10">
            <BadgeCheck className="h-9 w-9 text-brand" aria-hidden />
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Pronto para receber mais clientes?
            </h2>
            <p className="max-w-lg text-blue-100">
              Crie sua conta gratuita, complete seu perfil e comece com 10
              créditos de boas-vindas.
            </p>
            <Link
              href={appHref("/register")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-brand text-brand-foreground hover:bg-brand/90"
              )}
            >
              Cadastrar-se gratuitamente
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
