/**
 * `ReviewList` — lista de avaliações RECEBIDAS por um usuário.
 *
 * Cada item mostra: `Avatar` + autor, estrelas (nota), comentário (quando
 * houver) e data. Estados de loading/erro/vazio tratados. Usa apenas tokens
 * do design system.
 */
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquare } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { apiPost } from "@/services/api";

import { fetchUserReviews } from "./api";
import { StarRating } from "./star-rating";
import type { ReceivedReview } from "./types";

function ReviewReply({
  review,
  canReply,
}: {
  review: ReceivedReview;
  canReply: boolean;
}) {
  const [reply, setReply] = useState<string | null>(review.reply ?? null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  if (reply) {
    return (
      <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground">
        <span className="font-semibold">Resposta:</span> {reply}
      </p>
    );
  }
  if (!canReply || !review.id) return null;

  async function submit() {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try {
      await apiPost(`/reviews/${review.id}/reply`, { reply: t });
      setReply(t);
    } catch {
      /* mantém o formulário */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Responder a esta avaliação..."
        maxLength={1000}
        className="flex-1 rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className="rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
      >
        Responder
      </button>
    </div>
  );
}
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
  /** Exibe um resumo (média + total) acima da lista. */
  showSummary?: boolean;
  /** Permite ao dono responder às avaliações recebidas (#51). */
  canReply?: boolean;
}

export function ReviewList({
  userId,
  className,
  emptyLabel = "Ainda não há avaliações.",
  showSummary = false,
  canReply = false,
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

  const total = reviews.length;
  const average =
    reviews.reduce((sum, r) => sum + (r.score || 0), 0) / total;

  return (
    <div className={className}>
      {showSummary && (
        <div className="mb-4 flex items-center gap-4 rounded-xl border bg-muted/30 px-4 py-3">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-extrabold leading-none tabular-nums text-foreground">
              {average.toFixed(1)}
            </span>
            <StarRating value={average} size="sm" className="mt-1.5" />
          </div>
          <span className="h-10 w-px bg-border" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {total}{" "}
            {total === 1 ? "avaliação recebida" : "avaliações recebidas"}
          </p>
        </div>
      )}
      <ul className="space-y-3">
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
                <ReviewReply review={review} canReply={canReply} />
              </div>
            </div>
          </li>
        );
        })}
      </ul>
    </div>
  );
}
