/**
 * Camada de acesso à API para a feature **Admin** (Fase 10).
 *
 * Encapsula as chamadas a `/admin/*` (todas exigem papel admin; o Bearer é
 * injetado automaticamente por `@/services/api`) e reusa endpoints existentes
 * para categorias (`/categories/*`) e concessão de créditos (`/credits/grant`).
 *
 * Listagens são normalizadas defensivamente: a resposta pode vir como envelope
 * paginado (`{items, page, page_size, total}`) ou como array cru.
 */

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/services/api";
import type { Category } from "@/types";
import type { PaymentSettings } from "@/modules/payments/types";

import type {
  AdminLead,
  AdminMetrics,
  AdminPage,
  AdminPayment,
  AdminPaymentsPage,
  AdminUser,
  AuditFilters,
  AuditLog,
  CategoryInput,
  GrantCreditsInput,
  LeadsFilters,
  PaymentsFilters,
  UserRoleUpdate,
  UsersFilters,
  UserStatusUpdate,
} from "./types";

const DEFAULT_PAGE_SIZE = 20;

/**
 * Normaliza uma resposta de listagem para um `AdminPage<T>`.
 * Aceita o envelope paginado padrão ou um array cru (fallback defensivo).
 */
function toPage<T>(data: unknown, page = 1): AdminPage<T> {
  if (Array.isArray(data)) {
    return { items: data as T[], page, page_size: data.length, total: data.length };
  }
  if (data && typeof data === "object" && "items" in data) {
    const env = data as Partial<AdminPage<T>>;
    return {
      items: Array.isArray(env.items) ? (env.items as T[]) : [],
      page: typeof env.page === "number" ? env.page : page,
      page_size:
        typeof env.page_size === "number" ? env.page_size : DEFAULT_PAGE_SIZE,
      total: typeof env.total === "number" ? env.total : 0,
    };
  }
  return { items: [], page, page_size: DEFAULT_PAGE_SIZE, total: 0 };
}

/** Monta uma query string a partir de um mapa, ignorando vazios/undefined. */
function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str === "") continue;
    sp.set(key, str);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

/* ------------------------------------------------------------------ */
/* Métricas                                                           */
/* ------------------------------------------------------------------ */

/** KPIs do dashboard (`GET /admin/metrics`). */
export function fetchMetrics(): Promise<AdminMetrics> {
  return apiGet<AdminMetrics>("/admin/metrics");
}

/* ------------------------------------------------------------------ */
/* Usuários                                                           */
/* ------------------------------------------------------------------ */

/** Lista paginada de usuários (`GET /admin/users`). */
export async function fetchUsers(
  filters: UsersFilters = {}
): Promise<AdminPage<AdminUser>> {
  const path = `/admin/users${buildQuery({
    role: filters.role,
    status: filters.status,
    q: filters.q,
    page: filters.page,
  })}`;
  const data = await apiGet<unknown>(path);
  return toPage<AdminUser>(data, filters.page ?? 1);
}

/** Altera o status de um usuário (`PATCH /admin/users/{id}/status`). */
export function updateUserStatus(
  id: string,
  payload: UserStatusUpdate
): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/admin/users/${id}/status`, payload);
}

/** Altera o papel de um usuário — promover/rebaixar admin (`PATCH /admin/users/{id}/role`). */
export function updateUserRole(
  id: string,
  payload: UserRoleUpdate
): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/admin/users/${id}/role`, payload);
}

/** Exclui (anonimiza + desativa) um usuário — ex.: limpar contas de teste. */
export function deleteUser(id: string): Promise<void> {
  return apiDelete<void>(`/admin/users/${id}`);
}

/* ------------------------------------------------------------------ */
/* Leads (moderação)                                                  */
/* ------------------------------------------------------------------ */

/** Lista paginada de leads (`GET /admin/leads`). */
export async function fetchLeads(
  filters: LeadsFilters = {}
): Promise<AdminPage<AdminLead>> {
  const path = `/admin/leads${buildQuery({
    status: filters.status,
    category_id: filters.category_id,
    city: filters.city,
    page: filters.page,
  })}`;
  const data = await apiGet<unknown>(path);
  return toPage<AdminLead>(data, filters.page ?? 1);
}

