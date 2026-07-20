/**
 * `/sobre` — história, missão e valores da FazTudo.
 */

import type { Metadata } from "next";
import Image from "next/image";
import { ShieldCheck, Users, Hammer } from "lucide-react";

import {
  Container,
  Section,
  FeatureTile,
} from "@/modules/site/marketing-ui";

export const metadata: Metadata = {
  title: "Sobre a FazTudo | FazTudo",
  description:
    "A FazTudo conecta pessoas a profissionais de confiança avaliados pela própria comunidade.",
};

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Confiança em primeiro lugar",
    color: "green" as const,
  },
  {
    icon: Users,
    title: "Comunidade em primeiro lugar",
    color: "blue" as const,
  },
  { icon: Hammer, title: "Trabalho bem feito", color: "orange" as const },
];

export default function SobrePage() {
  return (
    <>
      <Section>
        <Container className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Nossa história
            </h1>
            <p className="mt-4 text-muted-foreground sm:text-lg">
              A FazTudo nasceu para simplificar algo que todo brasileiro já
              viveu: a dificuldade de encontrar um profissional de confiança
              quando mais precisa. Conectamos pessoas a prestadores de serviço
              avaliados pela própria comunidade, em qualquer canto do Brasil.
            </p>
            <div className="mt-6 rounded-2xl border bg-card p-6">
              <h2 className="text-base font-extrabold text-primary">Missão</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Tornar a contratação de serviços simples, segura e acessível
                para todos.
              </p>
            </div>
          </div>
          <div className="flex items-end justify-center">
            <Image
              src="/brand/mascote-faz.png"
              width={260}
              height={340}
              alt="Mascote Faz"
              priority
              className="-mr-5 h-auto w-40 sm:w-52"
            />
            <Image
              src="/brand/mascote-tudo.png"
              width={260}
              height={340}
              alt="Mascote Tudo"
              priority
              className="h-auto w-40 sm:w-52"
            />
          </div>
        </Container>
      </Section>

      <Section className="bg-secondary/40 pb-16">
        <Container>
          <div className="grid gap-6 sm:grid-cols-3">
            {VALUES.map((item) => (
              <FeatureTile key={item.title} {...item} />
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
