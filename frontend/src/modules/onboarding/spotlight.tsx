"use client";

/**
 * `SpotlightTour` — tour guiado com "holofote": escurece a tela e ilumina só o
 * elemento alvo (via `box-shadow` gigante no buraco), com um balão explicativo.
 * O alvo é localizado por `[data-tour="<key>"]`. Mede a posição em tempo real
 * (scroll/resize) e rola o alvo para o centro. Não bloqueia a interação com o
 * campo destacado (o holofote é visual): o usuário preenche e clica "Próximo".
 */

import { type CSSProperties, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface TourStep {
  /** valor do atributo data-tour do elemento alvo */
  target: string;
  title: string;
  body: string;
  /** rótulo do botão de avançar (default "Próximo" / "Concluir") */
  ctaLabel?: string;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function SpotlightTour({
  steps,
  onDone,
  onSkip,
  skipLabel = "Pular",
}: {
  steps: TourStep[];
  onDone: () => void;
  onSkip: () => void;
  skipLabel?: string;
}) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const step = steps[i];

  useEffect(() => {
    if (!step) return;
    const sel = `[data-tour="${step.target}"]`;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setBox(null);
      }
    };
    const el = document.querySelector<HTMLElement>(sel);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();
    // Re-mede por um tempinho (acompanha o scroll suave) + em scroll/resize.
    const id = window.setInterval(measure, 120);
    const stop = window.setTimeout(() => window.clearInterval(id), 900);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  if (!mounted || !step) return null;

  const last = i >= steps.length - 1;
  const pad = 8;
  const vh = window.innerHeight;
  const placeAbove = box ? box.top + box.height + 180 > vh : false;

  const tooltipStyle: CSSProperties = box
    ? placeAbove
      ? {
          top: Math.max(16, box.top - pad - 12),
          transform: "translate(-50%, -100%)",
        }
      : { top: box.top + box.height + pad + 12 }
    : { top: "50%", transform: "translate(-50%, -50%)" };

  const overlay = (
    <div className="pointer-events-none fixed inset-0 z-[80]">
      {box ? (
        <div
          className="absolute rounded-xl ring-2 ring-brand/70 transition-all duration-200"
          style={{
            top: box.top - pad,
            left: box.left - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/70" />
      )}

      <div
        className="pointer-events-auto absolute left-1/2 w-[min(92vw,22rem)] -translate-x-1/2 rounded-2xl border border-border bg-card p-4 shadow-xl"
        style={tooltipStyle}
      >
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <p className="text-sm font-bold tracking-tight text-foreground">
            {step.title}
          </p>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {i + 1}/{steps.length}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {skipLabel}
          </button>
          <button
            type="button"
            onClick={() => (last ? onDone() : setI((v) => v + 1))}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {step.ctaLabel ?? (last ? "Concluir" : "Próximo")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
