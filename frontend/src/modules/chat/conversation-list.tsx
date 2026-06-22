/**
 * `ConversationList` — lista de conversas do usuário logado.
 *
 * Cada item mostra: `Avatar` da contraparte, nome, título do lead, prévia da
 * última mensagem, horário e badge de não lidas (laranja). Clicar leva para a
 * thread (`/conversas/{id}`). Em layout de 2 colunas, o item selecionado é
 * destacado e o clique pode ser interceptado por `onSelect`.
 *
 * Polling leve via React Query (`refetchInterval`) para refletir novas
 * mensagens/contadores. Usa apenas tokens do design system.
 */
"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { fetchConversations } from "./api";
import type { Conversation } from "./types";
import {
  chatErrorMessage,
  conversationLeadTitle,
  counterpartName,
  formatListTime,
  lastMessageText,
  lastMessageTime,
  unreadCount,
} from "./utils";

export const conversationsKey = ["chat", "conversations"] as const;

/**
 * Total de mensagens não lidas (soma de todas as conversas). Alimenta o badge
 * do item "Mensagens" no menu inferior. Compartilha a query/cache da lista.
 */
export function useUnreadMessagesCount(enabled: boolean): number {
  const { data } = useQuery<Conversation[]>({
    queryKey: conversationsKey,
    queryFn: fetchConversations,
    enabled,
    refetchInterval: 15000,
  });
  return (data ?? []).reduce((total, c) => total + (unreadCount(c) || 0), 0);
}

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
      <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Carregando conversas...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {chatErrorMessage(error, "Não foi possível carregar as conversas.")}
      </div>
    );
  }

  const conversations = data ?? [];

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center shadow-sm">
        <Image
          src="/brand/mascote-tudo.png"
          width={160}
          height={220}
          alt=""
          aria-hidden
          className="h-28 w-auto opacity-90 drop-shadow-sm"
        />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            Você ainda não tem conversas
          </p>
          <p className="text-sm text-muted-foreground">
            As conversas aparecem aqui quando um contato é estabelecido em uma
            solicitação ou oportunidade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul
      className={cn(
        "divide-y divide-border overflow-hidden rounded-2xl border bg-card shadow-sm",
        className
      )}
    >
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
    <div className="flex items-center gap-3">
      <Avatar name={name} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold text-foreground">
            {name}
          </span>
          {time && (
            <span
              className={cn(
                "shrink-0 text-xs",
                unread > 0
                  ? "font-semibold text-brand"
                  : "text-muted-foreground"
              )}
            >
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
            <span
              aria-label={`${unread} mensagens não lidas`}
              className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-foreground"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const baseClass = cn(
    "block w-full px-4 py-3 text-left transition-colors",
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
        href={`/conversas/conversa?id=${conversation.id}`}
        aria-current={selected ? "true" : undefined}
        className={baseClass}
      >
        {content}
      </Link>
    </li>
  );
}
