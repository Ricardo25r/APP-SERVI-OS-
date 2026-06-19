/**
 * Página **Central de Notificações** (`/notificacoes`) — Tela 19 do design.
 *
 * Protegida (`useRequireAuth`): exige sessão. O sino do `AppHeader` já aponta
 * para esta rota.
 *
 * ⚠️ PLACEHOLDER — o backend ainda NÃO tem endpoint de notificações
 * (o `notification-engine` é uma fase futura; ver `docs/AUDITORIA-FINAL.md` e
 * `contrato-fases-2-5.md` §7). Por isso a lista usa **dados mock locais**
 * representativos (novo lead, mensagem, créditos, avaliação, sistema, etc.).
 *
 * Estrutura pronta para plugar `GET /notifications` no futuro: basta trocar o
 * array `MOCK_NOTIFICATIONS` por um fetch (`apiGet<NotificationItem[]>(...)`)
 * mantendo o shape de `NotificationItem`. As abas/filtros e a renderização já
 * operam sobre esse tipo.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  CheckCheck,
  CreditCard,
  MessageSquare,
  Sparkles,
  Star,
  Timer,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/app-shell/app-header";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/ui/icon-chip";
import { EmptyState } from "@/components/ui/empty-state";

/* ------------------------------------------------------------------ */
/* Tipos (espelham o futuro shape de `GET /notifications`)            */
/* ------------------------------------------------------------------ */

type NotificationCategory = "lead" | "system";

/** Cor tonal do `IconChip` (mapeada para tokens no primitivo). */
type ChipColor = "blue" | "orange" | "green" | "muted";

interface NotificationItem {
  id: string;
  /** Categoria usada nas abas (Leads × Sistema). */
  category: NotificationCategory;
  icon: LucideIcon;
  iconColor: ChipColor;
  title: string;
  description: string;
  /** Rótulo de tempo já formatado (ex.: "agora", "5 min", "Ontem"). */
  time: string;
  read: boolean;
  /** Destino opcional ao clicar (rota interna existente). */
  href?: string;
}

/* ------------------------------------------------------------------ */
/* Dados mock (placeholder até o notification-engine)                 */
/* ------------------------------------------------------------------ */

// TODO(notification-engine): substituir por `apiGet<NotificationItem[]>("/notifications")`
// e mapear a resposta para `NotificationItem` (category/icon/iconColor derivados
// do `type` retornado pelo backend). Mantém-se este array como fallback de dev.
const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    category: "lead",
    icon: UserPlus,
    iconColor: "blue",
    title: "Novo lead disponível",
    description:
      "Instalação de chuveiro elétrico em Ariquemes/RO — abra para ver os detalhes.",
    time: "agora",
    read: false,
    href: "/marketplace",
  },
  {
    id: "n2",
    category: "lead",
    icon: MessageSquare,
    iconColor: "orange",
    title: "Nova mensagem",
    description: "Maria enviou uma mensagem sobre a solicitação de pintura.",
    time: "12 min",
    read: false,
    href: "/conversas",
  },
  {
    id: "n3",
    category: "lead",
    icon: Timer,
    iconColor: "orange",
    title: "Lead expirando em breve",
    description:
      'A oportunidade "Conserto de vazamento" expira em 2 horas. Garanta a sua.',
    time: "1 h",
    read: false,
    href: "/marketplace",
  },
  {
    id: "n4",
    category: "system",
    icon: CreditCard,
    iconColor: "green",
    title: "Créditos adicionados",
    description: "Você recebeu 50 créditos na sua carteira. Bom trabalho!",
    time: "3 h",
    read: true,
    href: "/credits",
  },
  {
    id: "n5",
    category: "lead",
    icon: Star,
    iconColor: "orange",
    title: "Avaliação recebida",
    description: "João avaliou seu serviço com 5 estrelas. Veja o comentário.",
    time: "Ontem",
    read: true,
    href: "/avaliacoes",
  },
  {
    id: "n6",
    category: "system",
    icon: CheckCheck,
    iconColor: "green",
    title: "Serviço concluído",
    description:
      'A solicitação "Montagem de móveis" foi marcada como concluída.',
    time: "Ontem",
    read: true,
    href: "/leads",
  },
  {
    id: "n7",
    category: "system",
    icon: Sparkles,
    iconColor: "blue",
    title: "Promoção especial",
    description: "Pacote de créditos com 15% de desconto até o fim da semana.",
    time: "2 dias",
    read: true,
    href: "/credits",
  },
];

