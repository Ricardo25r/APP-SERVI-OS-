/**
 * `/para-profissionais` — jornada de quem presta serviços (recebe leads).
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Clock, MapPin, Star, Lock } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appHref } from "@/modules/site/site-config";
import {
  Container,
  Section,
  SectionTitle,
  NumberedStep,
  FeatureTile,
} from "@/modules/site/marketing-ui";

export const metadata: Metadata = {
  title: "Para profissionais | FazTudo",
  description:
    "Cadastre-se e comece a receber solicitações de serviço de clientes na sua região.",
};

const BENEFITS = [
  { icon: Clock, title: "Agenda flexível", color: "blue" as const },
  { icon: MapPin, title: "Leads da sua região", color: "blue" as const },
  { icon: Star, title: "Construa reputação", color: "orange" as const },
  { icon: Lock, title: "Contato protegido", color: "green" as const },
];

const STEPS = [
  { title: "Cadastre-se" },
  { title: "Complete seu perfil" },
  { title: "Receba solicitações" },
  { title: "Feche negócios" },
];

export default function ParaProfissionaisPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-blue-900 to-primary text-white">
        <Container className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:py-20">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Receba clientes todos os dias
            </h1>
            <p className="mx-auto mt-4 max-w-md text-blue-100 sm:text-lg lg:mx-0">
              Cadastre-se gratuitamente e comece a receber solicitações de
              serviço de clientes na sua região.
            </p>
            <Link
              href={appHref("/register")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-7 bg-brand text-brand-foreground hover:bg-brand/90"
              )}
            >
              Cadastrar
            </Link>
          </div>
          <div className="flex justify-center">
            <Image
              src="/brand/mascote-faz.png"
              width={260}
              height={340}
              alt="Mascote Faz"
              priority
              className="h-auto w-44 sm:w-56"
            />
          </div>
        </Container>
      </section>

      <Section>
        <Container>
          <SectionTitle title="Benefícios" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((item) => (
              <FeatureTile key={item.title} {...item} />
            ))}
          </div>
        </Container>
      </Section>

      <Section className="bg-secondary/40">
        <Container>
          <SectionTitle title="Passo a passo" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-2xl border bg-card p-6"
              >
                <NumberedStep n={i + 1} title={step.title} center />
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="pb-16">
        <Container>
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-gradient-to-br from-blue-900 to-primary px-6 py-12 text-center text-white sm:px-10">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Comece a receber clientes
            </h2>
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
