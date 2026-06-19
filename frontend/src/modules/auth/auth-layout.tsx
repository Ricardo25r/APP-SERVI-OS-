/**
 * Casca visual das telas de autenticação (Login/Cadastro) no estilo do app.
 *
 * Layout em 2 colunas no desktop:
 *  - Esquerda: painel azul (`bg-primary`, gradiente até `blue-800`) com o
 *    wordmark "Faz"+"Tudo", mascote e o claim de marca.
 *  - Direita: o formulário dentro de um `Card` branco arredondado.
 *
 * No mobile, empilha: logo no topo + card. Apenas camada visual — não contém
 * regra de negócio. Os tokens (primary/brand/blue-*) vêm do design system.
 */
import * as React from "react";
import Image from "next/image";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Wordmark "Faz" (claro/azul) + "Tudo" (itálico laranja). */
function Wordmark({
  className,
  fazClassName = "text-primary-foreground",
}: {
  className?: string;
  fazClassName?: string;
}) {
  return (
    <span className={className}>
      <span className={fazClassName}>Faz</span>
      <span className="italic text-brand">Tudo</span>
    </span>
  );
}

export interface AuthLayoutProps {
  /** Título exibido acima do formulário. */
  title: string;
  /** Descrição curta sob o título. */
  description: string;
  /** Conteúdo do formulário. */
  children: React.ReactNode;
  /** Rodapé com links de navegação (ex.: ir para cadastro/login). */
  footer?: React.ReactNode;
}

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen w-full lg:grid-cols-2">
      {/* Painel de marca (esquerda no desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-blue-800 p-10 text-primary-foreground lg:flex xl:p-14">
        {/* Brilhos decorativos sutis */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary-foreground/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-brand/20 blur-3xl"
        />

        <Link
          href="/"
          aria-label="Página inicial do FazTudo"
          className="relative z-10 inline-flex w-fit"
        >
          <Wordmark className="text-3xl font-extrabold tracking-tight" />
        </Link>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex items-end justify-center gap-1">
            <Image
              src="/brand/mascote-profissional.webp"
              width={300}
              height={440}
              alt="Mascote profissional do FazTudo"
              priority
              className="h-auto w-36 drop-shadow-xl xl:w-44"
            />
            <Image
              src="/brand/mascote-tudo.png"
              width={300}
              height={440}
              alt="Mascote do FazTudo"
              priority
              className="-ml-3 h-auto w-32 drop-shadow-xl xl:w-40"
            />
          </div>
          <h2 className="mt-8 max-w-sm text-2xl font-extrabold leading-snug xl:text-3xl">
            Profissionais de confiança, pertinho de você.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-primary-foreground/80">
            Encontre quem resolve ou ofereça seus serviços. Tudo em um só lugar,
            do seu jeito.
          </p>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/70">
          Marketplace de prestadores de serviços locais
        </p>
      </aside>

      {/* Coluna do formulário (direita no desktop, único bloco no mobile) */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 sm:px-6">
        {/* Logo no topo (somente mobile) */}
        <Link
          href="/"
          aria-label="Página inicial do FazTudo"
          className="mb-6 inline-flex lg:hidden"
        >
          <Image
            src="/brand/logo-faztudo-full.png"
            width={200}
            height={64}
            alt="FazTudo"
            priority
            className="h-12 w-auto"
          />
        </Link>

        <Card className="w-full max-w-md rounded-2xl shadow-lg">
          <CardHeader className="space-y-1.5">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
          {footer ? (
            <CardFooter className="justify-center border-t pt-6">
              {footer}
            </CardFooter>
          ) : null}
        </Card>
      </section>
    </main>
  );
}
