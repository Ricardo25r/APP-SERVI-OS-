/**
 * `AdminTicketsTable` — lista de chamados de suporte para o admin.
 *
 * Carrega `GET /support/tickets` (admin) e permite marcar como resolvido /
 * reabrir (`PATCH /support/tickets/{id}`), além de responder por e-mail. Só
 * tokens do design system.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Inbox, Loader2, Mail, RotateCcw } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

import {
  fetchAllTickets,
  updateTicketStatus,
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

export function AdminTicketsTable() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery<SupportTicketAdminListResponse>({
    queryKey: allTicketsKey,
    queryFn: () => fetchAllTickets(1),
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "open" | "closed" }) =>
      updateTicketStatus(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: allTicketsKey }),
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
        {tickets.map((t) => {
          const isClosed = t.status === "closed";
          const pending =
            mutation.isPending && mutation.variables?.id === t.id;
          return (
            <li key={t.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{t.subject}</p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    {t.user_name ?? "—"}
                    {t.user_email ? ` · ${t.user_email}` : ""}
                  </p>
                </div>
                {isClosed ? (
                  <StatusBadge label="Resolvido" variant="success" />
                ) : (
                  <StatusBadge label="Em aberto" tone="warning" />
                )}
              </div>

              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {t.message}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(t.created_at)}
                </span>
                <div className="flex flex-wrap gap-2">
                  {t.user_email && (
                    <a
                      href={`mailto:${t.user_email}?subject=${encodeURIComponent(
                        `Re: ${t.subject}`
                      )}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      <Mail className="mr-2 h-4 w-4" aria-hidden />
                      Responder por e-mail
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant={isClosed ? "outline" : "default"}
                    disabled={pending}
                    onClick={() =>
                      mutation.mutate({
                        id: t.id,
                        status: isClosed ? "open" : "closed",
                      })
                    }
                  >
                    {pending ? (
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
