"use client";

/**
 * `OnboardingFlow` — orquestra o primeiro acesso (montado global em AppChrome).
 *
 * PROFISSIONAL (incentivo dos 10 créditos):
 *  1. card "complete seu perfil e ganhe N créditos" (checklist + progresso);
 *  2. "Completar agora" leva ao /profile e inicia o GUIA com holofote campo a
 *     campo (foto → cidade → descrição → categorias);
 *  3. ao bater 100%, libera o bônus (claim) e mostra o super-card;
 *  4. "Conhecer o app" inicia o tour do app (pulável).
 * CONTRATANTE: só o tour do app (sem bônus), uma vez.
 *
 * Tolerante a falhas: qualquer erro de rede/medida apenas não mostra o guia —
 * nunca bloqueia o app.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, Circle, Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

import { claimWelcomeCredits, getProfileCompletion } from "./api";
import { SpotlightTour, type TourStep } from "./spotlight";
import { WelcomeSuperCard } from "./welcome-super-card";

type Phase = "none" | "welcome" | "guide" | "super" | "app-tour";

const key = (k: string, id: string) => `faztudo-${k}-${id}`;
const got = (k: string, id: string): boolean => {
  try {
    return localStorage.getItem(key(k, id)) === "1";
  } catch {
    return false;
  }
};
const mark = (k: string, id: string): void => {
  try {
    localStorage.setItem(key(k, id), "1");
  } catch {
    /* ignore */
  }
};

const PROFILE_STEPS: TourStep[] = [
  {
    target: "profile-avatar",
    title: "Adicione sua foto",
    body: "Toque aqui para colocar uma foto de perfil. Perfis com foto recebem muito mais contatos.",
  },
  {
    target: "profile-location",
    title: "Sua cidade e estado",
    body: "Informe onde você atende para aparecer para clientes da sua região.",
  },
  {
    target: "profile-description",
    title: "Conte o que você faz",
    body: "Preencha um título e uma descrição do seu trabalho — é o que o cliente lê primeiro.",
  },
  {
    target: "profile-categories",
    title: "Suas categorias",
    body: "Escolha ao menos uma categoria de atuação para receber os pedidos certos.",
    ctaLabel: "Concluir",
  },
];

const APP_STEPS_PRO: TourStep[] = [
  {
    target: "nav-opportunities",
    title: "Oportunidades",
    body: "Aqui aparecem os pedidos da sua região e categoria. É onde você encontra trabalho.",
  },
  {
    target: "nav-credits",
    title: "Seus créditos",
    body: "Use créditos para desbloquear o contato dos pedidos. Você já tem os primeiros!",
  },
  {
    target: "nav-messages",
    title: "Mensagens",
    body: "Converse com os clientes e feche o serviço por aqui.",
    ctaLabel: "Concluir",
  },
];

const APP_STEPS_CUSTOMER: TourStep[] = [
  {
    target: "nav-new-lead",
    title: "Peça um serviço",
    body: "Toque aqui para publicar o que você precisa. É grátis e leva 1 minuto.",
  },
  {
    target: "nav-requests",
    title: "Seus pedidos",
    body: "Acompanhe aqui os pedidos publicados e os profissionais interessados.",
  },
  {
    target: "nav-messages",
    title: "Mensagens",
    body: "Converse com os profissionais e combine tudo por aqui.",
    ctaLabel: "Concluir",
  },
];

