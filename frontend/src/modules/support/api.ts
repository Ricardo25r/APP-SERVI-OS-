/**
 * Camada de acesso à API de **Suporte** (Fase 15 — chamados).
 *
 * - `POST /support/tickets`    → abrir chamado.
 * - `GET  /support/tickets/me` → meus chamados.
 */

import { apiGet, apiPost } from "@/services/api";

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
