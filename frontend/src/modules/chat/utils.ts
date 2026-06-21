/**
 * Utilitários da feature de Chat: extração defensiva de nomes/títulos,
 * formatação de data/hora PT-BR e mensagens de erro amigáveis.
 */

import { ApiError } from "@/services/api";

import type {
  ChatLastMessage,
  ChatMessage,
  Conversation,
} from "./types";

/** Nome da contraparte de uma conversa (vários formatos possíveis). */
export function counterpartName(conversation: Conversation): string {
  return (
    conversation.counterpart?.name ||
    conversation.counterpart_name ||
    "Conversa"
  );
}

/** Iniciais da contraparte para o avatar (1–2 letras). */
export function counterpartInitials(conversation: Conversation): string {
  return nameInitials(counterpartName(conversation));
}

/** Extrai as iniciais (até 2 letras) de um nome. */
export function nameInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (
    parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)
  ).toUpperCase();
}

/** Título do lead associado à conversa (defensivo). */
export function conversationLeadTitle(
  conversation: Conversation
): string | null {
  return conversation.lead?.title || conversation.lead_title || null;
}

/** Texto da última mensagem (objeto ou string), para a prévia da lista. */
export function lastMessageText(conversation: Conversation): string | null {
  const last = conversation.last_message;
  if (!last) return null;
  if (typeof last === "string") return last.trim() || null;
  const obj = last as ChatLastMessage;
  if (obj.message?.trim()) return obj.message.trim();
  if (obj.media_url) return "Imagem";
  return null;
}

/** Timestamp da última mensagem (quando vier como objeto). */
export function lastMessageTime(conversation: Conversation): string | null {
  const last = conversation.last_message;
  if (!last || typeof last === "string") return null;
  return (last as ChatLastMessage).created_at ?? null;
}

/** Quantidade de mensagens não lidas (>= 0). */
export function unreadCount(conversation: Conversation): number {
  const count = conversation.unread_count;
  return typeof count === "number" && count > 0 ? count : 0;
}

/** True se a mensagem deve ser exibida como mensagem de sistema. */
export function isSystemMessage(message: ChatMessage): boolean {
  return Boolean(message.is_system) || message.type === "system";
}

/**
 * Formata um horário ISO para HH:mm (pt-BR). Usado nas bolhas e na prévia.
 */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formata o horário para a lista de conversas: hora se for hoje, senão data
 * curta (dd/mm). Estável entre servidor e cliente o suficiente para a UI.
 */
export function formatListTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** Rótulo de separador de dia para a thread (Hoje / Ontem / dd/mm/aaaa). */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOf(now) - startOf(date)) / dayMs);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Converte um erro do chat em mensagem PT-BR amigável. */
export function chatErrorMessage(
  err: unknown,
  fallback = "Não foi possível concluir a ação. Tente novamente."
): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return "Sua sessão expirou. Entre novamente.";
    }
    if (err.status === 403) {
      return "Você não tem acesso a esta conversa.";
    }
    if (err.status === 404) {
      return "Conversa não encontrada.";
    }
    if (err.status === 422) {
      return "Mensagem inválida.";
    }
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
