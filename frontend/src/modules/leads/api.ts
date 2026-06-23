/**
 * Camada de acesso à API para os leads (solicitações) do contratante.
 *
 * Encapsula as chamadas a `/leads/*` e `/categories/` e normaliza a
 * resposta de listagem, que pode vir paginada (`{items,...}`) ou como
 * lista crua — ambos tratados defensivamente.
 */

import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from "@/services/api";
import type {
  Category,
  Lead,
  LeadMedia,
  LeadPurchase,
  LeadType,
  LeadUrgency,
} from "@/types";

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
  budget_range?: string;
  latitude?: number;
  longitude?: number;
}

/** Body de edição de lead (`PATCH /leads/{id}`) — apenas campos editáveis. */
export interface UpdateLeadInput {
  title?: string;
  description?: string;
  urgency?: LeadUrgency;
  neighborhood?: string | null;
  budget_range?: string | null;
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

/** Faz upload de uma foto e anexa ao lead (`POST /leads/{id}/media`). */
export function uploadLeadMedia(
  leadId: string,
  file: File
): Promise<LeadMedia> {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<LeadMedia>(`/leads/${leadId}/media`, form);
}

/** Profissional confirma a chegada digitando o código que o cliente mostra. */
export function confirmArrival(
  purchaseId: string,
  code: string
): Promise<LeadPurchase> {
  return apiPost<LeadPurchase>(
    `/lead-purchases/${purchaseId}/confirmar-chegada`,
    { code }
  );
}

/** Cliente marca que o profissional não compareceu (reabre a vaga). */
export function markNoShow(leadId: string): Promise<{ reopened: boolean }> {
  return apiPost<{ reopened: boolean }>(
    `/lead-purchases/lead/${leadId}/nao-compareceu`,
    {}
  );
}
