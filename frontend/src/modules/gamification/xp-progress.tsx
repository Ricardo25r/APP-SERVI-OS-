/**
 * `XpProgress` — card com XP atual, nível e barra de progresso até o próximo nível.
 *
 * Carrega `GET /gamification/me` via React Query (trata loading/erro/dados
 * defensivos). A barra usa `bg-primary` sobre `bg-muted`; a % é calculada por
 * `levelProgress`. Mostra "faltam X XP para {próximo nível}". Só tokens.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, Trophy } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { fetchMe } from "./api";
import { LevelBadge } from "./level-badge";
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
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
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
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
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

  const nextLevelName =
    me.next_level_name ??
    (me.next_level != null ? `Nível ${me.next_level}` : null);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Trophy className="h-5 w-5 text-brand" aria-hidden />
              Seu nível
            </CardTitle>
            <CardDescription>
              Ganhe XP ao comprar leads e receber boas avaliações.
            </CardDescription>
          </div>
          <LevelBadge level={level} name={me.level_name} size="lg" iconOnly />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Resumo: nível atual + XP total */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Nível atual</p>
            <div className="mt-1">
              <LevelBadge level={level} name={me.level_name} size="md" />
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">XP total</p>
            <p className="flex items-center justify-end gap-1.5 text-2xl font-bold leading-tight tabular-nums">
              <TrendingUp className="h-5 w-5 text-brand" aria-hidden />
              {formatXp(xp)}
            </p>
          </div>
        </div>

        {/* Barra de progresso até o próximo nível */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {progress.isMaxLevel
                ? "Nível máximo alcançado"
                : `Progresso até ${nextLevelName ?? "o próximo nível"}`}
            </span>
            {!progress.isMaxLevel && (
              <span className="tabular-nums text-muted-foreground">
                {progress.percent}%
              </span>
            )}
          </div>

          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.isMaxLevel ? 100 : progress.percent}
            aria-label="Progresso de nível"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.isMaxLevel ? 100 : progress.percent}%` }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {progress.isMaxLevel
              ? "Você está no topo. Continue assim!"
              : `Faltam ${formatXp(progress.xpRemaining)} XP para ${
                  nextLevelName ?? "o próximo nível"
                }.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
