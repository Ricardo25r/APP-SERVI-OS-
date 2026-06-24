/**
 * Página **Central de Notificações** (`/notificacoes`) — Tela 19 do design.
 *
 * Protegida (`useRequireAuth`). Consome o **notification-engine** real
 * (`GET /notifications`, `POST /notifications/{id}/read`, `.../read-all`).
 * Mapeia o `type` do backend para ícone/cor/categoria e formata o tempo
 * relativo. Abas: Todas / Não lidas / Leads / Sistema. Apenas tokens.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  CheckCheck,
  CreditCard,
  Loader2,
  LifeBuoy,
  MessageSquare,
  Sparkles,
  Star,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/app-shell/app-header";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/ui/icon-chip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from "@/modules/notifications/api";
import { PushPreferences } from "@/modules/notifications/push-preferences";

type NotificationCategory = "lead" | "system";
type ChipColor = "blue" | "orange" | "green" | "muted";

interface NotificationItem {
  id: string;
  category: NotificationCategory;
  icon: LucideIcon;
  iconColor: ChipColor;
  title: string;
  description: string;
  time: string;
  read: boolean;
  href?: string;
}

/* Mapeia o `type` do backend para ícone/cor/categoria. */
const TYPE_VISUAL: Record<
  string,
  { icon: LucideIcon; color: ChipColor; category: NotificationCategory }
> = {
  message: { icon: MessageSquare, color: "orange", category: "lead" },
  lead: { icon: UserPlus, color: "blue", category: "lead" },
  review: { icon: Star, color: "orange", category: "lead" },
  credits: { icon: CreditCard, color: "green", category: "system" },
  support: { icon: LifeBuoy, color: "blue", category: "system" },
  system: { icon: Sparkles, color: "blue", category: "system" },
};

function visualFor(type: string) {
  return (
    TYPE_VISUAL[type] ?? {
      icon: Bell,
      color: "muted" as ChipColor,
      category: "system" as NotificationCategory,
    }
  );
}

/** Tempo relativo curto (agora / 5 min / 2 h / Ontem / dd/mm). */
function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "Ontem";
  if (days < 7) return `${days} dias`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function toItem(n: ApiNotification): NotificationItem {
  const v = visualFor(n.type);
  return {
    id: n.id,
    category: v.category,
    icon: v.icon,
    iconColor: v.color,
    title: n.title,
    description: n.body,
    time: relativeTime(n.created_at),
    read: n.read,
    href: n.href ?? undefined,
  };
}

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
    default:
      return items;
  }
}

export default function NotificacoesPage() {
  const { isAuthenticated, hasHydrated } = useRequireAuth();

  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<TabId>("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications();
      setItems(data.items.map(toItem));
    } catch {
      setError("Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    void load();
  }, [hasHydrated, isAuthenticated, load]);

  const unreadCount = React.useMemo(
    () => items.filter((n) => !n.read).length,
    [items]
  );
  const visible = React.useMemo(() => filterByTab(items, tab), [items, tab]);

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      void load(); // reverte ao estado real em caso de falha
    }
  }

  async function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await markNotificationRead(id);
    } catch {
      /* já refletido localmente; silencioso */
    }
  }

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

        <PushPreferences />

        <div
          role="tablist"
          aria-label="Filtrar notificações"
          className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1"
        >
          {TABS.map((t) => {
            const active = t.id === tab;
            const count =
              t.id === "unread" ? unreadCount : filterByTab(items, t.id).length;
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

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border bg-card py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Carregando notificações...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
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
        ) : visible.length === 0 ? (
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
      </main>
    </>
  );
}

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
              item.read
                ? "font-medium text-foreground"
                : "font-bold text-foreground"
            )}
          >
            {item.title}
          </p>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
            {item.time}
          </span>
        </div>
        {item.description ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {item.description}
          </p>
        ) : null}
      </div>

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
