/**
 * `XpHistory` — lista das transações recentes de XP do profissional.
 *
 * Lê `recent_transactions` de `GET /gamification/me` (mesma query key do
 * `XpProgress`, compartilhando cache). Cada item mostra o motivo traduzido p/
 * PT-BR, a data e o valor com sinal (+/-). Só tokens do design system.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { fetchMe } from "./api";
import { gamificationMeKey } from "./xp-progress";
import type { GamificationMe } from "./types";
import {
  formatSignedXp,
  formatXpDate,
  gamificationErrorMessage,
  xpSourceLabel,
} from "./utils";

export function XpHistory({ className }: { className?: string }) {
  const { data, isLoading, isError, error } = useQuery<GamificationMe>({
    queryKey: gamificationMeKey,
    queryFn: fetchMe,
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="h-5 w-5 text-brand" aria-hidden />
          Histórico de XP
        </CardTitle>
        <CardDescription>
          Suas atividades recentes que geraram pontos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Carregando histórico...</span>
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {gamificationErrorMessage(
              error,
              "Não foi possível carregar o histórico de XP."
            )}
          </div>
        ) : (
          <XpTransactionList transactions={data?.recent_transactions ?? []} />
        )}
      </CardContent>
    </Card>
  );
}

function XpTransactionList({
  transactions,
}: {
  transactions: NonNullable<GamificationMe["recent_transactions"]>;
}) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <Sparkles className="h-6 w-6 text-muted-foreground/60" aria-hidden />
        <span>Você ainda não acumulou XP. Comece a usar o FazTudo!</span>
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {transactions.map((tx, idx) => {
        const isPositive = tx.amount >= 0;
        return (
          <li
            key={`${tx.source}-${tx.created_at}-${idx}`}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {xpSourceLabel(tx.source)}
              </p>
              {tx.description?.trim() && (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {tx.description}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatXpDate(tx.created_at)}
              </p>
            </div>

            <p
              className={cn(
                "shrink-0 text-lg font-semibold tabular-nums",
                isPositive ? "text-success" : "text-destructive"
              )}
            >
              {formatSignedXp(tx.amount)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                XP
              </span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
