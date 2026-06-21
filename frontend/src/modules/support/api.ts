/**
 * Camada de acesso à API de **Suporte** (Fase 15 — chamados).
 *
 * - `POST  /support/tickets`        → abrir chamado.
 * - `GET   /support/tickets/me`     → meus chamados.
 * - `GET   /support/tickets`        → todos (admin).
 * - `PATCH /support/tickets/{id}`   → status (admin).
 */

import { apiGet, apiPatch, apiPost } from "@/services/api";

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export interface SupportTicketListResponse {
  items: SupportTicket[];
  total: number;
}

export interface CreateTicketInput {
  subject: string;
  message: string;
}

export function createSupportTicket(
  input: CreateTicketInput
): Promise<SupportTicket> {
  return apiPost<SupportTicket>("/support/tickets", input);
}

export function fetchMyTickets(): Promise<SupportTicketListResponse> {
  return apiGet<SupportTicketListResponse>("/support/tickets/me");
}

/* ------------------------------------------------------------------ */
/* Admin                                                              */
/* ------------------------------------------------------------------ */

export interface SupportTicketAdmin extends SupportTicket {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
}

export interface SupportTicketAdminListResponse {
  items: SupportTicketAdmin[];
  total: number;
}

export function fetchAllTickets(
  page = 1
): Promise<SupportTicketAdminListResponse> {
  return apiGet<SupportTicketAdminListResponse>(
    `/support/tickets?page=${page}&page_size=50`
  );
}

export function updateTicketStatus(
  id: string,
  status: "open" | "closed"
): Promise<SupportTicketAdmin> {
  return apiPatch<SupportTicketAdmin>(`/support/tickets/${id}`, { status });
}
