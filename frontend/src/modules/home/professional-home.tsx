/**
 * `ProfessionalHome` — Home logada do profissional (dashboard).
 *
 * Saudação + resumo (saldo de créditos via `GET /credits/balance`, XP/nível via
 * `GET /gamification/me`) em `StatCard`s + cards de atalho (Oportunidades,
 * Créditos, Nível). O resumo é carregado de forma resiliente: se falhar, a Home
 * ainda mostra os atalhos (degrada para "só atalhos"). Somente camada visual.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Coins,
  Trophy,
  MessageSquare,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { IconChip } from "@/components/ui/icon-chip";
import { apiGet } from "@/services/api";
import type { CreditWallet, User } from "@/types";
import type { GamificationMe } from "@/modules/gamification/types";
import { formatXp } from "@/modules/gamification/utils";

interface Shortcut {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: "blue" | "orange" | "green";
}

const SHORTCUTS: Shortcut[] = [
  {
    href: "/marketplace",
    label: "Oportunidades",
    description: "Veja leads disponíveis na sua região",
    icon: Sparkles,
    color: "blue",
  },
  {
    href: "/credits",
    label: "Créditos",
    description: "Compre créditos e veja sua carteira",
    icon: Coins,
    color: "orange",
  },
  {
    href: "/gamificacao",
    label: "Nível",
    description: "Acompanhe seu XP e conquistas",
    icon: Trophy,
    color: "green",
  },
  {
    href: "/conversas",
    label: "Mensagens",
    description: "Converse com os contratantes",
    icon: MessageSquare,
    color: "blue",
  },
];

interface Summary {
  balance: number | null;
  gamification: GamificationMe | null;
}

export function ProfessionalHome({ user }: { user: User }) {
  const [summary, setSummary] = React.useState<Summary>({
    balance: null,
    gamification: null,
  });
  const [loading, setLoading] = React.useState(true);

  const firstName = user.name?.trim().split(/\s+/)[0] ?? "";

  React.useEffect(() => {
    let active = true;
    // Cada fonte é resolvida independentemente — uma falha não anula a outra.
    Promise.allSettled([
      apiGet<CreditWallet>("/credits/balance"),
      apiGet<GamificationMe>("/gamification/me"),
    ])
      .then(([walletRes, gamiRes]) => {
        if (!active) return;
        setSummary({
          balance:
            walletRes.status === "fulfilled"
              ? walletRes.value.balance ?? 0
              : null,
          gamification:
            gamiRes.status === "fulfilled" ? gamiRes.value : null,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const levelLabel =
    summary.gamification?.level_name ??
    (summary.gamification ? `Nível ${summary.gamification.level}` : null);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      {/* Saudação */}
      <section className="rounded-2xl bg-primary px-5 py-6 text-primary-foreground sm:px-8 sm:py-8">
        <p className="text-sm font-medium text-primary-foreground/80">
          Olá{firstName ? `, ${firstName}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Pronto para conquistar novos clientes?
        </h1>
        <p className="mt-2 max-w-lg text-sm text-primary-foreground/80">
          Explore as oportunidades disponíveis e use seus créditos para
          desbloquear contatos.
        </p>
      </section>

      {/* Resumo */}
      <section className="py-8">
        <SectionHeader title="Resumo" className="mb-4" />
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-7 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Créditos"
              value={summary.balance != null ? formatXp(summary.balance) : "--"}
              icon={Coins}
              iconColor="orange"
            />
            <StatCard
              label="XP acumulado"
              value={
                summary.gamification
                  ? formatXp(summary.gamification.xp)
                  : "--"
              }
              icon={Sparkles}
              iconColor="blue"
            />
            <StatCard
              label="Nível atual"
              value={levelLabel ?? "--"}
              icon={Trophy}
              iconColor="green"
            />
          </div>
        )}
      </section>

      {/* Atalhos */}
      <section className="pb-4">
        <SectionHeader title="Atalhos" className="mb-4" />
        <div className="grid gap-3 sm:grid-cols-2">
          {SHORTCUTS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary"
            >
              <IconChip icon={item.icon} color={item.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold tracking-tight">
                  {item.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
