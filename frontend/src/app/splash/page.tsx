"use client";

/**
 * Tela 25 — Splash Screen (abertura do app).
 *
 * Primeira tela ao abrir o app: painel azul com o wordmark FazTudo, claim,
 * herói com mascotes, selos de confiança e indicador de carregamento.
 * Após um breve intervalo, avança automaticamente para o Onboarding
 * (ou para a home, se o usuário já estiver autenticado).
 *
 * Mobile-first (é a cara do app iOS/Android). Apenas camada visual + 1 timer
 * de navegação — sem regra de negócio. Tokens do design system (primary/brand).
 */

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CreditCard, Headset, Loader2, ShieldCheck, Star } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";

const TRUST = [
  { icon: ShieldCheck, label: "Profissionais\nverificados" },
  { icon: Star, label: "Avaliações\nreais" },
  { icon: CreditCard, label: "Pagamento\nseguro" },
  { icon: Headset, label: "Suporte\ndedicado" },
];

export default function SplashPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuth();

  // Avança sozinho após a abertura (app-like). Se logado, vai pra home.
  // `?stay=1` pausa o auto-avanço (útil para QA/preview da tela).
  useEffect(() => {
    if (!hasHydrated) return;
    if (typeof window !== "undefined" && window.location.search.includes("stay"))
      return;
    const t = setTimeout(() => {
      router.replace(isAuthenticated ? "/" : "/onboarding");
    }, 2200);
    return () => clearTimeout(t);
  }, [hasHydrated, isAuthenticated, router]);

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-primary to-blue-900 px-6 py-8 text-primary-foreground">
      {/* Brilhos decorativos */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-brand/20 blur-3xl"
      />

      {/* Skyline sutil ao fundo (silhueta da cidade) */}
      <svg
        aria-hidden
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-36 h-28 w-full text-blue-900/50"
      >
        <path
          fill="currentColor"
          d="M0 120V70h20v-20h16v20h14V40h18v30h12V55h20v15h14V25h16v45h12V60h22v10h14V45h18v25h12V35h20v35h14V58h18v12h14V48h20v22h14V62h18V120z"
        />
      </svg>

      {/* Marca + claim */}
      <div className="relative z-10 mt-6 flex flex-col items-center text-center">
        <span className="text-5xl font-extrabold tracking-tight drop-shadow">
          <span className="text-primary-foreground">Faz</span>
          <span className="italic text-brand">Tudo</span>
        </span>
        <p className="mt-4 max-w-xs text-base font-medium text-primary-foreground/90">
          Conectando você aos{" "}
          <span className="font-bold text-brand">melhores profissionais.</span>
        </p>
      </div>

      {/* Herói: trio de profissionais FazTudo */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center py-6">
        <Image
          src="/brand/mascote-trio.png"
          width={1493}
          height={882}
          alt="Profissionais FazTudo: eletricista, pintora e pedreiro"
          priority
          className="h-auto max-h-full w-full max-w-md object-contain drop-shadow-2xl"
        />
      </div>

      {/* Selos de confiança */}
      <div className="relative z-10 mx-auto grid w-full max-w-sm grid-cols-4 gap-2">
        {TRUST.map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/10">
              <Icon className="h-5 w-5 text-primary-foreground" aria-hidden />
            </span>
            <span className="whitespace-pre-line text-[11px] leading-tight text-primary-foreground/80">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Carregando */}
      <div className="relative z-10 flex items-center justify-center gap-2 pt-6 text-sm text-primary-foreground/80">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando...
      </div>
    </main>
  );
}
