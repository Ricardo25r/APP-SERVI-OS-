/**
 * Utilitários do MARKETPLACE do profissional (ver/comprar leads).
 *
 * Subpasta `marketplace/` para NÃO colidir com o módulo de solicitações do
 * contratante (que também vive em `src/modules/leads`).
 *
 * - `normalizeLeadsResponse`: aceita lista crua OU envelope `Paginated<Lead>`.
 * - `urgencyMeta`: rótulo PT-BR + variante de Badge para a urgência.
 * - `formatDate`: data ISO em PT-BR.
 * - `purchaseErrorMessage`: mapeia os status do POST /lead-purchases/
 *   (402/403/409) para mensagens claras + se há ação de "ir para créditos".
 */

import { ApiError } from "@/services/api";
import type { Lead, LeadUrgency, Paginated } from "@/types";

/**
 * O endpoint `GET /leads/` pode retornar uma lista crua OU um envelope
 * paginado. Esta função normaliza ambos os formatos para `Lead[]`.
 */
export function normalizeLeadsResponse(
  data: Lead[] | Paginated<Lead> | null | undefined
): Lead[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as Paginated<Lead>).items)) {
    return (data as Paginated<Lead>).items;
  }
  return [];
}

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success";

interface UrgencyMeta {
  label: string;
  variant: BadgeVariant;
}

/** Rótulo + variante de Badge por urgência. */
export function urgencyMeta(urgency: LeadUrgency): UrgencyMeta {
  const map: Record<LeadUrgency, UrgencyMeta> = {
    immediate: { label: "Imediato", variant: "destructive" },
    today: { label: "Hoje", variant: "destructive" },
    this_week: { label: "Esta semana", variant: "secondary" },
    flexible: { label: "Flexível", variant: "outline" },
  };
  return map[urgency] ?? { label: urgency, variant: "outline" };
}

/** Formata uma data ISO em `dd/mm/aaaa` (PT-BR). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export interface PurchaseErrorInfo {
  message: string;
  /** Se true, a UI deve oferecer um link/CTA para `/credits`. */
  offerCredits: boolean;
}

/**
 * Mapeia erros do `POST /lead-purchases/` para mensagens claras (PT-BR).
 * - 402: saldo insuficiente -> oferece link para créditos.
 * - 403: inelegível (categoria/cidade fora do perfil).
 * - 409: lead já comprado (Lead Exclusivo).
 */
export function purchaseErrorMessage(error: unknown): PurchaseErrorInfo {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 402:
        return {
          message:
            "Saldo de créditos insuficiente para comprar este lead. Adicione créditos para continuar.",
          offerCredits: true,
        };
      case 403:
        return {
          message:
            "Você não é elegível para este lead. Ele é de outra categoria ou cidade fora do seu perfil.",
          offerCredits: false,
        };
      case 409:
        return {
          message:
            "Este lead é exclusivo e já foi comprado por outro profissional.",
          offerCredits: false,
        };
      default:
        if (error.message && error.message.trim().length > 0) {
          return { message: error.message, offerCredits: false };
        }
        return {
          message: "Não foi possível comprar o lead. Tente novamente.",
          offerCredits: false,
        };
    }
  }
  if (error instanceof Error && error.message) {
    return { message: error.message, offerCredits: false };
  }
  return {
    message: "Ocorreu um erro inesperado. Tente novamente.",
    offerCredits: false,
  };
}

/** Mensagem amigável (PT-BR) para falha ao carregar a listagem. */
export function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message && error.message.trim().length > 0) return error.message;
    if (error.status === 401) return "Sessão expirada. Faça login novamente.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível carregar as oportunidades. Tente novamente.";
}
