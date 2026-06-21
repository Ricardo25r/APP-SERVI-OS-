/**
 * `LevelJourney` — trilha dos níveis do FazTudo (Iniciante → Lenda).
 *
 * Lê `GET /gamification/levels` (tabela de referência) e cruza com o
 * `GET /gamification/me` (mesma query key do `XpProgress`, cache compartilhado)
 * para destacar o nível atual, marcar os concluídos e mostrar o XP necessário
 * dos próximos. Só tokens do design system.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Lock, Trophy } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { fetchLevels, fetchMe } from "./api";
import { gamificationMeKey } from "./xp-progress";
import type { GamificationLevel, GamificationMe } from "./types";
import { formatXp, gamificationErrorMessage } from "./utils";

export const gamificationLevelsKey = ["gamification", "levels"] as const;

type LevelState = "done" | "current" | "locked";

export function LevelJourney({ className }: { className?: string }) {
  const levelsQ = useQuery<GamificationLevel[]>({
    queryKey: gamificationLevelsKey,
    queryFn: fetchLevels,
  });
  const meQ = useQuery<GamificationMe>({
    queryKey: gamificationMeKey,
    queryFn: fetchMe,
  });

  const currentLevel = meQ.data?.level ?? 0;
  const xp = meQ.data?.xp ?? 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-brand" aria-hidden />
          Jornada de níveis
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {levelsQ.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Carregando níveis...</span>
          </div>
        ) : levelsQ.isError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {gamificationErrorMessage(
              levelsQ.error,
              "Não foi possível carregar a tabela de níveis."
            )}
          </div>
        ) : (
          <ol className="space-y-2">
            {(levelsQ.data ?? []).map((lvl) => {
              const state: LevelState =
                lvl.level < currentLevel
                  ? "done"
                  : lvl.level === currentLevel
                    ? "current"
                    : "locked";
              return (
                <LevelRow key={lvl.level} level={lvl} state={state} xp={xp} />
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function LevelRow({
  level,
  state,
  xp,
}: {
  level: GamificationLevel;
  state: LevelState;
  xp: number;
}) {
  const subtitle =
    state === "current"
      ? `${formatXp(xp)} XP acumulados`
      : state === "done"
        ? "Concluído"
        : `A partir de ${formatXp(level.min_xp)} XP`;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-colors",
        state === "current"
          ? "border-brand/40 bg-brand/[0.05]"
          : "border-border bg-card",
        state === "locked" && "opacity-70"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold leading-none shadow-sm ring-2",
          state === "locked"
            ? "bg-muted text-muted-foreground ring-transparent"
            : state === "current"
              ? "bg-brand text-brand-foreground ring-brand/30"
              : "bg-primary text-primary-foreground ring-primary/20"
        )}
      >
        {state === "done" ? (
          <Check className="h-5 w-5" aria-hidden />
        ) : state === "locked" ? (
          <Lock className="h-4 w-4" aria-hidden />
        ) : (
          level.level
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">
          {level.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {state === "current" ? (
        <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold leading-none text-brand-foreground">
          Você está aqui
        </span>
      ) : (
        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
          Nível {level.level}
        </span>
      )}
    </li>
  );
}
