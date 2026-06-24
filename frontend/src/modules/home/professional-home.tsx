/**
 * `ProfessionalHome` — Home logada do profissional (Tela 03 — dashboard/feed).
 *
 * Saudação → card "Seus créditos" (+ Comprar) → linha de stats → feed
 * "Leads disponíveis" (com filtros) reutilizando `GET /leads/` (elegíveis) e o
 * detalhe `/marketplace/{id}` para desbloquear → banner de gamificação.
 * Cada fonte é resiliente (Promise.allSettled). Só tokens do design system.
 */
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Briefcase,
  ChevronRight,
  Loader2,
  MapPin,
  MessageSquare,
  Ruler,
  Star,
  Unlock,
  type LucideIcon,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconChip } from "@/components/ui/icon-chip";
import { cn } from "@/lib/utils";
import { apiGet, apiPost } from "@/services/api";
import type {
  CreditWallet,
  Lead,
  LeadContact,
  LeadPurchase,
  Paginated,
  ProfessionalProfile,
  User,
} from "@/types";

import { CrossRoleBanner } from "@/modules/home/cross-role-banner";
import { categoryVisual } from "@/modules/leads/category-icon";
import { ContactCard } from "@/modules/leads/marketplace/contact-card";
import {
  normalizeLeadsResponse,
  purchaseErrorMessage,
  type PurchaseErrorInfo,
} from "@/modules/leads/marketplace/utils";

type Filter = "todos" | "hoje" | "novos";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "hoje", label: "Hoje" },
  { id: "novos", label: "Novos" },
];

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isRecent(iso: string, hours = 24): boolean {
  const d = new Date(iso).getTime();
  return Number.isFinite(d) && Date.now() - d <= hours * 3600_000;
}

