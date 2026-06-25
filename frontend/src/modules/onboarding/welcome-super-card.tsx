"use client";

/**
 * `WelcomeSuperCard` — celebração ao completar o perfil 100% e ganhar o bônus.
 * Carteira cheia de créditos (ilustração SVG) + parabéns + CTA para o tour.
 */

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function WelcomeSuperCard({
  amount,
  onContinue,
}: {
  amount: number;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4">
      <div className="w-[min(92vw,24rem)] overflow-hidden rounded-3xl border border-border bg-card text-center shadow-2xl">
        {/* Cabeçalho com a ilustração da carteira */}
        <div className="relative bg-gradient-to-b from-primary to-[#0A357D] px-6 pb-5 pt-8">
          <Sparkles
            className="absolute left-6 top-6 h-5 w-5 text-orange-300"
            aria-hidden
          />
          <Sparkles
            className="absolute right-7 top-9 h-4 w-4 text-orange-200"
            aria-hidden
          />
          <Sparkles
            className="absolute bottom-4 left-10 h-3.5 w-3.5 text-orange-200/80"
            aria-hidden
          />
          <svg
            viewBox="0 0 220 150"
            className="mx-auto h-32 w-auto"
            role="img"
            aria-label="Carteira cheia de créditos"
          >
            {/* moedas saindo da carteira */}
            <g>
              <circle cx="78" cy="40" r="17" fill="#FFD27A" stroke="#FF6D00" strokeWidth="3" />
              <text x="78" y="46" textAnchor="middle" fontSize="17" fontWeight="bold" fill="#FF6D00">C</text>
              <circle cx="112" cy="30" r="17" fill="#FFD27A" stroke="#FF6D00" strokeWidth="3" />
              <text x="112" y="36" textAnchor="middle" fontSize="17" fontWeight="bold" fill="#FF6D00">C</text>
              <circle cx="146" cy="42" r="17" fill="#FFD27A" stroke="#FF6D00" strokeWidth="3" />
              <text x="146" y="48" textAnchor="middle" fontSize="17" fontWeight="bold" fill="#FF6D00">C</text>
            </g>
            {/* corpo da carteira */}
            <rect x="40" y="58" width="140" height="74" rx="12" fill="#FF6D00" />
            <rect x="40" y="58" width="140" height="74" rx="12" fill="url(#g)" opacity="0.15" />
            <path d="M40 78 h140 v40 a12 12 0 0 1 -12 12 H52 a12 12 0 0 1 -12 -12 Z" fill="#E25E00" />
            {/* aba + botão da carteira */}
            <rect x="132" y="86" width="48" height="26" rx="8" fill="#FFF4E6" />
            <circle cx="156" cy="99" r="6" fill="#FF6D00" />
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" />
                <stop offset="1" stopColor="#000" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Texto + CTA */}
        <div className="px-6 py-6">
          <p className="text-lg font-extrabold tracking-tight text-foreground">
            Perfil completo!
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Você ganhou{" "}
            <strong className="text-brand">{amount} créditos</strong> de
            boas-vindas. Use-os para desbloquear seus primeiros pedidos — sem
            pagar nada agora.
          </p>
          <Button
            type="button"
            size="lg"
            onClick={onContinue}
            className="mt-5 w-full bg-brand text-brand-foreground hover:bg-brand/90"
          >
            Conhecer o app
          </Button>
        </div>
      </div>
    </div>
  );
}
