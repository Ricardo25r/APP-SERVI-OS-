/**
 * `AdminTicketsTable` — lista de chamados de suporte para o admin.
 *
 * Carrega `GET /support/tickets` (admin) e permite marcar como resolvido /
 * reabrir (`PATCH /support/tickets/{id}`), além de responder por e-mail. Só
 * tokens do design system.
 */
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  RotateCcw,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";

import {
  fetchAllTickets,
  fetchTicketThread,
  replyToTicket,
  updateTicketStatus,
  type SupportTicketAdmin,
  type SupportTicketAdminListResponse,
} from "./api";

const allTicketsKey = ["support", "tickets", "all"] as const;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminTicketRow({ ticket }: { ticket: SupportTicketAdmin }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const isClosed = ticket.status === "closed";

  const statusM = useMutation({
    mutationFn: (status: "open" | "closed") =>
      updateTicketStatus(ticket.id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: allTicketsKey }),
  });

  const thread = useQuery({
    queryKey: ["support", "thread", ticket.id],
    queryFn: () => fetchTicketThread(ticket.id),
    enabled: open,
  });

  const replyM = useMutation({
    mutationFn: (body: string) => replyToTicket(ticket.id, body),
    onSuccess: (data) => {
      queryClient.setQueryData(["support", "thread", ticket.id], data);
      setReply("");
    },
  });

  const messages = thread.data?.messages ?? [];

  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{ticket.subject}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            {ticket.user_name ?? "—"}
            {ticket.user_email ? ` · ${ticket.user_email}` : ""}
          </p>
        </div>
        {isClosed ? (
          <StatusBadge label="Resolvido" variant="success" />
        ) : (
          <StatusBadge label="Em aberto" tone="warning" />
        )}
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
        {ticket.message}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {formatDateTime(ticket.created_at)}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen((v) => !v)}
          >
            <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
            {open ? "Fechar conversa" : "Responder no app"}
          </Button>
          <Button
            size="sm"
            variant={isClosed ? "outline" : "default"}
            disabled={statusM.isPending}
            onClick={() => statusM.mutate(isClosed ? "open" : "closed")}
          >
            {statusM.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : isClosed ? (
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
            )}
            {isClosed ? "Reabrir" : "Marcar resolvido"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {thread.isLoading ? (
            <p className="text-xs text-muted-foreground">
              Carregando conversa...
            </p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem respostas ainda. Escreva abaixo para responder o usuário.
            </p>
          ) : (
            <ul className="space-y-2">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.is_staff
                      ? "rounded-lg bg-primary/5 p-2"
                      : "rounded-lg bg-muted/40 p-2"
                  }
                >
                  <p className="text-xs font-semibold text-foreground">
                    {m.is_staff ? "Suporte" : m.author_name ?? "Usuário"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {m.body}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatDateTime(m.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Responder ao usuário..."
              maxLength={4000}
            />
            <Button
              type="button"
              size="sm"
              disabled={replyM.isPending || !reply.trim()}
              onClick={() => replyM.mutate(reply.trim())}
            >
              Enviar
            </Button>
          </div>
          {ticket.user_email && (
            <a
              href={`mailto:${ticket.user_email}?subject=${encodeURIComponent(
                `Re: ${ticket.subject}`
              )}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <Mail className="mr-2 h-4 w-4" aria-hidden />
              Responder por e-mail
            </a>
          )}
        </div>
      )}
    </li>
  );
}

export function AdminTicketsTable() {
  const { data, isLoading, isError } = useQuery<SupportTicketAdminListResponse>({
    queryKey: allTicketsKey,
    queryFn: () => fetchAllTickets(1),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Carregando chamados...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        Não foi possível carregar os chamados.
      </div>
    );
  }

  const tickets = data?.items ?? [];

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nenhum chamado por aqui"
        description="Quando um usuário abrir um chamado de suporte, ele aparece aqui."
      />
    );
  }

  const openCount = tickets.filter((t) => t.status !== "closed").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {tickets.length} chamado(s) · <strong>{openCount}</strong> em aberto
      </p>

      <ul className="space-y-3">
        {tickets.map((t) => (
          <AdminTicketRow key={t.id} ticket={t} />
        ))}
      </ul>
    </div>
  );
}
