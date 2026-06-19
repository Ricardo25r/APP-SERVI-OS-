/**
 * Tipos da feature **Admin** (Fase 10 — Painel Administrativo).
 *
 * Espelham os schemas `*Read` / envelopes paginados do backend
 * (`app/schemas/admin.py`). Fonte da verdade é sempre o backend; estes tipos
 * existem para tipar respostas/requests no frontend.
 *
 * Todos os campos numéricos/contagens são tratados defensivamente nas telas
 * (o backend pode evoluir o shape de métricas — ver `safeCount` em utils).
 */

import type {
  CategoryTier,
  LeadStatus,
  LeadType,
  LeadUrgency,
  UserRole,
  UserStatus,
} from "@/types";

/* ------------------------------------------------------------------ */
/* Métricas (GET /admin/metrics)                                      */
/* ------------------------------------------------------------------ */

/** Contagem de usuários por papel. */
export interface RoleCounts {
  total: number;
  customer: number;
  professional: number;
  admin: number;
}

/** Contagem de leads por status. */
export interface LeadStatusCounts {
  total: number;
  open: number;
  purchased: number;
  closed: number;
  cancelled: number;
}

/** Resumo financeiro (receita dos pedidos pagos). */
export interface FinanceSummary {
  paid_orders: number;
  revenue_cents: number;
  revenue_brl: number;
  refunded_orders: number;
}

/**
 * KPIs do dashboard. Campos marcados como opcionais/`unknown` para resiliência:
 * o backend atual devolve objetos (`users`, `leads`, `finance`) e contagens,
 * mas tratamos defensivamente caso algum venha como número simples.
 */
export interface AdminMetrics {
  users: RoleCounts;
  professionals: number;
  customers: number;
  leads: LeadStatusCounts;
  lead_purchases: number;
  credit_packages_sold: number;
  reviews: number;
  conversations: number;
  finance: FinanceSummary;
}

/* ------------------------------------------------------------------ */
/* Usuários                                                           */
/* ------------------------------------------------------------------ */

/** `AdminUserRead` — usuário na visão do admin. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

/* ------------------------------------------------------------------ */
/* Leads (moderação)                                                  */
/* ------------------------------------------------------------------ */

/** `AdminLeadRead` — lead na visão do admin. */
export interface AdminLead {
  id: string;
  customer_id: string;
  category_id: string;
  title: string;
  lead_type: LeadType;
  urgency: LeadUrgency;
  city: string;
  state: string;
  neighborhood: string | null;
  status: LeadStatus;
  credits_cost: number;
  expires_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

/* ------------------------------------------------------------------ */
/* Financeiro                                                         */
/* ------------------------------------------------------------------ */

export type PaymentOrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";

/** `AdminPaymentRead` — pedido de pagamento na visão do admin. */
export interface AdminPayment {
  id: string;
  user_id: string;
  package_id: string;
  provider: string;
  amount_cents: number;
  credits: number;
  currency: string;
  status: PaymentOrderStatus;
  external_reference: string;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Auditoria                                                          */
/* ------------------------------------------------------------------ */

/** `AuditLogRead` — registro imutável da trilha de auditoria. */
export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Filtros / paginação                                                */
/* ------------------------------------------------------------------ */

/** Envelope paginado padrão das listagens admin. */
export interface AdminPage<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

/** Envelope paginado de pagamentos (inclui resumo de receita). */
export interface AdminPaymentsPage extends AdminPage<AdminPayment> {
  summary: FinanceSummary;
}

export interface UsersFilters {
  role?: UserRole;
  status?: UserStatus;
  q?: string;
  page?: number;
}

export interface LeadsFilters {
  status?: LeadStatus;
  category_id?: string;
  city?: string;
  page?: number;
}

export interface PaymentsFilters {
  status?: PaymentOrderStatus;
  page?: number;
}

export interface AuditFilters {
  page?: number;
}

/** Body de `PATCH /admin/users/{id}/status`. */
export interface UserStatusUpdate {
  status: UserStatus;
  reason?: string;
}

/** Body de `POST /credits/grant` (transaction_type fixo em "bonus"). */
export interface GrantCreditsInput {
  professional_id: string;
  amount: number;
  transaction_type: "bonus";
  description?: string;
}

/** Body de criação/edição de categoria (admin). */
export interface CategoryInput {
  name: string;
  slug?: string;
  tier: CategoryTier;
  active?: boolean;
}
