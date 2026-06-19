/**
 * `RankingTable` — lista/tabela do ranking de profissionais.
 *
 * Carrega `GET /gamification/ranking` via React Query (filtros opcionais por
 * cidade/UF). Cada linha: posição (#), nome, headline, cidade/UF, nível, XP e
 * estrelas do rating. O pódio (1º/2º/3º) é destacado com a cor da marca.
 * Apenas tokens do design system.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { StarRating } from "@/modules/reviews/star-rating";

import { fetchRanking } from "./api";
import { LevelBadge } from "./level-badge";
import type { RankingFilters, RankingItem } from "./types";
import { formatXp, gamificationErrorMessage } from "./utils";

export const rankingKey = (filters: RankingFilters) =>
  ["gamification", "ranking", filters] as const;

interface RankingTableProps {
  filters?: RankingFilters;
  className?: string;
}

/** Classes do "selo" de posição. O pódio usa a marca; demais, tom neutro. */
function positionClasses(position: number): string {
  switch (position) {
    case 1:
      return "bg-brand text-brand-foreground ring-2 ring-brand/30";
    case 2:
      return "bg-primary text-primary-foreground ring-2 ring-primary/30";
    case 3:
      return "bg-primary/70 text-primary-foreground ring-2 ring-primary/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function locationLabel(item: RankingItem): string | null {
  const city = item.city?.trim();
  const state = item.state?.trim();
  if (city && state) return `${city}/${state}`;
  return city || state || null;
}

export function RankingTable({ filters = {}, className }: RankingTableProps) {
  const { data, isLoading, isError, error } = useQuery<RankingItem[]>({
    queryKey: rankingKey(filters),
    queryFn: () => fetchRanking(filters),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Carregando ranking...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {gamificationErrorMessage(
          error,
          "Não foi possível carregar o ranking."
        )}
      </div>
    );
  }

  const items = data ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
        <Trophy className="h-7 w-7 text-muted-foreground/60" aria-hidden />
        <span>Nenhum profissional no ranking ainda.</span>
      </div>
    );
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item, idx) => {
        const position = idx + 1;
        const isPodium = position <= 3;
        const location = locationLabel(item);
        const level = typeof item.level === "number" ? item.level : 0;
        const xp = typeof item.xp === "number" ? item.xp : 0;
        const rating = typeof item.rating === "number" ? item.rating : 0;

        return (
          <li
            key={`${item.name ?? "pro"}-${idx}`}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm sm:gap-4 sm:p-4",
              isPodium && "border-brand/40"
            )}
          >
            {/* Posição */}
            <span
              aria-hidden
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums sm:h-10 sm:w-10",
                positionClasses(position)
              )}
            >
              {position}
            </span>
            <span className="sr-only">{position}º lugar</span>

            {/* Identificação */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                {item.name?.trim() || "Profissional"}
              </p>
              {item.headline?.trim() && (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">
                  {item.headline}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <StarRating value={rating} size="sm" />
                  <span className="tabular-nums">{rating.toFixed(1)}</span>
                </span>
              </div>
            </div>

            {/* Nível + XP */}
            <div className="flex shrink-0 flex-col items-end gap-1">
              <LevelBadge
                level={level}
                name={item.level_name}
                size="sm"
                iconOnly
              />
              <p className="text-xs font-semibold tabular-nums text-foreground">
                {formatXp(xp)}{" "}
                <span className="font-normal text-muted-foreground">XP</span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
