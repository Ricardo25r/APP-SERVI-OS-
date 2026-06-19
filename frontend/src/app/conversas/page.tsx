/**
 * Página **Conversas** (`/conversas`).
 *
 * Protegida (customer + professional; admin é redirecionado pelo padrão de
 * auth ao não ter o link, mas a página em si exige apenas autenticação).
 *
 * Em telas largas: 2 colunas (lista + thread da conversa selecionada).
 * Em mobile: só a lista; clicar em uma conversa navega para `/conversas/{id}`.
 *
 * Estados de hidratação/auth tratados (evita render de conteúdo protegido
 * antes da sessão ser restaurada).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { useRequireAuth } from "@/hooks/use-auth";
import {
  ConversationList,
  MessageInput,
  MessageThread,
  conversationLeadTitle,
  counterpartName,
} from "@/modules/chat";
import type { Conversation } from "@/modules/chat";

export default function ConversasPage() {
  const { user, isAuthenticated, hasHydrated } = useRequireAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<Conversation | null>(null);

  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  // Em telas largas, selecionar abre a thread inline; em mobile (sem o painel
  // visível), a coluna direita fica oculta e o usuário pode clicar no item
  // (que tem o seu próprio <Link>) — aqui usamos onSelect só no painel largo.
  function handleSelect(conversation: Conversation) {
    setSelected(conversation);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Conversas</h1>
        <p className="text-muted-foreground">
          Converse com os contatos das suas solicitações e oportunidades.
        </p>
      </header>

      {/* Mobile: somente a lista (cada item navega via Link). */}
      <div className="lg:hidden">
        <ConversationList />
      </div>

      {/* Largo: 2 colunas (lista + thread selecionada). */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="min-w-0">
          <ConversationList
            selectedId={selected?.id}
            onSelect={handleSelect}
          />
        </div>

        <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
          {selected ? (
            <SelectedConversation
              conversation={selected}
              currentUserId={user.id}
              onOpenFull={() => router.push(`/conversas/${selected.id}`)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center text-sm text-muted-foreground">
              <span>Selecione uma conversa para começar.</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

interface SelectedConversationProps {
  conversation: Conversation;
  currentUserId: string;
  onOpenFull: () => void;
}

function SelectedConversation({
  conversation,
  currentUserId,
  onOpenFull,
}: SelectedConversationProps) {
  const name = counterpartName(conversation);
  const leadTitle = conversationLeadTitle(conversation);

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} size="md" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{name}</p>
            {leadTitle && (
              <p className="truncate text-xs text-muted-foreground">
                {leadTitle}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenFull}
          className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Abrir
        </button>
      </header>

      <MessageThread
        conversationId={conversation.id}
        currentUserId={currentUserId}
      />
      <MessageInput
        conversationId={conversation.id}
        currentUserId={currentUserId}
      />
    </>
  );
}
