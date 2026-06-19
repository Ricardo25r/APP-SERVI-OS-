/**
 * `ReviewList` — lista de avaliações RECEBIDAS por um usuário.
 *
 * Cada item mostra: estrelas (nota), comentário (quando houver), autor e data.
 * Estados de loading/erro/vazio tratados. Usa apenas tokens do design system.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquare } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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
        className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {reviewErrorMessage(
          error,
          "Não foi possível carregar as avaliações."
        )}
      </div>
    );
  }

  const reviews = data ?? [];

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <MessageSquare className="h-6 w-6 text-muted-foreground/60" aria-hidden />
        <span>{emptyLabel}</span>
      </div>
    );
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {reviews.map((review, idx) => (
        <li key={review.id ?? idx}>
          <Card>
            <CardContent className="space-y-2 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StarRating value={review.score} size="sm" />
                  <span className="text-sm font-medium">
                    {reviewAuthorName(review)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatReviewDate(review.created_at)}
                </span>
              </div>
              {review.comment?.trim() && (
                <p className="text-sm text-muted-foreground">
                  {review.comment}
                </p>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
