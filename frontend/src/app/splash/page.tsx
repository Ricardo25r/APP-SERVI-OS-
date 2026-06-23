"use client";

/**
 * Tela 25 — Splash Screen (abertura do app).
 *
 * Painel azul com: wordmark FazTudo + casinha real da marca encaixada no "Tudo",
 * claim em 2 linhas (branca + laranja), cidade ao fundo (com janelas) atrás das
 * cabeças + arco pontilhado, herói com o TRIO grande ancorado na base, degradê
 * de transição, selos de confiança e "Carregando...". Após um instante avança
 * para o Onboarding (ou home, se já autenticado). `?stay=1` pausa (QA/preview).
 *
 * Mobile-first: o conteúdo vive numa coluna largura-de-celular (max-w-sm)
 * centralizada, então fica idêntico no celular e no desktop. 100% tokens.
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

/** Skyline da cidade com janelas + arco pontilhado, atrás do trio (na cabeça). */
function CityBackdrop() {
  const buildings = [
    { x: 2, w: 36, h: 120 },
    { x: 42, w: 28, h: 170 },
    { x: 74, w: 32, h: 140 },
    { x: 110, w: 26, h: 96 },
    { x: 150, w: 30, h: 158 },
    { x: 184, w: 36, h: 116 },
    { x: 286, w: 28, h: 104 },
    { x: 318, w: 32, h: 150 },
    { x: 354, w: 26, h: 112 },
    { x: 384, w: 14, h: 150 },
  ];
  const baseY = 220;
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 220"
      preserveAspectRatio="none"
      className="absolute inset-x-0 bottom-36 h-[42%] w-full text-blue-900"
    >
      <path
        d="M30 70 Q200 0 370 70"
        fill="none"
        strokeOpacity="0.55"
        strokeWidth="2.5"
        strokeDasharray="2 9"
        strokeLinecap="round"
        className="stroke-brand"
      />
      {buildings.map((b, i) => {
        const cols = Math.max(2, Math.floor(b.w / 11));
        const rows = Math.max(2, Math.floor(b.h / 22));
        const cells = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            cells.push(
              <rect
                key={`${r}-${c}`}
                x={b.x + 5 + c * 10}
                y={baseY - b.h + 10 + r * 20}
                width="4"
                height="8"
                rx="0.5"
                className={
                  (i + r + c) % 4 === 0 ? "fill-brand/30" : "fill-blue-200/25"
                }
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
              fillOpacity="0.6"
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
    }, 3000);
    return () => clearTimeout(t);
  }, [hasHydrated, isAuthenticated, router]);

  return (
    <main className="relative flex min-h-screen justify-center overflow-hidden bg-gradient-to-b from-primary to-blue-900 text-primary-foreground">
      {/* Coluna largura-de-celular (mesma cara no mobile e desktop) */}
      <div className="relative flex min-h-screen w-full max-w-none flex-col overflow-hidden sm:max-w-sm">
        {/* Brilhos decorativos */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-10 h-60 w-60 rounded-full bg-primary-foreground/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 top-1/3 h-60 w-60 rounded-full bg-brand/20 blur-3xl"
        />

        {/* Cidade ao fundo (atrás das cabeças) */}
        <CityBackdrop />

        {/* Marca + claim */}
        <div className="relative z-20 mt-24 flex flex-col items-center px-6 text-center">
          <span className="relative inline-block text-6xl font-extrabold tracking-tight drop-shadow">
            <Image
              src="/brand/logo-casa-branca.png"
              width={1330}
              height={798}
              alt=""
              aria-hidden
              priority
              className="absolute -top-6 right-0 h-auto w-16 drop-shadow"
            />
            <span className="text-primary-foreground">Faz</span>
            <span className="italic text-brand">Tudo</span>
          </span>
          <p className="mt-5 text-lg font-medium leading-snug">
            <span className="block text-primary-foreground">
              Conectando você aos
            </span>
            <span className="block font-bold text-brand">
              melhores profissionais.
            </span>
          </p>
        </div>

        {/* Herói: trio grande, ancorado na base */}
        <div className="relative z-10 flex min-h-0 flex-1 items-end justify-center">
          <Image
            src="/brand/mascote-trio.webp"
            width={1100}
            height={650}
            alt="Profissionais FazTudo: eletricista, pintora e pedreiro"
            priority
            className="h-auto max-h-full w-[126%] max-w-none object-contain object-bottom drop-shadow-2xl"
          />
        </div>

        {/* Rodapé: degradê de transição (cobre o corte) + selos + carregando */}
        <div className="relative z-20 -mt-20 bg-gradient-to-t from-blue-900 from-30% via-blue-900/80 to-transparent px-6 pb-7 pt-20">
          <div className="mx-auto grid w-full max-w-sm grid-cols-4 gap-2">
            {TRUST.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 text-center"
              >
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
      </div>
    </main>
  );
}
