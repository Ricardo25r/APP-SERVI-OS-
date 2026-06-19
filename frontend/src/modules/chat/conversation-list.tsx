/**
 * `ConversationList` — lista de conversas do usuário logado.
 *
 * Cada item mostra: avatar (inicial da contraparte), nome da contraparte,
 * título do lead, prévia da última mensagem, horário e badge de não lidas.
 * Clicar leva para a thread (`/conversas/{id}`). Em layout de 2 colunas, o
 * item selecionado é destacado e o clique pode ser interceptado por `onSelect`.
 *
 * Polling leve via React Query (`refetchInterval`) para refletir novas
 * mensagens/contadores. Usa apenas tokens do design system.
 */
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessagesSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { fetchConversations } from "./api";
import type { Conversation } from "./types";
import {
  chatErrorMessage,
  conversationLeadTitle,
  counterpartInitials,
  counterpartName,
  formatListTime,
  lastMessageText,
  lastMessageTime,
  unreadCount,
} from "./utils";

export const conversationsKey = ["chat", "conversations"] as const;

interface ConversationListProps {
  className?: string;
  /** Id da conversa selecionada (layout 2 colunas). */
  selectedId?: string;
  /**
   * Quando fornecido, intercepta o clique no item (ex.: seleção em 2 colunas)
   * em vez de navegar. Se ausente, o item navega via `<Link>`.
   */
  onSelect?: (conversation: Conversation) => void;
}

export function ConversationList({
  className,
  selectedId,
  onSelect,
}: ConversationListProps) {
  const { data, isLoading, isError, error } = useQuery<Conversation[]>({
    queryKey: conversationsKey,
    queryFn: fetchConversations,
    // Polling leve: mantém a lista (contadores/prévias) atualizada.
    refetchInterval: 8000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Carregando conversas...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {chatErrorMessage(error, "Não foi possível carregar as conversas.")}
      </div>
    );
  }

  const conversations = data ?? [];

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
        <MessagesSquare
          className="h-8 w-8 text-muted-foreground/60"
          aria-hidden
        />
        <span>Você ainda não tem conversas.</span>
        <span className="text-xs text-muted-foreground/80">
          As conversas aparecem aqui quando um contato é estabelecido.
        </span>
      </div>
    );
  }

  return (
    <ul className={cn("divide-y rounded-lg border bg-card", className)}>
      {conversations.map((conversation) => (
        <ConversationListItem
          key={conversation.id}
          conversation={conversation}
          selected={conversation.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

interface ConversationListItemProps {
  conversation: Conversation;
  selected?: boolean;
  onSelect?: (conversation: Conversation) => void;
}

function ConversationListItem({
  conversation,
  selected,
  onSelect,
}: ConversationListItemProps) {
  const name = counterpartName(conversation);
  const leadTitle = conversationLeadTitle(conversation);
  const preview = lastMessageText(conversation);
  const unread = unreadCount(conversation);
  const time = formatListTime(lastMessageTime(conversation));

  const content = (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
      >
        {counterpartInitials(conversation)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-foreground">{name}</span>
          {time && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {time}
            </span>
          )}
        </div>

        {leadTitle && (
          <p className="truncate text-xs text-muted-foreground">{leadTitle}</p>
        )}

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm",
              unread > 0
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            )}
          >
            {preview ?? "Sem mensagens ainda."}
          </p>
          {unread > 0 && (
            <Badge className="shrink-0" aria-label={`${unread} não lidas`}>
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );

  const baseClass = cn(
    "block w-full px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg",
    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    selected && "bg-muted"
  );

  if (onSelect) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onSelect(conversation)}
          aria-current={selected ? "true" : undefined}
          className={baseClass}
        >
          {content}
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/conversas/${conversation.id}`}
        aria-current={selected ? "true" : undefined}
        className={baseClass}
      >
        {content}
      </Link>
    </li>
  );
}
