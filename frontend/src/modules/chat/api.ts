/**
 * Camada de acesso à API para **Chat** (Fase 8).
 *
 * Encapsula as chamadas a `/chat/*` e normaliza respostas que podem vir
 * paginadas (`{items,...}`) ou como lista crua — ambas tratadas
 * defensivamente.
 *
 * Endpoints (Bearer injetado automaticamente por `@/services/api`):
 * - `GET  /chat/conversations`                  → lista de conversas.
 * - `GET  /chat/conversations/{id}`             → detalhe de uma conversa.
 * - `GET  /chat/conversations/{id}/messages`    → mensagens (paginado; ao
 *                                                  buscar, o backend marca as
 *                                                  recebidas como lidas).
 * - `POST /chat/conversations/{id}/messages`    → envia mensagem ({message}).
 */

import { apiGet, apiPost } from "@/services/api";

import type {
  ChatMessage,
  Conversation,
  SendMessageInput,
} from "./types";

/**
 * Extrai a lista de itens de uma resposta que pode ser:
 * - um array cru `T[]`;
 * - um envelope paginado `{ items: T[], ... }`.
 * Qualquer outro formato resulta em lista vazia (defensivo).
 */
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray((data as { items: unknown }).items)
  ) {
    return (data as { items: T[] }).items;
  }
  return [];
}

/** Lista as conversas do usuário logado. */
export async function fetchConversations(): Promise<Conversation[]> {
  const data = await apiGet<unknown>("/chat/conversations");
  return unwrapList<Conversation>(data);
}

/** Detalhe de uma conversa (cabeçalho: contraparte + lead). */
export function fetchConversation(id: string): Promise<Conversation> {
  return apiGet<Conversation>(`/chat/conversations/${id}`);
}

/**
 * Mensagens de uma conversa. Ao buscar, o backend marca as recebidas como
 * lidas. Retorna em ordem cronológica (mais antiga primeiro).
 */
export async function fetchMessages(
  conversationId: string
): Promise<ChatMessage[]> {
  const data = await apiGet<unknown>(
    `/chat/conversations/${conversationId}/messages`
  );
  return unwrapList<ChatMessage>(data);
}

/** Envia uma mensagem na conversa. Pode lançar `ApiError` (403/404/422). */
export function sendMessage(
  conversationId: string,
  message: string
): Promise<ChatMessage> {
  const body: SendMessageInput = { message };
  return apiPost<ChatMessage>(
    `/chat/conversations/${conversationId}/messages`,
    body
  );
}
