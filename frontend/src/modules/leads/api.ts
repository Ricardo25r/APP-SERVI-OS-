/**
 * Camada de acesso à API para os leads (solicitações) do contratante.
 *
 * Encapsula as chamadas a `/leads/*` e `/categories/` e normaliza a
 * resposta de listagem, que pode vir paginada (`{items,...}`) ou como
 * lista crua — ambos tratados defensivamente.
 */

import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api";
import type { Category, Lead, LeadType, LeadUrgency } from "@/types";

/** Body de criação de lead (`POST /leads/`). */
export interface CreateLeadInput {
  category_id: string;
  title: string;
  description: string;
  lead_type: LeadType;
  urgency: LeadUrgency;
  city: string;
  state: string;
  neighborhood?: string;
}

/** Body de edição de lead (`PATCH /leads/{id}`) — apenas campos editáveis. */
export interface UpdateLeadInput {
  title?: string;
  description?: string;
  urgency?: LeadUrgency;
  neighborhood?: string | null;
}

/**
 * Extrai a lista de itens de uma resposta que pode ser:
 * - um array cru `T[]`;
 * - um envelope paginado `{ items: T[], ... }`.
 * Qualquer outro formato resulta em lista vazia (defensivo).
 */
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray((data as { items: unknown }).items)
  ) {
    return (data as { items: T[] }).items;
  }
  return [];
}

/** Categorias públicas (para escolher ao criar a solicitação). */
export async function fetchCategories(): Promise<Category[]> {
  const data = await apiGet<unknown>("/categories/");
  return unwrapList<Category>(data);
}

/** Lista as solicitações do próprio contratante. */
export async function fetchMyLeads(): Promise<Lead[]> {
  const data = await apiGet<unknown>("/leads/");
  return unwrapList<Lead>(data);
}

/** Detalhe de uma solicitação. */
export function fetchLead(id: string): Promise<Lead> {
  return apiGet<Lead>(`/leads/${id}`);
}

/** Cria uma nova solicitação. */
export function createLead(input: CreateLeadInput): Promise<Lead> {
  return apiPost<Lead>("/leads/", input);
}

/** Edita uma solicitação aberta. */
export function updateLead(id: string, input: UpdateLeadInput): Promise<Lead> {
  return apiPatch<Lead>(`/leads/${id}`, input);
}

/** Cancela (exclui) uma solicitação aberta. */
export function cancelLead(id: string): Promise<void> {
  return apiDelete<void>(`/leads/${id}`);
}
