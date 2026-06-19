/**
 * `TransactionList` — lista o histórico de transações de crédito do profissional.
 *
 * Apresentacional: recebe as transações já carregadas. Para cada item mostra o
 * tipo (Badge), a descrição, a data e o valor com sinal (+/-).
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CreditTransaction } from "@/types";

import {
  creditTransactionMeta,
  formatDateTime,
  formatSignedAmount,
} from "./utils";

interface TransactionListProps {
  transactions: CreditTransaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Você ainda não tem transações de crédito.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {transactions.map((tx) => {
        const meta = creditTransactionMeta(tx);
        return (
          <li
            key={tx.id}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </div>
              {tx.description && (
                <p className="mt-1 truncate text-sm text-foreground">
                  {tx.description}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDateTime(tx.created_at)}
              </p>
            </div>

            <div className="text-right">
              <p
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  meta.isCredit ? "text-green-600" : "text-destructive"
                )}
              >
                {formatSignedAmount(tx)}
              </p>
              <p className="text-xs text-muted-foreground">
                saldo: {tx.balance_after}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
