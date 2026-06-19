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
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2, MessageSquare } from "lucide-react";

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
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
          "flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground",
          className
        )}
      >
        <MessageSquare
          className="h-8 w-8 text-muted-foreground/60"
          aria-hidden
        />
        <span>Nenhuma mensagem ainda.</span>
        <span className="text-xs text-muted-foreground/80">
          Envie a primeira mensagem abaixo.
        </span>
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
              <div className="flex justify-center py-1">
                <span className="rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground">
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
        <span className="max-w-[80%] text-center text-xs text-muted-foreground">
          {message.message}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          mine
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.message}</p>
        <span
          className={cn(
            "mt-1 block text-right text-[10px]",
            mine
              ? "text-primary-foreground/70"
              : "text-muted-foreground"
          )}
        >
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}
