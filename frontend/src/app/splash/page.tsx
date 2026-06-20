"use client";

/**
 * Tela 25 — Splash Screen (abertura do app).
 *
 * Painel azul com: wordmark FazTudo + casinha da marca, claim em 2 linhas,
 * cidade ao fundo (com janelas) + arco pontilhado, herói com o TRIO de
 * profissionais ancorado na base, degradê de transição, selos de confiança e
 * indicador de carregamento. Após um instante, avança para o Onboarding
 * (ou home, se já autenticado). `?stay=1` pausa o auto-avanço (QA/preview).
 *
 * Mobile-first. Apenas camada visual + 1 timer. 100% tokens do design system.
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

/** Casinha da marca (telhado + chaminé + janela), em branco sobre o azul. */
function HouseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 92" className={className} aria-hidden>
      {/* chaminé */}
      <rect x="84" y="16" width="12" height="28" rx="2" fill="currentColor" />
      {/* telhado */}
      <path d="M60 4 6 46h18v2h72v-2h18z" fill="currentColor" />
      {/* corpo */}
      <rect x="24" y="46" width="72" height="42" rx="4" fill="currentColor" />
      {/* janela (4 vidros na cor da marca) */}
      <g className="fill-primary">
        <rect x="47" y="56" width="11" height="11" rx="1.5" />
        <rect x="62" y="56" width="11" height="11" rx="1.5" />
        <rect x="47" y="70" width="11" height="11" rx="1.5" />
        <rect x="62" y="70" width="11" height="11" rx="1.5" />
      </g>
    </svg>
  );
}

/** Skyline da cidade com janelas + arco pontilhado, atrás do trio. */
function CityBackdrop() {
  const buildings = [
    { x: 6, w: 34, h: 70 },
    { x: 44, w: 26, h: 104 },
    { x: 74, w: 30, h: 86 },
    { x: 150, w: 28, h: 96 },
    { x: 182, w: 34, h: 70 },
    { x: 296, w: 30, h: 92 },
    { x: 330, w: 26, h: 70 },
    { x: 360, w: 34, h: 110 },
  ];
  const baseY = 160;
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 160"
      preserveAspectRatio="xMidYMax meet"
      className="absolute inset-x-0 bottom-40 h-56 w-full text-blue-900"
    >
      {/* arco pontilhado */}
      <path
        d="M40 84 Q200 8 360 84"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeDasharray="2 8"
        strokeLinecap="round"
        className="text-brand"
      />
      {buildings.map((b, i) => {
        const cols = Math.max(2, Math.floor(b.w / 10));
        const rows = Math.max(2, Math.floor(b.h / 16));
        const cells = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            cells.push(
              <rect
                key={`${r}-${c}`}
                x={b.x + 5 + c * 9}
                y={baseY - b.h + 8 + r * 14}
                width="4"
                height="6"
                rx="0.5"
                className={(i + r + c) % 3 === 0 ? "fill-brand/30" : "fill-blue-200/25"}
              />
            );
          }
        }
        return (
          <g key={i}>
            <rect
              x={b.x}
              y={baseY - b.h}
              width={b.w}
              height={b.h}
              rx="2"
              fill="currentColor"
              fillOpacity="0.55"
            />
            {cells}
          </g>
        );
      })}
    </svg>
  );
}

export default function SplashPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuth();

  // Avança sozinho após a abertura (app-like). `?stay=1` pausa (QA/preview).
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
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-primary to-blue-900 text-primary-foreground">
      {/* Brilhos decorativos */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-brand/20 blur-3xl"
      />

      {/* Cidade ao fundo */}
      <CityBackdrop />

      {/* Marca + claim */}
      <div className="relative z-10 mt-14 flex flex-col items-center px-6 text-center">
        <span className="relative text-6xl font-extrabold tracking-tight drop-shadow">
          <span className="text-primary-foreground">Faz</span>
          <span className="relative italic text-brand">
            Tudo
            <HouseMark className="absolute -top-8 left-1/2 h-9 w-11 -translate-x-1/2 text-primary-foreground drop-shadow" />
          </span>
        </span>
        <p className="mt-5 text-lg font-medium leading-snug">
          <span className="block text-primary-foreground">Conectando você aos</span>
          <span className="block font-bold text-brand">melhores profissionais.</span>
        </p>
      </div>

      {/* Herói: trio de profissionais, grande e ancorado na base */}
      <div className="relative z-10 mt-2 flex min-h-0 flex-1 items-end justify-center px-2">
        <Image
          src="/brand/mascote-trio.png"
          width={1493}
          height={882}
          alt="Profissionais FazTudo: eletricista, pintora e pedreiro"
          priority
          className="h-auto max-h-full w-full max-w-md object-contain object-bottom drop-shadow-2xl"
        />
      </div>

      {/* Rodapé: degradê de transição + selos + carregando */}
      <div className="relative z-20 -mt-16 bg-gradient-to-t from-blue-900 via-blue-900/95 to-transparent px-6 pb-7 pt-16">
        <div className="mx-auto grid w-full max-w-sm grid-cols-4 gap-2">
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

        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-primary-foreground/80">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando...
        </div>
      </div>
    </main>
  );
}
