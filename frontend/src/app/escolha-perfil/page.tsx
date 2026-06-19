"use client";

/**
 * Tela 10 — Escolha de Perfil do FazTudo (pública).
 *
 * Etapa intermediária entre o Login e o Cadastro: o usuário escolhe COMO quer
 * usar o app (Contratar profissionais = `customer` / Trabalhar como profissional
 * = `professional`). A escolha é levada ao `/register` via query string
 * (`?role=<customer|professional>`), onde o `RoleSelector` já vem pré-marcado.
 *
 * Não toca no backend nem na store: é só navegação + estado local de seleção.
 * Se o usuário já estiver autenticado, redireciona para a home do seu papel
 * (mesma regra das demais telas públicas de auth).
 *
 * Acessibilidade: os dois cards formam um `radiogroup` (botões `role="radio"`
 * com `aria-checked`), navegáveis por teclado.
 */

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Briefcase, Home, Lock } from "lucide-react";

import { AppHeader } from "@/components/app-shell/app-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRedirectAuthenticated } from "@/modules/auth";

type AccountRole = "customer" | "professional";

interface ProfileOption {
  value: AccountRole;
  title: string;
  description: string;
  mascote: string;
  mascoteAlt: string;
  badgeIcon: React.ComponentType<{ className?: string }>;
  /** Cor tonal do fundo do card. */
  cardClassName: string;
  /** Cor tonal do badge de ícone. */
  badgeClassName: string;
}

const OPTIONS: ProfileOption[] = [
  {
    value: "customer",
    title: "Contratar profissionais",
    description:
      "Quero encontrar profissionais qualificados para realizar serviços.",
    mascote: "/brand/mascote-tudo.png",
    mascoteAlt: "Profissional com tablet representando contratação de serviços",
    badgeIcon: Home,
    cardClassName: "bg-primary/5",
    badgeClassName: "bg-primary/10 text-primary",
  },
  {
    value: "professional",
    title: "Trabalhar como profissional",
    description: "Quero oferecer meus serviços e conquistar novos clientes.",
    mascote: "/brand/mascote-faz.png",
    mascoteAlt: "Profissional com ferramentas representando oferta de serviços",
    badgeIcon: Briefcase,
    cardClassName: "bg-success/5",
    badgeClassName: "bg-success/10 text-success",
  },
];

export default function EscolhaPerfilPage() {
  const router = useRouter();
  const { hasHydrated } = useRedirectAuthenticated();
  const [selected, setSelected] = useState<AccountRole | null>(null);

  function handleContinue() {
    if (!selected) return;
    router.push(`/register?role=${selected}`);
  }

  // Evita flicker enquanto a sessão persistida não foi restaurada.
  if (!hasHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <AppHeader mode="title" title="Escolha de perfil" backHref="/login" />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold leading-snug tracking-tight text-foreground">
            Como deseja usar o{" "}
            <span className="text-primary">Faz</span>
            <span className="italic text-brand">Tudo</span>?
          </h1>
          <p className="text-sm text-muted-foreground">
            Selecione a opção que melhor descreve você para personalizarmos sua
            experiência.
          </p>
        </header>

        {/* Cartões selecionáveis (radiogroup acessível) */}
        <div
          role="radiogroup"
          aria-label="Como deseja usar o FazTudo?"
          className="mt-6 space-y-4"
        >
          {OPTIONS.map((option) => {
            const isSelected = selected === option.value;
            const BadgeIcon = option.badgeIcon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(option.value)}
                className={cn(
                  "relative flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  option.cardClassName,
                  isSelected
                    ? "border-primary"
                    : "border-transparent hover:border-primary/30"
                )}
              >
                {/* Mascote */}
                <div className="relative h-20 w-16 shrink-0">
                  <Image
                    src={option.mascote}
                    alt={option.mascoteAlt}
                    fill
                    sizes="64px"
                    className="object-contain object-bottom"
                  />
                </div>

                {/* Texto */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        option.badgeClassName
                      )}
                    >
                      <BadgeIcon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {option.title}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>

                {/* Indicador de rádio */}
                <span
                  aria-hidden
                  className={cn(
                    "ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isSelected ? "border-primary" : "border-muted-foreground/40"
                  )}
                >
                  {isSelected ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* CTA + rodapé */}
        <div className="mt-auto space-y-4 pt-8">
          <Button
            type="button"
            size="lg"
            onClick={handleContinue}
            disabled={!selected}
            className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Continuar
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Você poderá alterar depois nas configurações.
          </p>
        </div>
      </div>
    </main>
  );
}
