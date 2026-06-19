/**
 * `ReviewForm` — formulário de avaliação para um lead.
 *
 * Card com seleção de estrelas (1–5, `StarRatingInput`) + Textarea (comentário
 * opcional) + Button "Enviar avaliação". Trata loading e erros (403/409/422)
 * com mensagens PT-BR. Em sucesso, chama `onSuccess`.
 */
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createReview } from "./api";
import { StarRatingInput } from "./star-rating";
import { reviewErrorMessage } from "./utils";

interface ReviewFormProps {
  leadId: string;
  /** Texto auxiliar (ex.: nome de quem está sendo avaliado). */
  subtitle?: string;
  /** Chamado após criar a avaliação com sucesso. */
  onSuccess?: () => void;
  /** Chamado ao cancelar/fechar o formulário (quando exibido como painel). */
  onCancel?: () => void;
  className?: string;
}

export function ReviewForm({
  leadId,
  subtitle,
  onSuccess,
  onCancel,
  className,
}: ReviewFormProps) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: () => createReview({ lead_id: leadId, score, comment }),
    onSuccess: () => onSuccess?.(),
  });

  const scoreInvalid = score < 1 || score > 5;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (scoreInvalid) return;
    mutation.mutate();
  }

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor={`review-stars-${leadId}`}>Sua nota</Label>
            <div className="flex flex-wrap items-center gap-3">
              <StarRatingInput
                value={score}
                onChange={(v) => {
                  setScore(v);
                  setTouched(true);
                }}
                disabled={mutation.isPending}
                label="Selecione uma nota de 1 a 5 estrelas"
              />
              {score > 0 && (
                <span className="text-sm text-muted-foreground">
                  {score} de 5
                </span>
              )}
            </div>
            {touched && scoreInvalid && (
              <p className="text-xs text-destructive">
                Escolha de 1 a 5 estrelas para enviar.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`review-comment-${leadId}`}>
              Comentário (opcional)
            </Label>
            <Textarea
              id={`review-comment-${leadId}`}
              placeholder="Conte como foi a experiência."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={mutation.isPending}
              rows={3}
              maxLength={1000}
            />
          </div>

          {mutation.isError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {reviewErrorMessage(mutation.error)}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={mutation.isPending || scoreInvalid}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              )}
              Enviar avaliação
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
