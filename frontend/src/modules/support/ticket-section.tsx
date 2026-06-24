/**
 * `SupportTicketSection` — formulário "Abrir um chamado" + lista "Meus chamados".
 *
 * Cria chamados via `POST /support/tickets` e lista os do usuário
 * (`GET /support/tickets/me`) com status. Após enviar, mostra confirmação e o
 * chamado aparece na lista. Só tokens do design system.
 */
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/services/api";

import {
  createSupportTicket,
  fetchMyTickets,
  fetchTicketThread,
  replyToTicket,
  type SupportTicket,
  type SupportTicketListResponse,
} from "./api";

const myTicketsKey = ["support", "tickets", "me"] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function TicketItem({ ticket }: { ticket: SupportTicket }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");

  const thread = useQuery({
    queryKey: ["support", "thread", ticket.id],
    queryFn: () => fetchTicketThread(ticket.id),
    enabled: open,
  });

  const replyM = useMutation({
    mutationFn: (body: string) => replyToTicket(ticket.id, body),
    onSuccess: (data) => {
      qc.setQueryData(["support", "thread", ticket.id], data);
      setReply("");
      void qc.invalidateQueries({ queryKey: myTicketsKey });
    },
  });

  const messages = thread.data?.messages ?? [];

  return (
    <li className="rounded-xl border bg-card p-3 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {ticket.subject}
        </p>
        {ticket.status === "closed" ? (
          <StatusBadge label="Resolvido" variant="success" />
        ) : (
          <StatusBadge label="Em aberto" tone="warning" />
        )}
      </button>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        {ticket.message}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDate(ticket.created_at)}
      </p>

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {thread.isLoading ? (
            <p className="text-xs text-muted-foreground">
              Carregando conversa...
            </p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem respostas ainda. Escreva abaixo para continuar.
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
                    {m.is_staff ? "Suporte FazTudo" : m.author_name ?? "Você"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {m.body}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatDate(m.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Responder ao suporte..."
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
        </div>
      )}
    </li>
  );
}

export function SupportTicketSection() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const list = useQuery<SupportTicketListResponse>({
    queryKey: myTicketsKey,
    queryFn: fetchMyTickets,
  });

  const mutation = useMutation({
    mutationFn: createSupportTicket,
    onSuccess: () => {
      setSubject("");
      setMessage("");
      setError(null);
      setSent(true);
      void queryClient.invalidateQueries({ queryKey: myTicketsKey });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar o chamado. Tente novamente."
      );
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const s = subject.trim();
    const m = message.trim();
    if (s.length < 3) {
      setError("Descreva um assunto (mínimo 3 caracteres).");
      return;
    }
    if (m.length < 10) {
      setError("Detalhe melhor sua mensagem (mínimo 10 caracteres).");
      return;
    }
    setError(null);
    mutation.mutate({ subject: s, message: m });
  }

  const tickets = list.data?.items ?? [];

  return (
    <section id="abrir-chamado" className="scroll-mt-20 space-y-3">
      <SectionHeader title="Abrir um chamado" as="h2" />

      <Card>
        <CardContent className="p-4 sm:p-5">
          {sent ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4"
            >
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-success"
                aria-hidden
              />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Chamado enviado!
                </p>
                <p className="text-sm text-muted-foreground">
                  Recebemos sua mensagem e vamos responder no e-mail cadastrado.
                  Acompanhe o status abaixo.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setSent(false)}
                >
                  Abrir outro chamado
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticket-subject">Assunto</Label>
                <Input
                  id="ticket-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex.: Não consigo comprar créditos"
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-message">Mensagem</Label>
                <Textarea
                  id="ticket-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descreva o que aconteceu, com o máximo de detalhes."
                  rows={5}
                  maxLength={4000}
                />
              </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="mr-2 h-4 w-4" aria-hidden />
                )}
                Enviar chamado
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {(list.isLoading || tickets.length > 0) && (
        <div className="space-y-3 pt-2">
          <SectionHeader title="Meus chamados" as="h2" />
          {list.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span>Carregando...</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => (
                <TicketItem key={t.id} ticket={t} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
