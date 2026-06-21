/**
 * `AchievementsSection` — medalhas/conquistas do profissional.
 *
 * Lê `GET /gamification/achievements` (que também concede as recém-ganhas).
 * Mostra cada conquista como medalha: ganha (laranja) ou bloqueada (cinza),
 * com o XP de recompensa. Só tokens do design system.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, Loader2, Lock } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { fetchAchievements } from "./api";
import type { AchievementsResponse } from "./types";
import { gamificationErrorMessage } from "./utils";

export const achievementsKey = ["gamification", "achievements"] as const;

export function AchievementsSection({ className }: { className?: string }) {
  const { data, isLoading, isError, error } = useQuery<AchievementsResponse>({
    queryKey: achievementsKey,
    queryFn: fetchAchievements,
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Award className="h-5 w-5 text-brand" aria-hidden />
          Conquistas
          {data ? (
            <span className="ml-auto text-sm font-semibold text-muted-foreground tabular-nums">
              {data.earned_count}/{data.total}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Carregando conquistas...</span>
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {gamificationErrorMessage(
              error,
              "Não foi possível carregar as conquistas."
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(data?.items ?? []).map((a) => (
              <li
                key={a.slug}
                className={cn(
                  "flex flex-col items-center rounded-xl border p-3 text-center",
                  a.earned
                    ? "border-brand/40 bg-brand/[0.05]"
                    : "border-border opacity-70"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full",
                    a.earned
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {a.earned ? (
                    <Award className="h-6 w-6" />
                  ) : (
                    <Lock className="h-5 w-5" />
                  )}
                </span>
                <p className="mt-2 text-sm font-bold text-foreground">
                  {a.name}
                </p>
                {a.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {a.description}
                  </p>
                ) : null}
                <p
                  className={cn(
                    "mt-1 text-[11px] font-bold tabular-nums",
                    a.earned ? "text-brand" : "text-muted-foreground"
                  )}
                >
                  +{a.xp_reward} XP
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
