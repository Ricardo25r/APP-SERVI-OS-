"use client";

/**
 * Detalhe de uma solicitação (lead) do contratante, com edição inline
 * dos campos permitidos (título, descrição, urgência, bairro) enquanto
 * a solicitação está aberta. Protegida para o papel `customer`.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  KeyRound,
  MapPin,
  MessageSquare,
  Pencil,
  Star,
} from "lucide-react";

import { AppHeader } from "@/components/app-shell/app-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import type { Lead, LeadStatus } from "@/types";

import {
  budgetRangeLabel,
  categoryVisual,
  describeApiError,
  fetchLead,
  LeadForm,
  LeadStatusBadge,
  confirmCompletion,
  leadTypeLabel,
  leadUrgencyLabel,
  markNoShow,
  updateLead,
  type LeadFormValues,
} from "@/modules/leads";

/** Mensagem de contexto conforme o status da solicitação. */
const STATUS_HINT: Record<LeadStatus, { text: string; cls: string }> = {
  open: {
    text: "Solicitação ativa — profissionais da sua região já podem ver e entrar em contato.",
    cls: "border-primary/20 bg-primary/5 text-primary",
  },
  purchased: {
    text: "Um profissional adquiriu seu contato. Fique de olho nas mensagens.",
    cls: "border-success/30 bg-success/10 text-success",
  },
  closed: {
    text: "Esta solicitação foi encerrada.",
    cls: "border-border bg-muted/50 text-muted-foreground",
  },
  cancelled: {
    text: "Esta solicitação foi cancelada.",
    cls: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export default function LeadDetailPage() {
  const auth = useRequireAuth("customer");
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? undefined;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [noShowOpen, setNoShowOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLead(id);
      setLead(data);
    } catch (err) {
      setError(
        describeApiError(err, "Não foi possível carregar a solicitação.")
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isCustomer) return;
    void load();
  }, [auth.hasHydrated, auth.isAuthenticated, auth.isCustomer, load]);

  async function handleSave(values: LeadFormValues) {
    if (!lead) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateLead(lead.id, {
        title: values.title,
        description: values.description,
        urgency: values.urgency,
        neighborhood: values.neighborhood ? values.neighborhood : null,
        budget_range: values.budget_range || null,
      });
      setLead(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(
        describeApiError(err, "Não foi possível salvar as alterações.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleNoShow() {
    if (!lead) return;
    setMarking(true);
    setMarkError(null);
    try {
      await markNoShow(lead.id);
      setNoShowOpen(false);
      await load();
    } catch (err) {
      setMarkError(
        describeApiError(err, "Não foi possível registrar o não comparecimento.")
      );
    } finally {
      setMarking(false);
    }
  }

  async function handleComplete() {
    if (!lead) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      await confirmCompletion(lead.id);
      setCompleteOpen(false);
      await load();
    } catch (err) {
      setCompleteError(
        describeApiError(err, "Não foi possível confirmar a conclusão.")
      );
    } finally {
      setCompleting(false);
    }
  }

  if (!auth.hasHydrated) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const isOpen = lead?.status === "open";
  const hint = lead ? STATUS_HINT[lead.status] : null;
  const visual = categoryVisual({
    slug: lead?.category?.slug,
    name: lead?.category?.name,
  });

  return (
    <>
      <AppHeader
        mode="title"
        title="Solicitação"
        backHref="/leads"
        className="lg:hidden"
      />

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Voltar (desktop). */}
        <Link
          href="/leads"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-4 hidden gap-1.5 px-2 lg:inline-flex"
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Link>

        {loading ? (
          <div className="h-64 animate-pulse rounded-lg border bg-muted/40" />
        ) : error ? (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void load()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : !lead ? null : editing ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Editar solicitação</CardTitle>
              <CardDescription>
                Você pode ajustar título, descrição, urgência e bairro enquanto a
                solicitação está aberta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadForm
                mode="edit"
                initialValues={{
                  title: lead.title,
                  description: lead.description,
                  urgency: lead.urgency,
                  neighborhood: lead.neighborhood ?? "",
                  budget_range: lead.budget_range ?? "",
                }}
                submitting={saving}
                error={saveError}
                submitLabel="Salvar alterações"
                onSubmit={handleSave}
                onCancel={() => {
                  setEditing(false);
                  setSaveError(null);
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="gap-3">
              <div className="flex items-start gap-3">
                <IconChip icon={visual.icon} color={visual.color} size="md" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-xl">{lead.title}</CardTitle>
                  <CardDescription className="mt-1">
                    {lead.category?.name ?? "Sem categoria"}
                  </CardDescription>
                </div>
                <LeadStatusBadge status={lead.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {hint ? (
                <div
                  className={cn(
                    "rounded-xl border px-3.5 py-2.5 text-sm",
                    hint.cls
                  )}
                >
                  {hint.text}
                </div>
              ) : null}

              {lead.status === "purchased" && lead.arrived ? (
                <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-success">
                  <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
                  <span>O profissional confirmou a chegada. Bom serviço!</span>
                </div>
              ) : lead.status === "purchased" && lead.arrival_code ? (
                <div className="space-y-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <KeyRound className="h-4 w-4 text-brand" aria-hidden />
                    Código de chegada
                  </div>
                  <p className="text-center font-mono text-4xl font-extrabold tracking-[0.3em] text-brand">
                    {lead.arrival_code}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Quando o profissional chegar, mostre este código para ele
                    confirmar a chegada no app. Só mostre quando ele estiver com
                    você.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => setNoShowOpen(true)}
                  >
                    Profissional não compareceu
                  </Button>
                  {markError ? (
                    <p className="text-xs text-destructive">{markError}</p>
                  ) : null}
                </div>
              ) : null}

              <p className="whitespace-pre-wrap text-sm">{lead.description}</p>

              <div className="grid gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden />
                  {lead.city}
                  {lead.state ? `/${lead.state}` : ""}
                  {lead.neighborhood ? ` — ${lead.neighborhood}` : ""}
                </div>
                <div className="flex items-center gap-1.5 font-medium text-brand">
                  <Coins className="h-4 w-4" aria-hidden />
                  {lead.credits_cost}{" "}
                  {lead.credits_cost === 1 ? "crédito" : "créditos"}
                </div>
                <div className="text-muted-foreground">
                  Tipo:{" "}
                  <span className="font-medium text-foreground">
                    {leadTypeLabel(lead.lead_type)}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Urgência:{" "}
                  <span className="font-medium text-foreground">
                    {leadUrgencyLabel(lead.urgency)}
                  </span>
                </div>
                {budgetRangeLabel(lead.budget_range) ? (
                  <div className="text-muted-foreground">
                    Orçamento:{" "}
                    <span className="font-medium text-foreground">
                      {budgetRangeLabel(lead.budget_range)}
                    </span>
                  </div>
                ) : null}
              </div>

              {lead.media && lead.media.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {lead.media.map((m) => (
                    <Image
                      key={m.id}
                      src={m.url}
                      alt="Foto do serviço"
                      width={160}
                      height={160}
                      unoptimized
                      className="h-28 w-28 shrink-0 rounded-xl border object-cover"
                    />
                  ))}
                </div>
              ) : null}

              {lead.latitude != null && lead.longitude != null ? (
                <div className="overflow-hidden rounded-xl border">
                  <iframe
                    title="Mapa do local do serviço"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      lead.longitude - 0.012
                    }%2C${lead.latitude - 0.008}%2C${
                      lead.longitude + 0.012
                    }%2C${lead.latitude + 0.008}&layer=mapnik&marker=${
                      lead.latitude
                    }%2C${lead.longitude}`}
                    loading="lazy"
                    className="h-44 w-full border-0"
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                {isOpen ? (
                  <Button className="gap-1.5" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Editar
                  </Button>
                ) : null}
                {lead.status === "purchased" ? (
                  <Button
                    className="gap-1.5"
                    onClick={() => setCompleteOpen(true)}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Confirmar conclusão
                  </Button>
                ) : null}
                {lead.status === "closed" ? (
                  <Link
                    href="/avaliacoes"
                    className={cn(
                      buttonVariants(),
                      "gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
                    )}
                  >
                    <Star className="h-4 w-4" aria-hidden />
                    Avaliar profissional
                  </Link>
                ) : null}
                {lead.status === "purchased" || lead.status === "closed" ? (
                  <Link
                    href="/conversas"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "gap-1.5"
                    )}
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden />
                    Ver conversas
                  </Link>
                ) : null}
              </div>
              {completeError ? (
                <p className="text-xs text-destructive">{completeError}</p>
              ) : null}
            </CardContent>
          </Card>
        )}
      </main>

      <ConfirmDialog
        open={noShowOpen}
        title="Profissional não compareceu?"
        description={
          <>
            A solicitação será <span className="font-semibold">reaberta</span>{" "}
            para outros profissionais. Use só se o profissional realmente não
            compareceu — isso afeta a reputação dele.
          </>
        }
        confirmLabel="Sim, não compareceu"
        loading={marking}
        onConfirm={() => void handleNoShow()}
        onCancel={() => setNoShowOpen(false)}
      />

      <ConfirmDialog
        open={completeOpen}
        title="Confirmar conclusão do serviço?"
        description={
          <>
            Confirme só depois que o serviço for{" "}
            <span className="font-semibold">concluído</span>. Isso encerra a
            solicitação e libera a avaliação.
          </>
        }
        confirmLabel="Sim, foi concluído"
        loading={completing}
        onConfirm={() => void handleComplete()}
        onCancel={() => setCompleteOpen(false)}
      />
    </>
  );
}
