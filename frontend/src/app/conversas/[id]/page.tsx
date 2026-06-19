/**
 * Página de **thread** de uma conversa (`/conversas/{id}`).
 *
 * Protegida (qualquer usuário logado). Mostra:
 * - cabeçalho com nome da contraparte + título do lead + botão voltar;
 * - `MessageThread` (com polling) ocupando a área central;
 * - `MessageInput` fixo no rodapé do cartão.
 *
 * O cabeçalho usa `GET /chat/conversations/{id}`; se falhar, ainda assim a
 * thread tenta carregar (degrada graciosamente).
 */
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import {
  MessageInput,
  MessageThread,
  conversationLeadTitle,
  counterpartInitials,
  counterpartName,
  fetchConversation,
} from "@/modules/chat";
import type { Conversation } from "@/modules/chat";

export default function ConversaThreadPage() {
  const { user, isAuthenticated, hasHydrated } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const { data: conversation } = useQuery<Conversation>({
    queryKey: ["chat", "conversation", id],
    queryFn: () => fetchConversation(id as string),
    enabled: Boolean(id) && hasHydrated && isAuthenticated,
  });

  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  if (!id) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">Conversa inválida.</p>
      </main>
    );
  }

  const name = conversation ? counterpartName(conversation) : "Conversa";
  const leadTitle = conversation
    ? conversationLeadTitle(conversation)
    : null;
  const initials = conversation ? counterpartInitials(conversation) : "?";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/conversas"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-4 w-fit gap-1.5 px-2"
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar
      </Link>

      <div className="flex h-[calc(100vh-13rem)] min-h-[420px] flex-col overflow-hidden rounded-lg border bg-card">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{name}</p>
            {leadTitle && (
              <p className="truncate text-xs text-muted-foreground">
                {leadTitle}
              </p>
            )}
          </div>
        </header>

        <MessageThread conversationId={id} currentUserId={user.id} />
        <MessageInput conversationId={id} currentUserId={user.id} />
      </div>
    </main>
  );
}
