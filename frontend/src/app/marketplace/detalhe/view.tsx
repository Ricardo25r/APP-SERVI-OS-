"use client";

/**
 * Detalhe de um lead na visão do **profissional** (`/marketplace/{id}`).
 *
 * Mostra a oportunidade como na referência: cabeçalho azul, card com categoria/
 * urgência/custo/distância, aviso de desbloqueio, descrição + fotos, grade de
 * informações (urgência, orçamento, tipo, bairro, distância), mapa aproximado e
 * CTA "Usar créditos e ver contato". Após comprar, libera o contato + chat.
 *
 * Protegida para o papel `professional`.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Coins,
  KeyRound,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  PencilLine,
  Phone,
  Ruler,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { AppHeader } from "@/components/app-shell/app-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconChip } from "@/components/ui/icon-chip";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet, apiPost } from "@/services/api";
import type { Lead, LeadContact, LeadPurchase } from "@/types";

import {
  budgetRangeLabel,
  categoryVisual,
  confirmArrival,
  describeApiError,
  leadTypeLabel,
  leadUrgencyLabel,
  releasePurchase,
  reportClientAbsent,
  scheduleVisit,
} from "@/modules/leads";
import { purchaseErrorMessage } from "@/modules/leads/marketplace/utils";

/** Data amigável: "Hoje, 09:30" / "Ontem, 14:05" / "12/06, 08:00". */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  if (sameDay) return `Hoje, ${time}`;
  if (isYest) return `Ontem, ${time}`;
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${date}, ${time}`;
}

export default function MarketplaceLeadDetailPage() {
  const auth = useRequireAuth("professional");
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? undefined;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [contact, setContact] = useState<LeadContact | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [arrivalCode, setArrivalCode] = useState("");
  const [confirmingArrival, setConfirmingArrival] = useState(false);
  const [arrivalError, setArrivalError] = useState<string | null>(null);
  const [reportingAbsent, setReportingAbsent] = useState(false);
  const [absentError, setAbsentError] = useState<string | null>(null);
  const [scheduleValue, setScheduleValue] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Lead>(`/leads/${id}`);
      setLead(data);
      if (data.contact) setContact(data.contact);
    } catch {
      setError("Não foi possível carregar esta oportunidade.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!auth.hasHydrated || auth.role !== "professional") return;
    void load();
  }, [auth.hasHydrated, auth.role, load]);

  async function handleBuy() {
    if (!lead) return;
    setBuying(true);
    setBuyError(null);
    try {
      const purchase = await apiPost<LeadPurchase>("/lead-purchases/", {
        lead_id: lead.id,
      });
      const c = purchase.contact ?? purchase.lead?.contact ?? null;
      if (c) setContact(c);
      if (purchase.contact_deadline) setDeadline(purchase.contact_deadline);
      void load();
    } catch (err) {
      setBuyError(purchaseErrorMessage(err).message);
    } finally {
      setBuying(false);
    }
  }

  async function handleConfirmArrival() {
    if (!lead?.purchase_id) return;
    setConfirmingArrival(true);
    setArrivalError(null);
    try {
      await confirmArrival(lead.purchase_id, arrivalCode.trim());
      setArrivalCode("");
      await load();
    } catch (err) {
      setArrivalError(
        describeApiError(err, "Código inválido. Confira com o cliente.")
      );
    } finally {
      setConfirmingArrival(false);
    }
  }

  function handleClientAbsent() {
    const purchaseId = lead?.purchase_id;
    if (!purchaseId) return;
    setAbsentError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setAbsentError(
        "Seu aparelho não permite localização. Abra um chamado no suporte."
      );
      return;
    }
    setReportingAbsent(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await reportClientAbsent(
            purchaseId,
            pos.coords.latitude,
            pos.coords.longitude,
            "absent"
          );
          await load();
        } catch (err) {
          setAbsentError(
            describeApiError(err, "Não foi possível comprovar a presença.")
          );
        } finally {
          setReportingAbsent(false);
        }
      },
      () => {
        setAbsentError(
          "Não foi possível obter sua localização. Permita o acesso ou abra um chamado no suporte."
        );
        setReportingAbsent(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSchedule() {
    if (!lead?.purchase_id || !scheduleValue) return;
    setScheduling(true);
    setScheduleMsg(null);
    setArrivalError(null);
    try {
      await scheduleVisit(lead.purchase_id, new Date(scheduleValue).toISOString());
      setScheduleMsg("Serviço agendado.");
    } catch (err) {
      setArrivalError(describeApiError(err, "Não foi possível agendar."));
    } finally {
      setScheduling(false);
    }
  }

  async function handleRelease() {
    if (!lead?.purchase_id) return;
    setReleasing(true);
    setArrivalError(null);
    try {
      await releasePurchase(lead.purchase_id);
      setReleaseOpen(false);
      await load();
    } catch (err) {
      setArrivalError(describeApiError(err, "Não foi possível desistir."));
    } finally {
      setReleasing(false);
    }
  }

  if (!auth.hasHydrated || auth.role !== "professional") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const visual = lead
    ? categoryVisual({ slug: lead.category?.slug, name: lead.category?.name })
    : null;
  const unlocked = Boolean(contact) || lead?.is_purchased;
  const budget = budgetRangeLabel(lead?.budget_range);
  const distance =
    lead?.distance_km != null
      ? `${lead.distance_km.toLocaleString("pt-BR")} km`
      : null;

  return (
    <>
      <AppHeader
        mode="title"
        title="Detalhes da oportunidade"
        backHref="/marketplace"
        className="lg:hidden"
      />

      <main className="mx-auto max-w-2xl px-4 py-6 pb-28 sm:px-6 sm:py-8">
        <Link
          href="/marketplace"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-4 hidden gap-1.5 px-2 lg:inline-flex"
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Link>

        {loading ? (
          <div className="h-72 animate-pulse rounded-2xl border bg-muted/40" />
        ) : error || !lead ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">
              {error ?? "Oportunidade não encontrada."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void load()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Card principal: status + categoria + título + custo + distância. */}
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
                    Novo
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(lead.created_at)}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold leading-none text-brand">
                    {lead.credits_cost}
                  </p>
                  <p className="text-xs font-medium text-brand">
                    {lead.credits_cost === 1 ? "crédito" : "créditos"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-3">
                {visual ? (
                  <IconChip icon={visual.icon} color={visual.color} size="md" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-bold leading-tight text-foreground">
                    {lead.title}
                  </h1>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {lead.neighborhood ? `${lead.neighborhood}, ` : ""}
                    {lead.city}/{lead.state}
                  </p>
                  {distance ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {distance} de você
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Reputação do cliente (não-comparecimentos) — alerta ao pro. */}
            {lead.customer_no_show_count != null &&
            lead.customer_no_show_count > 0 ? (
              <div className="flex items-start gap-2 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-foreground">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                  aria-hidden
                />
                <span>
                  Atenção: este cliente tem{" "}
                  <span className="font-semibold">
                    {lead.customer_no_show_count} não-comparecimento
                    {lead.customer_no_show_count === 1 ? "" : "s"}
                  </span>{" "}
                  registrado{lead.customer_no_show_count === 1 ? "" : "s"}.
                </span>
              </div>
            ) : null}

            {/* Aviso de desbloqueio (apenas antes de comprar). */}
            {!unlocked ? (
              <div className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
                <p className="text-sm text-foreground">
                  Para ver os dados de contato, use seus créditos. Após
                  desbloquear, você terá{" "}
                  <span className="font-semibold text-brand">1 hora</span> para
                  iniciar o contato.
                </p>
              </div>
            ) : null}

            {/* Descrição + fotos. */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold tracking-tight">
                Descrição do serviço
              </h2>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {lead.description}
              </p>
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
            </div>

            {/* Grade de informações. */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4">
              <InfoItem
                icon={CalendarClock}
                color="orange"
                label="Urgência"
                value={leadUrgencyLabel(lead.urgency)}
                emphasize
              />
              <InfoItem
                icon={Coins}
                color="green"
                label="Orçamento"
                value={budget ?? "A combinar"}
              />
              <InfoItem
                icon={PencilLine}
                color="blue"
                label="Tipo de serviço"
                value={leadTypeLabel(lead.lead_type)}
              />
              <InfoItem
                icon={Ruler}
                color="blue"
                label="Distância"
                value={distance ? `${distance} de você` : "—"}
              />
            </div>

            {/* Mapa aproximado. */}
            {lead.latitude != null && lead.longitude != null ? (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-xl border">
                  <iframe
                    title="Mapa aproximado do serviço"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      lead.longitude - 0.012
                    }%2C${lead.latitude - 0.008}%2C${
                      lead.longitude + 0.012
                    }%2C${lead.latitude + 0.008}&layer=mapnik&marker=${
                      lead.latitude
                    }%2C${lead.longitude}`}
                    loading="lazy"
                    className="h-48 w-full border-0"
                  />
                </div>
                <p className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                  <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                  {unlocked
                    ? "Endereço completo liberado nas mensagens com o cliente."
                    : "Endereço aproximado para sua segurança. O completo aparece após o desbloqueio."}
                </p>
              </div>
            ) : null}

            {/* Contato liberado (após a compra). */}
            {unlocked && contact ? (
              <div className="space-y-2 rounded-xl border border-success/30 bg-success/10 p-4">
                <p className="text-sm font-bold text-success">
                  Contato liberado
                </p>
                {deadline ? (
                  <p className="text-xs font-semibold text-brand">
                    Inicie o contato até{" "}
                    {new Date(deadline).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>
                ) : null}
                <p className="text-sm text-foreground">{contact.name}</p>
                {contact.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary"
                  >
                    <Phone className="h-4 w-4" aria-hidden />
                    {contact.phone}
                  </a>
                ) : null}
                <Link
                  href="/conversas"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "mt-1 gap-1.5"
                  )}
                >
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  Abrir conversa
                </Link>
              </div>
            ) : null}

            {/* Confirmar chegada (anti no-show): digitar o código do cliente. */}
            {unlocked && lead.arrived ? (
              <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
                Chegada confirmada. Bom trabalho!
              </div>
            ) : unlocked && lead.purchase_id ? (
              <div className="space-y-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <KeyRound className="h-4 w-4 text-brand" aria-hidden />
                  Confirmar chegada
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao chegar no cliente, peça o{" "}
                  <span className="font-semibold">código de chegada</span> e
                  digite aqui — isso confirma que você compareceu.
                </p>
                <div className="flex gap-2">
                  <input
                    inputMode="numeric"
                    maxLength={8}
                    value={arrivalCode}
                    onChange={(e) => {
                      setArrivalCode(e.target.value.replace(/\D/g, ""));
                      setArrivalError(null);
                    }}
                    placeholder="0000"
                    aria-label="Código de chegada"
                    className="w-28 rounded-lg border bg-background px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-foreground outline-none focus:border-brand"
                  />
                  <Button
                    onClick={() => void handleConfirmArrival()}
                    disabled={confirmingArrival || arrivalCode.trim().length < 4}
                    className="flex-1 gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    {confirmingArrival ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    Confirmar chegada
                  </Button>
                </div>
                {arrivalError ? (
                  <p className="text-xs text-destructive">{arrivalError}</p>
                ) : null}

                <div className="border-t border-brand/20 pt-3">
                  <button
                    type="button"
                    onClick={handleClientAbsent}
                    disabled={reportingAbsent}
                    className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-destructive hover:underline disabled:opacity-50"
                  >
                    {reportingAbsent
                      ? "Verificando sua localização..."
                      : "O cliente não estava / recusou o código"}
                  </button>
                  {absentError ? (
                    <p className="mt-1 text-xs text-destructive">{absentError}</p>
                  ) : null}
                </div>

                <div className="space-y-2 border-t border-brand/20 pt-3">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Agendar o serviço (define o prazo)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={scheduleValue}
                      onChange={(e) => setScheduleValue(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleSchedule()}
                      disabled={scheduling || !scheduleValue}
                    >
                      Agendar
                    </Button>
                  </div>
                  {scheduleMsg ? (
                    <p className="text-xs text-success">{scheduleMsg}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setReleaseOpen(true)}
                    disabled={releasing}
                    className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-destructive hover:underline disabled:opacity-50"
                  >
                    Desistir desta vaga
                  </button>
                </div>
              </div>
            ) : null}

            {buyError ? (
              <div
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {buyError}
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Barra fixa: custo + CTA (apenas antes de desbloquear). */}
      {!loading && lead && !unlocked ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 py-3 backdrop-blur lg:static lg:mx-auto lg:max-w-2xl lg:border-0 lg:bg-transparent lg:px-6 lg:pb-10">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Custo para desbloquear</p>
              <p className="text-base font-extrabold text-brand">
                {lead.credits_cost}{" "}
                <span className="text-sm font-semibold">créditos</span>
              </p>
            </div>
            <Button
              onClick={() => setConfirming(true)}
              disabled={buying || lead.affordable === false}
              className="gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {buying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Lock className="h-4 w-4" aria-hidden />
              )}
              {lead.affordable === false
                ? "Saldo insuficiente"
                : "Usar créditos e ver contato"}
            </Button>
          </div>
          {lead.affordable === false ? (
            <div className="mx-auto mt-2 flex max-w-2xl justify-end">
              <Link
                href="/credits"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
              >
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                Comprar créditos
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirming}
        title="Desbloquear contato"
        description={
          <>
            Vão ser usados{" "}
            <span className="font-semibold text-brand">
              {lead?.credits_cost}{" "}
              {lead?.credits_cost === 1 ? "crédito" : "créditos"}
            </span>{" "}
            para liberar o contato deste cliente. Você terá 1 hora para iniciar o
            contato.
          </>
        }
        confirmLabel={`Usar ${lead?.credits_cost ?? ""} créditos`}
        loading={buying}
        onConfirm={() => {
          setConfirming(false);
          void handleBuy();
        }}
        onCancel={() => setConfirming(false)}
      />
      <ConfirmDialog
        open={releaseOpen}
        title="Desistir desta vaga?"
        description={
          <>
            A vaga volta ao mercado para outros profissionais. O crédito{" "}
            <span className="font-semibold">não é devolvido</span>.
          </>
        }
        confirmLabel="Sim, desistir"
        loading={releasing}
        onConfirm={() => void handleRelease()}
        onCancel={() => setReleaseOpen(false)}
      />
    </>
  );
}

function InfoItem({
  icon: Icon,
  color,
  label,
  value,
  emphasize,
}: {
  icon: LucideIcon;
  color: "blue" | "orange" | "green";
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <IconChip icon={Icon} color={color} size="sm" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "truncate text-sm font-semibold",
            emphasize ? "text-brand" : "text-foreground"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