/* ------------------------------------------------------------------ */
/* Abas / filtros                                                     */
/* ------------------------------------------------------------------ */

type TabId = "all" | "unread" | "lead" | "system";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "unread", label: "Não lidas" },
  { id: "lead", label: "Leads" },
  { id: "system", label: "Sistema" },
];

function filterByTab(items: NotificationItem[], tab: TabId): NotificationItem[] {
  switch (tab) {
    case "unread":
      return items.filter((n) => !n.read);
    case "lead":
      return items.filter((n) => n.category === "lead");
    case "system":
      return items.filter((n) => n.category === "system");
    case "all":
    default:
      return items;
  }
}

/* ------------------------------------------------------------------ */
/* Página                                                             */
/* ------------------------------------------------------------------ */

export default function NotificacoesPage() {
  const { isAuthenticated, hasHydrated } = useRequireAuth();

  // Estado local: lista (mock) + aba ativa. Quando o notification-engine
  // existir, `items` virá de um fetch e `markAllRead`/clique chamarão a API.
  const [items, setItems] = React.useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [tab, setTab] = React.useState<TabId>("all");

  const unreadCount = React.useMemo(
    () => items.filter((n) => !n.read).length,
    [items]
  );
  const visible = React.useMemo(() => filterByTab(items, tab), [items, tab]);

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  // Evita render de conteúdo protegido antes da sessão ser restaurada.
  if (!hasHydrated || !isAuthenticated) {
    return (
      <>
        <AppHeader mode="title" title="Notificações" backHref="/" />
        <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader mode="title" title="Notificações" backHref="/" />

      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Cabeçalho da seção + ação "marcar todas como lidas" */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Central de Notificações
            </h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `Você tem ${unreadCount} não ${
                    unreadCount === 1 ? "lida" : "lidas"
                  }.`
                : "Tudo em dia por aqui."}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="shrink-0 text-primary hover:text-primary"
          >
            <CheckCheck className="mr-1.5 h-4 w-4" aria-hidden />
            Marcar lidas
          </Button>
        </div>

        {/* Abas (segmented) — Todas / Não lidas / Leads / Sistema */}
        <div
          role="tablist"
          aria-label="Filtrar notificações"
          className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1"
        >
          {TABS.map((t) => {
            const active = t.id === tab;
            const count =
              t.id === "unread"
                ? unreadCount
                : filterByTab(items, t.id).length;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                {count > 0 ? (
                  <span
                    className={cn(
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-foreground/10 text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Lista */}
        {visible.length === 0 ? (
          <EmptyState
            icon={tab === "unread" ? CheckCheck : BellOff}
            title={
              tab === "unread"
                ? "Nenhuma notificação não lida"
                : "Nenhuma notificação por aqui"
            }
            description={
              tab === "unread"
                ? "Você está em dia. Novas notificações aparecerão aqui."
                : "Quando houver novidades sobre seus leads e conta, elas aparecem aqui."
            }
          />
        ) : (
          <ul className="space-y-2">
            {visible.map((n) => (
              <li key={n.id}>
                <NotificationRow item={n} onRead={() => markRead(n.id)} />
              </li>
            ))}
          </ul>
        )}

        {/* Aviso de placeholder (some quando o engine real estiver plugado) */}
        <p className="mt-6 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Prévia de notificações. O envio em tempo real chega com o módulo de
            notificações.
          </span>
        </p>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Item da lista                                                      */
/* ------------------------------------------------------------------ */

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationItem;
  onRead: () => void;
}) {
  const content = (
    <>
      <IconChip icon={item.icon} color={item.iconColor} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm",
              item.read ? "font-medium text-foreground" : "font-bold text-foreground"
            )}
          >
            {item.title}
          </p>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
            {item.time}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
          {item.description}
        </p>
      </div>

      {/* Indicador de não lida */}
      {!item.read ? (
        <span
          aria-label="Não lida"
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand"
        />
      ) : null}
    </>
  );

  const className = cn(
    "flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    !item.read && "border-brand/30 bg-brand/[0.03]"
  );

  // Se há destino, vira link (e marca como lida ao clicar); senão, botão que
  // apenas marca como lida.
  if (item.href) {
    return (
      <Link href={item.href} onClick={onRead} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onRead} className={className}>
      {content}
    </button>
  );
}
