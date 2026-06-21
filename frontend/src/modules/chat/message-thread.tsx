/**
 * `MessageThread` — área de mensagens de uma conversa.
 *
 * Bolhas:
 * - minhas: `bg-primary text-primary-foreground` à direita;
 * - da contraparte: `bg-muted` à esquerda;
 * - de sistema: centralizadas/discretas em `text-muted-foreground`.
 *
 * Separadores de dia (Hoje / Ontem / data). Auto-scroll para o fim ao chegar
 * novas mensagens. **Polling** via React Query (`refetchInterval: 4000`) — ao
 * buscar, o backend marca as recebidas como lidas, então também invalidamos a
 * lista de conversas para zerar o badge de não lidas.
 *
 * Usa apenas tokens do design system.
 */
"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Check, CheckCheck, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { fetchMessages } from "./api";
import { conversationsKey } from "./conversation-list";
import type { ChatMessage } from "./types";
import {
  chatErrorMessage,
  formatDayLabel,
  formatTime,
  isSystemMessage,
} from "./utils";

export const messagesKey = (conversationId: string) =>
  ["chat", "messages", conversationId] as const;

interface MessageThreadProps {
  conversationId: string;
  /** Id do usuário logado — alinha as bolhas (minhas à direita). */
  currentUserId: string;
  className?: string;
}

export function MessageThread({
  conversationId,
  currentUserId,
  className,
}: MessageThreadProps) {
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, isError, error } = useQuery<ChatMessage[]>({
    queryKey: messagesKey(conversationId),
    queryFn: () => fetchMessages(conversationId),
    enabled: Boolean(conversationId),
    // Polling do chat (requisito da Fase 8).
    refetchInterval: 4000,
  });

  const messages = data ?? [];
  const count = messages.length;
  const lastId = messages[count - 1]?.id;

  // Buscar mensagens marca as recebidas como lidas no backend — refletimos
  // isso zerando o contador de não lidas na lista de conversas.
  useEffect(() => {
    if (count > 0) {
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
    }
  }, [count, lastId, queryClient]);

  // Auto-scroll para o fim quando o número de mensagens muda.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [count, lastId]);

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground",
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Carregando mensagens...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("flex-1 p-4", className)}>
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {chatErrorMessage(error, "Não foi possível carregar as mensagens.")}
        </div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center",
          className
        )}
      >
        <Image
          src="/brand/mascote-tudo.png"
          width={160}
          height={220}
          alt=""
          aria-hidden
          className="h-28 w-auto opacity-90 drop-shadow-sm"
        />
        <div className="space-y-0.5">
          <p className="font-semibold text-foreground">Comece a conversa</p>
          <p className="text-xs text-muted-foreground">
            Envie a primeira mensagem abaixo.
          </p>
        </div>
      </div>
    );
  }

  let lastDayKey = "";

  return (
    <div
      className={cn("flex-1 space-y-2 overflow-y-auto p-4", className)}
      aria-live="polite"
    >
      {messages.map((message) => {
        const dayKey = message.created_at.slice(0, 10);
        const showDay = dayKey !== lastDayKey;
        lastDayKey = dayKey;

        return (
          <div key={message.id} className="space-y-2">
            {showDay && (
              <div className="flex justify-center py-2">
                <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground shadow-sm">
                  {formatDayLabel(message.created_at)}
                </span>
              </div>
            )}
            <MessageBubble
              message={message}
              mine={message.sender_id === currentUserId}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  mine: boolean;
}

function MessageBubble({ message, mine }: MessageBubbleProps) {
  if (isSystemMessage(message)) {
    return (
      <div className="flex justify-center py-1">
        <span className="max-w-[85%] rounded-full bg-muted/70 px-3 py-1 text-center text-xs text-muted-foreground">
          {message.message}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-muted text-foreground"
        )}
      >
        {message.media_url ? (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Image
              src={message.media_url}
              width={400}
              height={400}
              unoptimized
              alt="Imagem enviada"
              className="mb-1 max-h-64 w-full rounded-lg object-cover"
            />
          </a>
        ) : null}
        {message.message ? (
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {message.message}
          </p>
        ) : null}
        <span
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            mine ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatTime(message.created_at)}
          {mine ? (
            message.read_at ? (
              <CheckCheck
                className="h-3.5 w-3.5 text-brand"
                aria-label="Lida"
              />
            ) : (
              <Check className="h-3.5 w-3.5" aria-label="Enviada" />
            )
          ) : null}
        </span>
      </div>
    </div>
  );
}