/** Cancela um lead (`PATCH /admin/leads/{id}/cancel`). */
export function cancelLead(id: string, reason?: string): Promise<AdminLead> {
  return apiPatch<AdminLead>(`/admin/leads/${id}/cancel`, { reason });
}

/* ------------------------------------------------------------------ */
/* Financeiro                                                         */
/* ------------------------------------------------------------------ */

/** Lista paginada de pagamentos + resumo de receita (`GET /admin/payments`). */
export async function fetchPayments(
  filters: PaymentsFilters = {}
): Promise<AdminPaymentsPage> {
  const path = `/admin/payments${buildQuery({
    status: filters.status,
    page: filters.page,
  })}`;
  const data = await apiGet<unknown>(path);
  const page = toPage<AdminPayment>(data, filters.page ?? 1);

  const summary =
    data && typeof data === "object" && "summary" in data
      ? ((data as { summary: AdminPaymentsPage["summary"] }).summary ?? null)
      : null;

  return {
    ...page,
    summary:
      summary ?? {
        paid_orders: 0,
        revenue_cents: 0,
        revenue_brl: 0,
        refunded_orders: 0,
      },
  };
}

/* ------------------------------------------------------------------ */
/* Auditoria                                                          */
/* ------------------------------------------------------------------ */

/** Trilha de auditoria paginada (`GET /admin/audit`). */
export async function fetchAuditLogs(
  filters: AuditFilters = {}
): Promise<AdminPage<AuditLog>> {
  const path = `/admin/audit${buildQuery({ page: filters.page })}`;
  const data = await apiGet<unknown>(path);
  return toPage<AuditLog>(data, filters.page ?? 1);
}

/* ------------------------------------------------------------------ */
/* Categorias (endpoints existentes — reusados)                       */
/* ------------------------------------------------------------------ */

/** Lista todas as categorias, inclusive inativas (`GET /categories/?active=false`). */
export async function fetchAllCategories(): Promise<Category[]> {
  const data = await apiGet<unknown>("/categories/?active=false");
  if (Array.isArray(data)) return data as Category[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items: unknown }).items;
    if (Array.isArray(items)) return items as Category[];
  }
  return [];
}

/** Cria uma categoria (`POST /categories/`, admin). */
export function createCategory(input: CategoryInput): Promise<Category> {
  return apiPost<Category>("/categories/", input);
}

/** Atualiza parcialmente uma categoria (`PATCH /categories/{id}`, admin). */
export function updateCategory(
  id: string,
  input: Partial<CategoryInput>
): Promise<Category> {
  return apiPatch<Category>(`/categories/${id}`, input);
}

/** Desativa uma categoria (`DELETE /categories/{id}` — soft delete, admin). */
export function deactivateCategory(id: string): Promise<void> {
  return apiDelete<void>(`/categories/${id}`);
}

/* ------------------------------------------------------------------ */
/* Créditos (endpoint existente — reusado)                            */
/* ------------------------------------------------------------------ */

/** Concede créditos a um profissional (`POST /credits/grant`, admin). */
/** Confirma manualmente um pedido (Pix manual) → credita a carteira. */
export function confirmOrder(orderId: string): Promise<unknown> {
  return apiPost(`/payments/orders/${orderId}/confirmar`, {});
}

/** Dados de recebimento (Pix/banco) — leitura (admin). */
export function fetchPaymentSettings(): Promise<PaymentSettings> {
  return apiGet<PaymentSettings>("/payments/settings");
}

/** Dados de recebimento (Pix/banco) — atualização (admin). */
export function updatePaymentSettings(
  data: Partial<PaymentSettings>
): Promise<PaymentSettings> {
  return apiPut<PaymentSettings>("/payments/settings", data);
}

export function grantCredits(input: GrantCreditsInput): Promise<unknown> {
  return apiPost<unknown>("/credits/grant", input);
}
