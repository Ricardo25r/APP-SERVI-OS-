/**
 * `MyRankCard` — faixa de destaque "Sua posição" no ranking.
 *
 * Lê `GET /gamification/ranking/me` e mostra o Nº do profissional logado sobre o
 * total, com nível e XP. Renderiza `null` para quem não está ranqueado
 * (customer). Mesma estética do card de XP (faixa azul → navy). Só tokens.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { Medal, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

import { fetchMyRank } from "./api";
import type { MyRank } from "./types";
import { formatXp } from "./utils";

export const myRankKey = ["gamification", "rank", "me"] as const;

export function MyRankCard({ className }: { className?: string }) {
  const { data } = useQuery<MyRank>({
    queryKey: myRankKey,
    queryFn: fetchMyRank,
  });

  if (!data || !data.is_ranked || !data.rank) return null;

  const { rank, total, xp, level, level_name } = data;
  const isLeader = rank === 1;
  const levelLabel = level_name?.trim() || `Nível ${level}`;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#0A357D] p-5 text-primary-foreground shadow-sm sm:p-6",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary-foreground/70">
            Sua posição
          </p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="text-4xl font-bold leading-none tabular-nums">
              Nº {rank}
            </span>
            <span className="text-sm font-medium text-primary-foreground/70">
              de {formatXp(total)}
            </span>
          </p>
        </div>
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/10 ring-2 ring-primary-foreground/20"
        >
          <Trophy className="h-7 w-7 text-brand" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-primary-foreground/15 pt-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Medal className="h-4 w-4 text-brand" aria-hidden />
          {levelLabel}
        </span>
        <p className="text-sm font-bold tabular-nums">
          {formatXp(xp)}{" "}
          <span className="text-xs font-medium text-primary-foreground/70">
            XP
          </span>
        </p>
      </div>

      <p className="mt-3 text-xs text-primary-foreground/70">
        {isLeader
          ? "Você lidera o ranking. Mantenha o ritmo!"
          : "Compre leads e receba boas avaliações para subir de posição."}
      </p>
    </div>
  );
}
