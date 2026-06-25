"use client";

/**
 * `WelcomeOnboarding` — "como funciona" no primeiro acesso (esteira #14).
 *
 * Modal de 3 passos, **role-aware**, mostrado UMA vez por usuário
 * (localStorage). Tira a fricção de "cheguei e não sei o que fazer" e, para o
 * profissional, guia os primeiros passos: completar perfil + categorias e usar
 * o crédito de bônus. Não aparece para admin nem antes da hidratação.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  FileText,
  Gift,
  MessagesSquare,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface Step {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const CUSTOMER: Step[] = [
  {
    icon: FileText,
    title: "Conte o que você precisa",
    desc: "Publique seu pedido em menos de 1 minuto. É grátis.",
  },
  {
    icon: Users,
    title: "Receba profissionais",
    desc: "Profissionais da sua região veem seu pedido e falam com você pelo chat.",
  },
  {
    icon: MessagesSquare,
    title: "Converse e contrate",
    desc: "Combine tudo pelo chat, escolha o melhor e avalie no final.",
  },
];

const PRO: Step[] = [
  {
    icon: UserCog,
    title: "Monte seu perfil",
    desc: "Foto, uma boa descrição e suas categorias de atuação — é assim que o cliente te encontra.",
  },
  {
    icon: Gift,
    title: "Você ganhou créditos de boas-vindas",
    desc: "Use-os para desbloquear seus primeiros pedidos, sem pagar nada agora.",
  },
  {
    icon: Briefcase,
    title: "Desbloqueie e feche",
    desc: "Pegue os pedidos da sua categoria, converse no chat e feche o serviço. Boas avaliações te colocam no topo.",
  },
];

const keyFor = (id: string) => `faztudo-onboarded-${id}`;

export function WelcomeOnboarding() {
  const { user, role, isAuthenticated, hasHydrated } = useAuth();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !user || !role) return;
    if (role === "admin") return;
    try {
      if (!localStorage.getItem(keyFor(user.id))) setShow(true);
    } catch {
      /* sem localStorage: não mostra */
    }
  }, [hasHydrated, isAuthenticated, user, role]);

  if (!show || !user || !role) return null;

  const steps = role === "professional" ? PRO : CUSTOMER;
  const isLast = step >= steps.length - 1;
  const current = steps[step];
  const Icon = current.icon;

  function finish(goProfile: boolean) {
    try {
      if (user) localStorage.setItem(keyFor(user.id), "1");
    } catch {
      /* ignore */
    }
    setShow(false);
    if (goProfile) router.push("/profile");
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Como funciona"
    >
      <div className="w-full max-w-md rounded-t-2xl border bg-card p-6 shadow-xl sm:rounded-2xl">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => finish(false)}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Pular
          </button>
        </div>

        <div className="flex flex-col items-center px-2 pb-2 pt-1 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-8 w-8" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-bold tracking-tight text-foreground">
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {current.desc}
          </p>
        </div>

        <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={
                i === step
                  ? "h-2 w-5 rounded-full bg-primary transition-all"
                  : "h-2 w-2 rounded-full bg-muted transition-all"
              }
            />
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {!isLast ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => setStep((s) => s + 1)}
            >
              Próximo
            </Button>
          ) : role === "professional" ? (
            <>
              <Button
                size="lg"
                className="w-full"
                onClick={() => finish(true)}
              >
                Completar meu perfil
              </Button>
              <button
                type="button"
                onClick={() => finish(false)}
                className="py-1 text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Agora não
              </button>
            </>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={() => finish(false)}
            >
              Começar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
