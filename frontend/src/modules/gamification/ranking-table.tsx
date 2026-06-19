/**
 * `RankingTable` — pódio + lista do ranking de profissionais.
 *
 * Carrega `GET /gamification/ranking` via React Query (filtros opcionais por
 * cidade/UF). O top 3 ganha um **pódio destacado** (medalhas/cores) com
 * `Avatar`; os demais aparecem em cards de lista com posição, nome, headline,
 * cidade/UF, nível (badge), XP e estrelas. Apenas tokens do design system.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Medal, Trophy } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
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

/** Estilo do pódio por posição: cores tonais da marca para a medalha. */
const PODIUM_STYLE: Record<
  1 | 2 | 3,
  { medal: string; ring: string; order: string }
> = {
  1: {
    medal: "bg-brand text-brand-foreground",
    ring: "ring-brand/40",
    // 1º no centro em telas maiores.
    order: "order-2 sm:-mt-4",
  },
  2: {
    medal: "bg-primary text-primary-foreground",
    ring: "ring-primary/30",
    order: "order-1",
  },
  3: {
    medal: "bg-primary/70 text-primary-foreground",
    ring: "ring-primary/20",
    order: "order-3",
  },
};

function locationLabel(item: RankingItem): string | null {
  const city = item.city?.trim();
  const state = item.state?.trim();
  if (city && state) return `${city}/${state}`;
  return city || state || null;
}

/** Card do pódio (top 3) — vertical, com avatar grande e medalha. */
function PodiumCard({
  item,
  position,
}: {
  item: RankingItem;
  position: 1 | 2 | 3;
}) {
  const style = PODIUM_STYLE[position];
  const name = item.name?.trim() || "Profissional";
  const location = locationLabel(item);
  const level = typeof item.level === "number" ? item.level : 0;
  const xp = typeof item.xp === "number" ? item.xp : 0;
  const rating = typeof item.rating === "number" ? item.rating : 0;

  return (
    <li
      className={cn(
        "flex flex-col items-center rounded-2xl border bg-card p-4 text-center shadow-sm",
        position === 1 && "border-brand/40",
        style.order
      )}
    >
      <div className="relative">
        <Avatar
          name={name}
          size="lg"
          className={cn("ring-2", style.ring)}
        />
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-1.5 left-1/2 inline-flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full text-xs font-bold shadow-sm ring-2 ring-card",
            style.medal
          )}
        >
          {position}
        </span>
      </div>
      <span className="sr-only">{position}º lugar</span>

      <p className="mt-3 line-clamp-1 text-sm font-bold text-foreground">
        {name}
      </p>
      {item.headline?.trim() && (
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {item.headline}
        </p>
      )}

      {location && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {location}
        </p>
      )}

      <div className="mt-2 flex items-center gap-1">
        <StarRating value={rating} size="sm" />
        <span className="text-xs tabular-nums text-muted-foreground">
          {rating.toFixed(1)}
        </span>
      </div>

      <div className="mt-3 flex flex-col items-center gap-1.5">
        <LevelBadge level={level} name={item.level_name} size="sm" />
        <p className="text-sm font-bold tabular-nums text-foreground">
          {formatXp(xp)}{" "}
          <span className="text-xs font-medium text-muted-foreground">XP</span>
        </p>
      </div>
    </li>
  );
}

/** Linha da lista (4º em diante). */
function RankingRow({
  item,
  position,
}: {
  item: RankingItem;
  position: number;
}) {
  const name = item.name?.trim() || "Profissional";
  const location = locationLabel(item);
  const level = typeof item.level === "number" ? item.level : 0;
  const xp = typeof item.xp === "number" ? item.xp : 0;
  const rating = typeof item.rating === "number" ? item.rating : 0;

  return (
    <li className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm sm:gap-4 sm:p-4">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold tabular-nums text-muted-foreground sm:h-10 sm:w-10"
      >
        {position}
      </span>
      <span className="sr-only">{position}º lugar</span>

      <Avatar name={name} size="md" className="hidden shrink-0 sm:inline-flex" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground sm:text-base">
          {name}
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

      <div className="flex shrink-0 flex-col items-end gap-1">
        <LevelBadge level={level} name={item.level_name} size="sm" iconOnly />
        <p className="text-xs font-semibold tabular-nums text-foreground">
          {formatXp(xp)}{" "}
          <span className="font-normal text-muted-foreground">XP</span>
        </p>
      </div>
    </li>
  );
}

export function RankingTable({ filters = {}, className }: RankingTableProps) {
  const { data, isLoading, isError, error } = useQuery<RankingItem[]>({
    queryKey: rankingKey(filters),
    queryFn: () => fetchRanking(filters),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Carregando ranking...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {gamificationErrorMessage(error, "Não foi possível carregar o ranking.")}
      </div>
    );
  }

  const items = data ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Ranking vazio"
        description="Nenhum profissional no ranking ainda. Volte em breve."
      />
    );
  }

  const podium = items.slice(0, 3);
  const rest = items.slice(3);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Pódio (top 3) — 1º destacado/centralizado em telas maiores. */}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        {podium.map((item, idx) => (
          <PodiumCard
            key={`podium-${item.name ?? "pro"}-${idx}`}
            item={item}
            position={(idx + 1) as 1 | 2 | 3}
          />
        ))}
      </ul>

      {/* Demais posições. */}
      {rest.length > 0 && (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Medal className="h-3.5 w-3.5" aria-hidden />
            Demais colocados
          </p>
          <ul className="space-y-3">
            {rest.map((item, idx) => (
              <RankingRow
                key={`row-${item.name ?? "pro"}-${idx}`}
                item={item}
                position={idx + 4}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
