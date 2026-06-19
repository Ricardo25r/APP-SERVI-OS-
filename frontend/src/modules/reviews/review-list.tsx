/**
 * `ReviewList` — lista de avaliações RECEBIDAS por um usuário.
 *
 * Cada item mostra: `Avatar` + autor, estrelas (nota), comentário (quando
 * houver) e data. Estados de loading/erro/vazio tratados. Usa apenas tokens
 * do design system.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquare } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

import { fetchUserReviews } from "./api";
import { StarRating } from "./star-rating";
import type { ReceivedReview } from "./types";
import {
  formatReviewDate,
  reviewAuthorName,
  reviewErrorMessage,
} from "./utils";

export const userReviewsKey = (userId: string) =>
  ["reviews", "received", userId] as const;

interface ReviewListProps {
  userId: string;
  className?: string;
  /** Mensagem quando não há avaliações. */
  emptyLabel?: string;
}

export function ReviewList({
  userId,
  className,
  emptyLabel = "Ainda não há avaliações.",
}: ReviewListProps) {
  const { data, isLoading, isError, error } = useQuery<ReceivedReview[]>({
    queryKey: userReviewsKey(userId),
    queryFn: () => fetchUserReviews(userId),
    enabled: Boolean(userId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Carregando avaliações...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {reviewErrorMessage(error, "Não foi possível carregar as avaliações.")}
      </div>
    );
  }

  const reviews = data ?? [];

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Sem avaliações"
        description={emptyLabel}
        className="border-0 bg-transparent py-8"
      />
    );
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {reviews.map((review, idx) => {
        const author = reviewAuthorName(review);
        return (
          <li
            key={review.id ?? idx}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <Avatar name={author} size="md" className="shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {author}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatReviewDate(review.created_at)}
                  </span>
                </div>
                <StarRating value={review.score} size="sm" />
                {review.comment?.trim() && (
                  <p className="text-sm text-muted-foreground">
                    {review.comment}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