/** "Hoje, 09:30" quando é hoje; senão "dd/mm". */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(iso)) {
    return `Hoje, ${d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function countOf(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") {
    const obj = data as { total?: number; items?: unknown[] };
    if (typeof obj.total === "number") return obj.total;
    if (Array.isArray(obj.items)) return obj.items.length;
  }
  return 0;
}

interface Summary {
  balance: number | null;
  leads: Lead[];
  contatos: number | null;
  conversas: number | null;
  rating: number | null;
}

export function ProfessionalHome({ user }: { user: User }) {
  const [summary, setSummary] = React.useState<Summary>({
    balance: null,
    leads: [],
    contatos: null,
    conversas: null,
    rating: null,
  });
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<Filter>("todos");

  const firstName = user.name?.trim().split(/\s+/)[0] ?? "";

  // Compra/desbloqueio inline (mesmo fluxo do marketplace).
  const [buyingId, setBuyingId] = React.useState<string | null>(null);
  const [contacts, setContacts] = React.useState<
    Record<string, LeadContact>
  >({});
  const [errors, setErrors] = React.useState<
    Record<string, PurchaseErrorInfo>
  >({});

  const handleBuy = React.useCallback(async (lead: Lead) => {
    setBuyingId(lead.id);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[lead.id];
      return next;
    });
    try {
      const purchase = await apiPost<LeadPurchase>("/lead-purchases/", {
        lead_id: lead.id,
      });
      const contact = purchase.contact ?? purchase.lead?.contact;
      if (contact) {
        setContacts((prev) => ({ ...prev, [lead.id]: contact }));
      }
      setSummary((s) => ({ ...s, contatos: (s.contatos ?? 0) + 1 }));
      try {
        const wallet = await apiGet<CreditWallet>("/credits/balance");
        setSummary((s) => ({ ...s, balance: wallet.balance ?? s.balance }));
      } catch {
        /* saldo é informativo */
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [lead.id]: purchaseErrorMessage(err) }));
    } finally {
      setBuyingId(null);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiGet<CreditWallet>("/credits/balance"),
      apiGet<Lead[] | Paginated<Lead>>("/leads/"),
      apiGet<unknown>("/lead-purchases/"),
      apiGet<unknown>("/chat/conversations"),
      apiGet<ProfessionalProfile>("/users/me/professional-profile"),
    ])
      .then(([bal, leads, purch, conv, prof]) => {
        if (!active) return;
        setSummary({
          balance: bal.status === "fulfilled" ? bal.value.balance ?? 0 : null,
          leads:
            leads.status === "fulfilled"
              ? normalizeLeadsResponse(leads.value)
              : [],
          contatos: purch.status === "fulfilled" ? countOf(purch.value) : null,
          conversas: conv.status === "fulfilled" ? countOf(conv.value) : null,
          rating:
            prof.status === "fulfilled" ? prof.value.rating ?? 0 : null,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const leadsToday = React.useMemo(
    () => summary.leads.filter((l) => isToday(l.created_at)).length,
    [summary.leads]
  );

  const visibleLeads = React.useMemo(() => {
    const list =
      filter === "hoje"
        ? summary.leads.filter((l) => isToday(l.created_at))
        : filter === "novos"
          ? summary.leads.filter((l) => isRecent(l.created_at))
          : summary.leads;
    return list.slice(0, 6);
  }, [summary.leads, filter]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-6 sm:px-6">
      {/* Saudação */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Olá, {firstName || "profissional"}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aqui estão as oportunidades para você.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Chip de saldo — comprar créditos fica no FAB / aba Créditos */}
          <Link
            href="/credits"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-bold tabular-nums text-primary transition-colors hover:bg-primary/10"
          >
            <Image
              src="/brand/moedas.png"
              alt=""
              width={18}
              height={18}
              aria-hidden
              className="h-4 w-4 object-contain"
            />
            {loading ? "—" : summary.balance ?? 0}
            <span className="font-medium text-muted-foreground">créditos</span>
          </Link>
          <Link
            href="/profile"
            className="hidden items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent sm:inline-flex"
          >
            Ver meu perfil
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </header>

      {/* Banner de nível (promo) — topo da home */}
      <Link
        href="/gamificacao"
        className="relative block min-h-[152px] overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#0A357D] p-5 pr-32 text-primary-foreground shadow-sm transition-opacity hover:opacity-95 sm:min-h-[176px] sm:pr-52"
      >
        <p className="text-base font-bold tracking-tight sm:text-lg">
          Suba de nível e ganhe mais visibilidade
        </p>
        <p className="mt-0.5 max-w-[18rem] text-sm text-primary-foreground/80">
          Compre leads e receba boas avaliações para evoluir.
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand">
          Ver progresso
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
        <div className="pointer-events-none absolute bottom-0 right-1 flex select-none items-end sm:right-2">
          <Image
            src="/brand/mascote-tudo.png"
            width={255}
            height={640}
            alt=""
            aria-hidden
            priority
            className="h-36 w-auto object-contain object-bottom drop-shadow-xl sm:h-44"
          />
          <Image
            src="/brand/mascote-profissional.webp"
            width={249}
            height={640}
            alt=""
            aria-hidden
            priority
            className="-ml-3 h-36 w-auto object-contain object-bottom drop-shadow-xl sm:h-44"
          />
        </div>
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={Briefcase}
          color="blue"
          value={loading ? "—" : String(leadsToday)}
          label="Novas hoje"
        />
        <StatTile
          icon={Unlock}
          color="orange"
          value={loading || summary.contatos == null ? "—" : String(summary.contatos)}
          label="Contatos"
        />
        <StatTile
          icon={MessageSquare}
          color="green"
          value={loading || summary.conversas == null ? "—" : String(summary.conversas)}
          label="Conversas"
        />
        <StatTile
          icon={Star}
          color="orange"
          value={
            loading || summary.rating == null
              ? "—"
              : summary.rating.toLocaleString("pt-BR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })
          }
          label="Avaliação"
        />
      </div>

      <CrossRoleBanner />

      {/* Leads disponíveis */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold tracking-tight sm:text-lg">
            Oportunidades disponíveis
          </h2>
          <Link
            href="/marketplace"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Ver todos
          </Link>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-accent"
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/50" />
            ))}
          </div>
        ) : visibleLeads.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma oportunidade {filter !== "todos" ? "neste filtro" : "no momento"}.{" "}
            <Link href="/profile" className="font-semibold text-primary hover:underline">
              Confira seu perfil
            </Link>{" "}
            para receber mais leads.
          </div>
        ) : (
          <ul className="space-y-2">
            {visibleLeads.map((lead) => (
              <li key={lead.id}>
                <LeadRow
                  lead={lead}
                  balance={summary.balance}
                  buying={buyingId === lead.id}
                  contact={contacts[lead.id]}
                  error={errors[lead.id] ?? null}
                  onBuy={handleBuy}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Subcomponentes                                                     */
/* ------------------------------------------------------------------ */

function StatTile({
  icon,
  color,
  value,
  label,
}: {
  icon: LucideIcon;
  color: "blue" | "orange" | "green";
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card p-2.5 shadow-sm">
      <IconChip icon={icon} color={color} size="sm" aria-hidden />
      <div className="min-w-0">
        <p className="text-base font-bold tabular-nums leading-none">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function LeadRow({
  lead,
  balance,
  buying,
  contact,
  error,
  onBuy,
}: {
  lead: Lead;
  balance: number | null;
  buying: boolean;
  contact?: LeadContact;
  error?: PurchaseErrorInfo | null;
  onBuy: (lead: Lead) => void;
}) {
  const visual = categoryVisual({
    slug: lead.category?.slug,
    name: lead.category?.name,
  });
  const location = [lead.neighborhood, lead.city, lead.state]
    .filter(Boolean)
    .join(", ");
  const isNew = isRecent(lead.created_at);
  const canAfford =
    lead.affordable ?? (balance === null ? true : balance >= lead.credits_cost);
  const purchased = Boolean(contact);
  const [confirming, setConfirming] = React.useState(false);
  const creditsLabel = `${lead.credits_cost} ${lead.credits_cost === 1 ? "crédito" : "créditos"}`;

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <IconChip icon={visual.icon} color={visual.color} size="md" aria-hidden />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px]">
            {isNew && (
              <span className="font-bold uppercase tracking-wide text-brand">
                Novo
              </span>
            )}
            <span className="text-muted-foreground">
              {whenLabel(lead.created_at)}
            </span>
          </div>
          <Link
            href={`/marketplace/detalhe?id=${lead.id}`}
            className="mt-0.5 block truncate text-sm font-bold text-foreground hover:text-primary"
          >
            {lead.title}
          </Link>
          {location && (
            <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{location}</span>
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums text-brand">
            {lead.credits_cost}
            <span className="ml-1 text-[11px] font-medium text-muted-foreground">
              créditos
            </span>
          </p>
          {lead.distance_km != null && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Ruler className="h-3 w-3" aria-hidden />
              {lead.distance_km.toLocaleString("pt-BR")} km
            </p>
          )}
          {!purchased && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={buying || !canAfford}
              title={!canAfford ? "Saldo insuficiente" : undefined}
              className="mt-2.5 inline-flex w-[7.5rem] items-center justify-center rounded-lg bg-brand px-3 py-2 text-center text-xs font-bold leading-tight text-brand-foreground transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "Desbloquear contato"
              )}
            </button>
          )}
        </div>
      </div>

      {error && !purchased && (
        <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          <p>{error.message}</p>
          {error.offerCredits && (
            <Link
              href="/credits"
              className="mt-0.5 inline-block font-semibold underline underline-offset-4"
            >
              Adicionar créditos
            </Link>
          )}
        </div>
      )}

      {contact && (
        <div className="mt-2 space-y-2">
          <ContactCard contact={contact} />
          <Link
            href="/conversas"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Abrir conversa
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Desbloquear contato"
        description={
          <>
            Vão ser usados{" "}
            <span className="font-semibold text-brand">{creditsLabel}</span> para
            liberar o contato deste cliente. Você terá 1 hora para iniciar o
            contato.
          </>
        }
        confirmLabel={`Usar ${creditsLabel}`}
        loading={buying}
        onConfirm={() => {
          setConfirming(false);
          onBuy(lead);
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
