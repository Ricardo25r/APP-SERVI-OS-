/**
 * `PendingReviews` — leads que o usuário logado ainda pode avaliar.
 *
 * Usa `GET /reviews/me/pending`. Cada item tem um botão "Avaliar" que abre o
 * `ReviewForm` inline. Ao enviar com sucesso, invalida as queries (a lista de
 * pendentes e as avaliações recebidas) — o item some da lista.
 */
"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-xl">Avaliações pendentes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Carregando...</span>
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {reviewErrorMessage(
              error,
              "Não foi possível carregar as avaliações pendentes."
            )}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Você não tem avaliações pendentes no momento.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.map((item) => {
              const isOpen = openId === item.lead_id;
              const counterparty = pendingCounterpartyName(item);
              const category = pendingCategoryName(item);
              return (
                <li
                  key={item.lead_id}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {category && (
                          <Badge variant="secondary">{category}</Badge>
                        )}
                        <p className="font-medium">
                          {pendingLeadTitle(item)}
                        </p>
                      </div>
                      {counterparty && (
                        <p className="text-sm text-muted-foreground">
                          Avaliar: {counterparty}
                        </p>
                      )}
                    </div>
                    {!isOpen && (
                      <Button
                        size="sm"
                        variant="outline"
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
                      className="mt-4 border-dashed"
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
