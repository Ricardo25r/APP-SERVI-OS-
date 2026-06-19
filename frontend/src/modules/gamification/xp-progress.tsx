/**
 * `XpProgress` — card de destaque com nível, XP atual e barra de progresso
 * azul até o próximo nível, acompanhado de `StatCard` (XP total / nível).
 *
 * Carrega `GET /gamification/me` via React Query (trata loading/erro/dados
 * defensivos). A barra usa `bg-primary` sobre `bg-muted`; a % é calculada por
 * `levelProgress`. Mostra "faltam X XP para {próximo nível}". Só tokens.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, Star, TrendingUp, Trophy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

import { fetchMe } from "./api";
import type { GamificationMe } from "./types";
import {
  formatXp,
  gamificationErrorMessage,
  levelProgress,
} from "./utils";

export const gamificationMeKey = ["gamification", "me"] as const;

export function XpProgress({ className }: { className?: string }) {
  const { data, isLoading, isError, error } = useQuery<GamificationMe>({
    queryKey: gamificationMeKey,
    queryFn: fetchMe,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>Carregando seu progresso...</span>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {gamificationErrorMessage(
              error,
              "Não foi possível carregar seu progresso."
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const me = data ?? { xp: 0, level: 0 };
  const xp = typeof me.xp === "number" ? me.xp : 0;
  const level = typeof me.level === "number" ? me.level : 0;
  const progress = levelProgress(me);
  const barPercent = progress.isMaxLevel ? 100 : progress.percent;

  const nextLevelName =
    me.next_level_name ??
    (me.next_level != null ? `Nível ${me.next_level}` : null);

  const levelName = me.level_name?.trim() || `Nível ${level}`;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Card de destaque (faixa azul → navy) com nível, XP e barra. */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#0A357D] text-primary-foreground shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-primary-foreground/70">
                Seu nível
              </p>
              <p className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                <Trophy className="h-6 w-6 shrink-0 text-brand" aria-hidden />
                <span className="truncate">{levelName}</span>
              </p>
            </div>
            <span
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/10 text-2xl font-bold leading-none ring-2 ring-primary-foreground/20"
            >
              {level}
            </span>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-primary-foreground/70">
              XP total
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-3xl font-bold leading-none tabular-nums">
              <TrendingUp className="h-6 w-6 text-brand" aria-hidden />
              {formatXp(xp)}
              <span className="text-base font-semibold text-primary-foreground/70">
                XP
              </span>
            </p>
          </div>

          {/* Barra de progresso azul (clara sobre a faixa) até o próximo nível. */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-primary-foreground/90">
                {progress.isMaxLevel
                  ? "Nível máximo alcançado"
                  : `Até ${nextLevelName ?? "o próximo nível"}`}
              </span>
              {!progress.isMaxLevel && (
                <span className="tabular-nums font-semibold text-primary-foreground/90">
                  {progress.percent}%
                </span>
              )}
            </div>

            <div
              className="h-3 w-full overflow-hidden rounded-full bg-primary-foreground/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={barPercent}
              aria-label="Progresso de nível"
            >
              <div
                className="h-full rounded-full bg-brand transition-all duration-500"
                style={{ width: `${barPercent}%` }}
              />
            </div>

            <p className="flex items-center gap-1.5 text-xs text-primary-foreground/70">
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {progress.isMaxLevel
                ? "Você está no topo. Continue assim!"
                : `Faltam ${formatXp(progress.xpRemaining)} XP para ${
                    nextLevelName ?? "o próximo nível"
                  }.`}
            </p>
          </div>
        </div>
      </div>

      {/* Métricas em StatCard (XP total / nível atual). */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          label="XP total"
          value={<span className="tabular-nums">{formatXp(xp)}</span>}
          icon={Star}
          iconColor="orange"
        />
        <StatCard
          label="Nível atual"
          value={
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{level}</span>
              {me.level_name?.trim() && (
                <span className="truncate text-sm font-semibold text-muted-foreground">
                  {me.level_name}
                </span>
              )}
            </span>
          }
          icon={Trophy}
          iconColor="blue"
        />
      </div>
    </div>
  );
}
