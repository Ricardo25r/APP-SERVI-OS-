/**
 * Página de **thread** de uma conversa (`/conversas/{id}`).
 *
 * Protegida (qualquer usuário logado). Mostra:
 * - `AppHeader` azul (mode="title") no mobile, com Avatar + nome da contraparte;
 * - cabeçalho de cartão equivalente no desktop;
 * - `MessageThread` (com polling) ocupando a área central;
 * - `MessageInput` fixo no rodapé do cartão (botão laranja).
 *
 * O cabeçalho usa `GET /chat/conversations/{id}`; se falhar, ainda assim a
 * thread tenta carregar (degrada graciosamente).
 */
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { AppHeader } from "@/components/app-shell/app-header";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import {
  MessageInput,
  MessageThread,
  conversationLeadTitle,
  counterpartName,
  fetchConversation,
} from "@/modules/chat";
import type { Conversation } from "@/modules/chat";

export default function ConversaThreadPage() {
  const { user, isAuthenticated, hasHydrated } = useRequireAuth();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? undefined;

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
  const leadTitle = conversation ? conversationLeadTitle(conversation) : null;
  const leadId = conversation?.lead?.id;
  // Link para o detalhe do serviço conforme o papel de quem vê.
  const leadHref =
    leadId && user.role === "professional"
      ? `/marketplace/detalhe?id=${leadId}`
      : leadId && user.role === "customer"
        ? `/leads/detalhe?id=${leadId}`
        : null;

  return (
    <>
      {/* Mobile: header azul do app com Avatar + nome da contraparte. */}
      <div className="lg:hidden">
        <AppHeader
          mode="title"
          backHref="/conversas"
          title={
            <span className="flex min-w-0 items-center justify-center gap-2">
              <Avatar
                name={name}
                size="sm"
                className="bg-primary-foreground/15 text-primary-foreground"
              />
              <span className="truncate">{name}</span>
            </span>
          }
        />
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        {/* Desktop: link de voltar acima do cartão. */}
        <Link
          href="/conversas"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-4 hidden w-fit gap-1.5 px-2 lg:inline-flex"
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Link>

        <div className="flex h-[calc(100vh-13rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
          {/* Cabeçalho do cartão (desktop); no mobile o AppHeader já cobre. */}
          <header className="hidden items-center gap-3 border-b px-4 py-3 lg:flex">
            <Avatar name={name} size="md" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{name}</p>
              {leadTitle ? (
                leadHref ? (
                  <Link
                    href={leadHref}
                    className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary"
                  >
                    {leadTitle}
                    <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                  </Link>
                ) : (
                  <p className="truncate text-xs text-muted-foreground">
                    {leadTitle}
                  </p>
                )
              ) : null}
            </div>
          </header>

          {/* No mobile, mostra o serviço (lead) logo abaixo do AppHeader. */}
          {leadTitle ? (
            leadHref ? (
              <Link
                href={leadHref}
                className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2 lg:hidden"
              >
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Solicitação:</span>{" "}
                  {leadTitle}
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            ) : (
              <div className="border-b bg-muted/30 px-4 py-2 lg:hidden">
                <p className="truncate text-xs text-muted-foreground">
                  {leadTitle}
                </p>
              </div>
            )
          ) : null}

          <MessageThread conversationId={id} currentUserId={user.id} />
          <MessageInput conversationId={id} currentUserId={user.id} />
        </div>
      </main>
    </>
  );
}
