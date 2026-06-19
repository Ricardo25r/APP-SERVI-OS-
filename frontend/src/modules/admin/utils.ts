/**
 * Utilitários da feature **Admin**: formatação (datas, moeda), rótulos PT-BR
 * de enums e leitura defensiva de métricas.
 */

import { ApiError } from "@/services/api";
import type {
  CategoryTier,
  LeadStatus,
  LeadType,
  LeadUrgency,
  UserRole,
  UserStatus,
} from "@/types";

import type { PaymentOrderStatus } from "./types";

/** Converte um erro arbitrário em mensagem PT-BR amigável (reaproveita ApiError). */
export function adminErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Sessão expirada. Faça login novamente.";
    if (err.status === 403) {
      return err.message || "Você não tem permissão para esta ação.";
    }
    if (err.status === 404) return err.message || "Registro não encontrado.";
    if (err.status === 422) {
      return err.message || "Dados inválidos. Revise os campos.";
    }
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Lê uma contagem de um valor que pode ser número, objeto `{total}` ou ausente. */
export function safeCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    const total = (value as { total?: unknown }).total;
    if (typeof total === "number" && Number.isFinite(total)) return total;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* Formatação                                                         */
/* ------------------------------------------------------------------ */

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_ONLY = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const NUMBER = new Intl.NumberFormat("pt-BR");

/** Data + hora (ex.: 19/06/2026 14:30). Vazio para nulo/ inválido. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_TIME.format(d);
}

/** Apenas data (ex.: 19/06/2026). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_ONLY.format(d);
}

/** Valor em centavos → moeda BRL (ex.: 1990 → R$ 19,90). */
export function formatCentsToBRL(cents: number): string {
  return BRL.format((cents ?? 0) / 100);
}

/** Valor em reais → moeda BRL. */
export function formatBRL(value: number): string {
  return BRL.format(value ?? 0);
}

/** Inteiro com separador de milhar PT-BR. */
export function formatNumber(value: number): string {
  return NUMBER.format(value ?? 0);
}

/** Encurta UUIDs para exibição (ex.: a1b2c3d4…). */
export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/* ------------------------------------------------------------------ */
/* Rótulos PT-BR de enums                                             */
/* ------------------------------------------------------------------ */

export const ROLE_LABEL: Record<UserRole, string> = {
  customer: "Contratante",
  professional: "Profissional",
  admin: "Admin",
};

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  blocked: "Bloqueado",
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  open: "Aberto",
  purchased: "Comprado",
  closed: "Encerrado",
  cancelled: "Cancelado",
};

export const LEAD_TYPE_LABEL: Record<LeadType, string> = {
  one_time: "Pontual",
  temporary: "Temporário",
  permanent: "Permanente",
};

export const LEAD_URGENCY_LABEL: Record<LeadUrgency, string> = {
  immediate: "Imediata",
  today: "Hoje",
  this_week: "Esta semana",
  flexible: "Flexível",
};

export const TIER_LABEL: Record<CategoryTier, string> = {
  simple: "Simples",
  medium: "Média",
  premium: "Premium",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentOrderStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  failed: "Falhou",
  refunded: "Estornado",
  cancelled: "Cancelado",
};

/* ------------------------------------------------------------------ */
/* Variantes de badge por status                                      */
/* ------------------------------------------------------------------ */

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success";

export function userStatusVariant(status: UserStatus): BadgeVariant {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
      return "secondary";
    case "blocked":
      return "destructive";
    default:
      return "outline";
  }
}

export function leadStatusVariant(status: LeadStatus): BadgeVariant {
  switch (status) {
    case "open":
      return "success";
    case "purchased":
      return "default";
    case "closed":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export function paymentStatusVariant(status: PaymentOrderStatus): BadgeVariant {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
      return "secondary";
    case "failed":
      return "destructive";
    case "refunded":
      return "outline";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}
