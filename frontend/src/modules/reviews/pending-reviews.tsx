/**
 * `PendingReviews` — leads que o usuário logado ainda pode avaliar.
 *
 * Usa `GET /reviews/me/pending`. Cada item (card branco com `IconChip`/`Avatar`)
 * tem um botão "Avaliar" que abre o `ReviewForm` inline. Ao enviar com sucesso,
 * invalida as queries (a lista de pendentes e as avaliações recebidas) — o item
 * some da lista.
 */
"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

import { fetchPending } from "./api";
import { ReviewForm } from "./review-form";
import type { PendingReviewItem } from "./types";
import {
  pendingCategoryName,
  pendingCounterpartyName,
  pendingLeadTitle,
  reviewErrorMessage,
} from "./utils";

export const pendingReviewsKey = ["reviews", "pending"] as const;

export function PendingReviews({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<PendingReviewItem[]>({
    queryKey: pendingReviewsKey,
    queryFn: fetchPending,
  });

  function handleSuccess() {
    setOpenId(null);
    void queryClient.invalidateQueries({ queryKey: pendingReviewsKey });
    void queryClient.invalidateQueries({ queryKey: ["reviews", "received"] });
  }

  const count = data?.length ?? 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="h-5 w-5 text-brand" aria-hidden />
          Avaliações pendentes
          {!isLoading && !isError && count > 0 && (
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {count}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Carregando...</span>
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {reviewErrorMessage(
              error,
              "Não foi possível carregar as avaliações pendentes."
            )}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Tudo em dia"
            description="Você não tem avaliações pendentes no momento."
            className="border-0 bg-transparent py-8"
          />
        ) : (
          <ul className="space-y-3">
            {data.map((item) => {
              const isOpen = openId === item.lead_id;
              const counterparty = pendingCounterpartyName(item);
              const category = pendingCategoryName(item);
              return (
                <li
                  key={item.lead_id}
                  className="rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar
                        name={counterparty ?? "Profissional"}
                        size="md"
                        className="shrink-0"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {category && (
                            <Badge variant="secondary">{category}</Badge>
                          )}
                          <p className="font-semibold text-foreground">
                            {pendingLeadTitle(item)}
                          </p>
                        </div>
                        {counterparty && (
                          <p className="text-sm text-muted-foreground">
                            Avaliar: {counterparty}
                          </p>
                        )}
                      </div>
                    </div>
                    {!isOpen && (
                      <Button
                        size="sm"
                        className="shrink-0 bg-brand text-brand-foreground hover:bg-brand/90"
                        onClick={() => setOpenId(item.lead_id)}
                      >
                        <Star className="mr-2 h-4 w-4" aria-hidden />
                        Avaliar
                      </Button>
                    )}
                  </div>

                  {isOpen && (
                    <ReviewForm
                      leadId={item.lead_id}
                      subtitle={
                        counterparty
                          ? `Você está avaliando ${counterparty}.`
                          : undefined
                      }
                      onSuccess={handleSuccess}
                      onCancel={() => setOpenId(null)}
                      className="mt-4 border-dashed bg-muted/30"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
