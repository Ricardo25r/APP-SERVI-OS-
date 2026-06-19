/**
 * Tipos da feature de **Chat** (Fase 8).
 *
 * Espelham, de forma defensiva, os schemas do backend para os endpoints de
 * chat. O contrato exato dos itens de conversa pode variar — modelamos os
 * campos opcionais e os usamos sempre com fallback. Somente `id` (e, nas
 * mensagens, `id`/`sender_id`/`message`/`created_at`) é tratado como garantido.
 */

import type { Paginated } from "@/types";

/** Status possível de uma conversa (defensivo: tratado como string livre). */
export type ConversationStatus = string;

/** Contraparte (o outro participante) de uma conversa. */
export interface ChatCounterpart {
  id?: string;
  name?: string | null;
}

/** Resumo do lead associado a uma conversa. */
export interface ChatLeadSummary {
  id?: string;
  title?: string | null;
}

/**
 * Item da lista de conversas (`GET /chat/conversations`).
 * Apenas `id` é garantido; o restante é tratado defensivamente.
 */
export interface Conversation {
  id: string;
  counterpart?: ChatCounterpart | null;
  lead?: ChatLeadSummary | null;
  /** Prévia da última mensagem — pode vir como objeto ou string. */
  last_message?: ChatLastMessage | string | null;
  unread_count?: number | null;
  status?: ConversationStatus | null;
  /** Algumas respostas expõem o título do lead inline. */
  lead_title?: string | null;
  /** Nome da contraparte pode também vir inline. */
  counterpart_name?: string | null;
}

/** Prévia da última mensagem (quando vem como objeto). */
export interface ChatLastMessage {
  message?: string | null;
  created_at?: string | null;
  sender_id?: string | null;
}

/** Resposta paginada da lista de conversas. */
export type ConversationsResponse = Paginated<Conversation>;

/**
 * Uma mensagem (`GET /chat/conversations/{id}/messages`).
 * `id`, `sender_id`, `message` e `created_at` são garantidos.
 */
export interface ChatMessage {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  read_at?: string | null;
  /** Algumas mensagens podem ser de sistema (centralizadas/discretas). */
  is_system?: boolean | null;
  type?: string | null;
}

/** Resposta paginada de mensagens. */
export type MessagesResponse = Paginated<ChatMessage>;

/** Body de envio de mensagem (`POST /chat/conversations/{id}/messages`). */
export interface SendMessageInput {
  message: string;
}
