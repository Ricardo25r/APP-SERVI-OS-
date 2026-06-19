/**
 * `TransactionList` — lista o histórico de movimentações de crédito do
 * profissional (tela 20 — Carteira).
 *
 * Apresentacional: recebe as transações já carregadas. Cada linha tem um
 * `IconChip` (verde para entrada, laranja/`text-destructive` para saída), a
 * descrição/rótulo, a data e o valor com sinal (+/-). Suporta um filtro local
 * por tipo de movimentação (Todas / Entradas / Saídas).
 */
"use client";

import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { IconChip } from "@/components/ui/icon-chip";
import { cn } from "@/lib/utils";
import type { CreditTransaction } from "@/types";

import {
  creditTransactionMeta,
  formatDateTime,
  formatSignedAmount,
} from "./utils";

type Filter = "all" | "in" | "out";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "in", label: "Entradas" },
  { value: "out", label: "Saídas" },
];

interface TransactionListProps {
  transactions: CreditTransaction[];
  /** Exibe os botões de filtro (Todas/Entradas/Saídas). */
  showFilter?: boolean;
  className?: string;
}

export function TransactionList({
  transactions,
  showFilter = true,
  className,
}: TransactionListProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter((tx) => {
      const { isCredit } = creditTransactionMeta(tx);
      return filter === "in" ? isCredit : !isCredit;
    });
  }, [transactions, filter]);

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Nenhuma movimentação ainda"
        description="Compre créditos ou adquira leads para ver seu histórico aqui."
        className={className}
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {showFilter && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma movimentação para este filtro.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((tx) => {
            const meta = creditTransactionMeta(tx);
            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <IconChip
                  icon={meta.icon}
                  color={meta.iconColor}
                  size="md"
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {meta.label}
                  </p>
                  {tx.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {tx.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(tx.created_at)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "text-base font-bold tabular-nums",
                      meta.isCredit ? "text-success" : "text-destructive"
                    )}
                  >
                    {formatSignedAmount(tx)}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Saldo: {tx.balance_after}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
