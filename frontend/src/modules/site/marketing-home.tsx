/**
 * `MarketingHome` — conteúdo da home institucional (pública).
 *
 * Renderizada em `/` quando o visitante está no navegador (fora do app nativo).
 * Server Component estático; as partes interativas (`NotifyMeForm`) são client.
 *
 * Seções: herói (2 caminhos + mascotes) · faixa de download "em breve" ·
 * como funciona · categorias populares · por que FazTudo (confiança, sem
 * depoimentos fabricados) · CTA final.
 */

import Image from "next/image";
import Link from "next/link";
import {
  ClipboardList,
  Users,
  ShieldCheck,
  Star,
  Lock,
  ArrowRight,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppStoreBadges } from "@/modules/site/app-store-badges";
import { ApkDownloadButton } from "@/modules/site/apk-download";
import {
  APK_AVAILABLE,
  POPULAR_CATEGORIES,
  appHref,
} from "@/modules/site/site-config";
import {
  Container,
  Section,
  SectionTitle,
  CategoryTile,
  NumberedStep,
  FeatureTile,
  HeroFigure,
} from "@/modules/site/marketing-ui";

const STEPS = [
  {
    title: "Descreva o que precisa",
    description: "Conte o serviço e a região. Leva poucos minutos e é grátis.",
  },
  {
    title: "Receba propostas",
    description: "Profissionais verificados da sua região entram em contato.",
  },
  {
    title: "Escolha e contrate",
    description: "Compare perfis e avaliações e feche com confiança.",
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
    title: "Dados protegidos",
    description: "Seu contato fica seguro e sob seu controle.",
    color: "blue" as const,
  },
];

export function MarketingHome() {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Herói */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-blue-800 to-blue-900 text-white">
        <div
          className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full opacity-30 blur-2xl"
          style={{ background: "radial-gradient(closest-side, hsl(var(--brand)), transparent)" }}
          aria-hidden
        />
        <Container className="relative grid items-center gap-8 py-14 lg:grid-cols-2 lg:py-20">
          <div className="order-2 text-center lg:order-1 lg:text-left">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Encontre profissionais de confiança perto de você
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base text-blue-100 sm:text-lg lg:mx-0">
              Avaliados pela comunidade, prontos para resolver o que você
              precisa. Grátis para criar sua solicitação.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href={appHref("/register")}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-brand text-brand-foreground hover:bg-brand/90"
                )}
              >
                Preciso de um serviço
              </Link>
              <Link
                href="/para-profissionais"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
                )}
              >
                Sou profissional
              </Link>
            </div>
          </div>

          <HeroFigure
            src="/brand/duo-profissional.png"
            alt="Profissionais FazTudo"
            tone="dark"
            priority
            className="order-1 lg:order-2"
          />
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Faixa de download */}
      {/* ---------------------------------------------------------------- */}
      <div className="border-b bg-card">
        <Container className="flex flex-col items-center gap-4 py-6 md:flex-row md:justify-between">
          <div className="text-center md:text-left">
            <p className="text-sm font-extrabold">Leve a FazTudo no bolso</p>
            <p className="text-sm text-muted-foreground">
              Baixe agora para <strong>Android</strong>. Nas lojas, em breve.
            </p>
          </div>
          <div className="flex flex-col items-center gap-4 md:flex-row">
            {APK_AVAILABLE ? <ApkDownloadButton tone="light" /> : null}
            <AppStoreBadges tone="dark" />
          </div>
        </Container>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Dois caminhos (contratante × profissional) */}
      {/* ---------------------------------------------------------------- */}
      <Section>
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contratante */}
            <div className="flex flex-col overflow-hidden rounded-3xl border bg-card">
              <div className="flex items-end justify-center bg-blue-50 px-6 pt-6">
                <Image
                  src="/brand/duo-contratante.png"
                  width={1128}
                  height={1450}
                  alt="Contratantes usando o FazTudo"
                  className="h-52 w-auto object-contain"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl font-extrabold tracking-tight">
                  Precisa de um serviço?
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Descreva o que precisa e receba propostas de profissionais
                  avaliados da sua região.
                </p>
                <Link
                  href={appHref("/register")}
                  className={cn(
                    buttonVariants(),
                    "mt-5 self-start bg-brand text-brand-foreground hover:bg-brand/90"
                  )}
                >
                  Criar solicitação
                </Link>
              </div>
            </div>

            {/* Profissional */}
            <div className="flex flex-col overflow-hidden rounded-3xl border bg-card">
              <div className="flex items-end justify-center bg-blue-50 px-6 pt-6">
                <Image
                  src="/brand/duo-profissional.png"
                  width={812}
                  height={963}
                  alt="Profissionais FazTudo"
                  className="h-52 w-auto object-contain"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl font-extrabold tracking-tight">
                  É profissional?
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Receba solicitações de clientes perto de você e faça seu
                  negócio crescer.
                </p>
                <Link
                  href="/para-profissionais"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "mt-5 self-start"
                  )}
                >
                  Saiba mais
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Como funciona */}
      {/* ---------------------------------------------------------------- */}
      <Section>
        <Container>
          <SectionTitle title="Como funciona" />
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

      {/* ---------------------------------------------------------------- */}
      {/* Categorias populares */}
      {/* ---------------------------------------------------------------- */}
      <Section className="bg-secondary/40 py-12 sm:py-16">
        <Container>
          <SectionTitle title="Categorias populares" />
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

      {/* ---------------------------------------------------------------- */}
      {/* Por que FazTudo */}
      {/* ---------------------------------------------------------------- */}
      <Section>
        <Container>
          <SectionTitle
            title="Por que a FazTudo"
            subtitle="Confiança em primeiro lugar, do primeiro contato ao serviço concluído."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {TRUST.map((item) => (
              <FeatureTile
                key={item.title}
                icon={item.icon}
                title={item.title}
                description={item.description}
                color={item.color}
              />
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* CTA final */}
      {/* ---------------------------------------------------------------- */}
      <Section className="pb-16">
        <Container>
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-gradient-to-br from-primary to-blue-900 px-6 py-12 text-center text-white sm:px-10">
            <ClipboardList className="h-9 w-9 text-brand" aria-hidden />
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Pronto para resolver?
            </h2>
            <p className="max-w-lg text-blue-100">
              Crie sua solicitação gratuita e encontre o profissional certo hoje
              mesmo.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={appHref("/register")}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-brand text-brand-foreground hover:bg-brand/90"
                )}
              >
                Preciso de um serviço
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/para-profissionais"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
                )}
              >
                <Users className="mr-2 h-4 w-4" aria-hidden />
                Quero trabalhar
              </Link>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