export function OnboardingFlow() {
  const { user, role, isAuthenticated, hasHydrated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const uid = user?.id ?? "";
  const isPro = role === "professional";
  const isCustomer = role === "customer";

  const [phase, setPhase] = useState<Phase>("none");
  const [reward, setReward] = useState(10);
  const claimedRef = useRef(false);
  const welcomeShownRef = useRef(false);

  const proEnabled = hasHydrated && isAuthenticated && isPro && !!uid;

  const { data: completion, refetch } = useQuery({
    queryKey: ["onboarding", "completion", uid],
    queryFn: getProfileCompletion,
    enabled: proEnabled,
    refetchOnWindowFocus: true,
    refetchInterval: phase === "welcome" || phase === "guide" ? 4000 : false,
    staleTime: 2000,
    retry: false,
  });

  // PROFISSIONAL — decide a fase a partir da completude + flags.
  useEffect(() => {
    if (!proEnabled || !completion) return;

    if (completion.complete) {
      // Só celebra quem REALMENTE acaba de ganhar (claim concede 1x). Quem já
      // tinha o bônus (credits_granted) não recebe celebração falsa.
      if (!completion.credits_granted && !claimedRef.current) {
        claimedRef.current = true;
        claimWelcomeCredits()
          .then((r) => {
            if (r.granted) {
              setReward(r.amount || completion.reward || 10);
              mark("onb-celebrated", uid);
              setPhase("super");
            }
            void refetch();
          })
          .catch(() => {
            claimedRef.current = false;
          });
      }
      return;
    }

    // Perfil incompleto.
    if (got("onb-guide", uid) && pathname === "/profile") {
      setPhase((p) => (p === "none" || p === "welcome" ? "guide" : p));
      return;
    }
    if (!got("onb-welcome", uid) && !welcomeShownRef.current) {
      welcomeShownRef.current = true;
      setPhase("welcome");
    }
  }, [proEnabled, completion, pathname, uid, refetch]);

  // CONTRATANTE — só o tour do app, uma vez, na home.
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !isCustomer || !uid) return;
    if (pathname === "/" && !got("onb-apptour", uid)) {
      setPhase((p) => (p === "none" ? "app-tour" : p));
    }
  }, [hasHydrated, isAuthenticated, isCustomer, uid, pathname]);

  if (!uid || role === "admin") return null;

  function startGuide() {
    mark("onb-welcome", uid);
    mark("onb-guide", uid);
    setPhase("none");
    router.push("/profile");
  }
  function dismissWelcome() {
    mark("onb-welcome", uid);
    setPhase("none");
  }
  function endGuide() {
    try {
      localStorage.removeItem(key("onb-guide", uid));
    } catch {
      /* ignore */
    }
    setPhase("none");
    void refetch();
  }
  function afterSuper() {
    setPhase("app-tour");
    router.push("/");
  }
  function endAppTour() {
    mark("onb-apptour", uid);
    setPhase("none");
  }

  // ---- Render ----
  if (phase === "welcome" && completion) {
    return (
      <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
        <div className="w-full rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:max-w-sm sm:rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Gift className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="text-base font-bold tracking-tight text-foreground">
                Ganhe {completion.reward} créditos
              </p>
              <p className="text-xs text-muted-foreground">
                Complete seu perfil e desbloqueie o bônus de boas-vindas.
              </p>
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-brand transition-all"
              style={{ width: `${completion.percent}%` }}
            />
          </div>

          <ul className="mt-3 space-y-1.5">
            {completion.items.map((it) => (
              <li key={it.key} className="flex items-center gap-2 text-sm">
                {it.done ? (
                  <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <Circle
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                <span
                  className={
                    it.done
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }
                >
                  {it.label}
                </span>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            size="lg"
            onClick={startGuide}
            className="mt-4 w-full bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Completar agora
          </Button>
          <button
            type="button"
            onClick={dismissWelcome}
            className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Agora não
          </button>
        </div>
      </div>
    );
  }

  if (phase === "guide") {
    return (
      <SpotlightTour
        steps={PROFILE_STEPS}
        onDone={endGuide}
        onSkip={endGuide}
        skipLabel="Pular guia"
      />
    );
  }

  if (phase === "super") {
    return <WelcomeSuperCard amount={reward} onContinue={afterSuper} />;
  }

  if (phase === "app-tour") {
    return (
      <SpotlightTour
        steps={isCustomer ? APP_STEPS_CUSTOMER : APP_STEPS_PRO}
        onDone={endAppTour}
        onSkip={endAppTour}
        skipLabel="Pular"
      />
    );
  }

  return null;
}
