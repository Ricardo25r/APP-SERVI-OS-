/**
 * Tipos compartilhados do FazTudo — espelham os schemas `*Read` do backend
 * (contrato Fases 2-5). Fonte da verdade é sempre o backend; estes tipos
 * existem para tipar respostas/requests no frontend.
 *
 * Outras features (auth, profile, categories, leads, credits) reusam estes
 * tipos — NÃO renomear sem alinhar o contrato.
 */

/* ------------------------------------------------------------------ */
/* Enums (espelham os ENUM nativos do Postgres / Python str enums)    */
/* ------------------------------------------------------------------ */

export type UserRole = "customer" | "professional" | "admin";

export type UserStatus = "active" | "suspended" | "blocked";

export type AvailabilityStatus = "available" | "busy" | "unavailable";

export type CategoryTier = "simple" | "medium" | "premium";

export type LeadType = "one_time" | "temporary" | "permanent";

export type LeadUrgency = "immediate" | "today" | "this_week" | "flexible";

export type LeadStatus = "open" | "purchased" | "closed" | "cancelled";

export type CreditTransactionType =
  | "purchase"
  | "bonus"
  | "refund"
  | "spend"
  | "adjustment";

/* ------------------------------------------------------------------ */
/* Entidades                                                          */
/* ------------------------------------------------------------------ */

/** `UserRead` do backend (sem `password_hash`). */
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
  /** URL (presignada) da foto de perfil; ausente = usa iniciais. */
  avatar_url?: string | null;
  /** Flags opcionais devolvidas por `GET /auth/me`. */
  has_customer_profile?: boolean;
  has_professional_profile?: boolean;
}

/** `CategoryRead`. */
export interface Category {
  id: string;
  name: string;
  slug: string;
  tier: CategoryTier;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** `CustomerProfileRead`. */
export interface CustomerProfile {
  id: string;
  user_id: string;
  city: string | null;
  state: string | null;
  reputation_score: number;
  created_at: string;
  updated_at: string;
}

/** `ProfessionalProfileRead` (versão completa, do dono). */
export interface ProfessionalProfile {
  id: string;
  user_id: string;
  headline: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  service_radius_km: number;
  latitude?: number | null;
  longitude?: number | null;
  verified: boolean;
  premium: boolean;
  rating: number;
  total_reviews: number;
  xp: number;
  level: number;
  availability_status: AvailabilityStatus;
  categories?: Category[];
  created_at: string;
  updated_at: string;
}

/** `ProfessionalProfilePublic` (perfil público, sem dados sensíveis). */
export interface ProfessionalProfilePublic {
  id: string;
  user_id: string;
  name: string;
  headline: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  service_radius_km: number;
  latitude?: number | null;
  longitude?: number | null;
  verified: boolean;
  premium: boolean;
  rating: number;
  total_reviews: number;
  level: number;
  availability_status: AvailabilityStatus;
  categories?: Category[];
}

/** Resumo da categoria embutido no lead. */
export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  tier: CategoryTier;
}

/** Resumo do customer embutido no lead (sem contato p/ professional não-comprador). */
export interface LeadCustomerSummary {
  id: string;
  name: string;
}

/** Contato do customer — só liberado p/ professional comprador ou customer dono. */
export interface LeadContact {
  name: string;
  phone: string | null;
  email: string;
}

/** `LeadRead`. */
export interface Lead {
  id: string;
  customer_id: string;
  category_id: string;
  title: string;
  description: string;
  lead_type: LeadType;
  urgency: LeadUrgency;
  city: string;
  state: string;
  neighborhood: string | null;
  budget_range: string | null;
  latitude: number | null;
  longitude: number | null;
  status: LeadStatus;
  credits_cost: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  category?: CategorySummary;
  customer?: LeadCustomerSummary;
  /** Verdadeiro se o lead já foi comprado por algum profissional. */
  is_purchased?: boolean;
  /** Saldo do profissional cobre o custo (listagem do marketplace). */
  affordable?: boolean;
  /** Contato liberado (apenas comprador/dono). */
  contact?: LeadContact;
  /** Fotos do serviço (URL presignada). */
  media?: LeadMedia[];
  /** Distância (km) do profissional ao serviço (visão do profissional). */
  distance_km?: number | null;
  /** Confirmação de serviço: código de chegada (só o cliente dono recebe). */
  arrival_code?: string | null;
  /** Confirmação de serviço: o profissional já confirmou a chegada. */
  arrived?: boolean;
  /** Id da compra ativa (para o profissional confirmar a chegada). */
  purchase_id?: string | null;
  /** Reputação do cliente: nº de não-comparecimentos (visão do profissional). */
  customer_no_show_count?: number | null;
}

/** Foto do lead (`LeadMediaOut`). */
export interface LeadMedia {
  id: string;
  url: string;
  position: number;
}

/** `credit_wallets` -> resposta de `GET /credits/balance`. */
export interface CreditWallet {
  wallet_id: string;
  balance: number;
}

/** `CreditTransactionRead`. */
export interface CreditTransaction {
  id: string;
  transaction_type: CreditTransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

/** `LeadPurchaseRead`. */
export interface LeadPurchase {
  id: string;
  lead_id: string;
  professional_id: string;
  credits_used: number;
  purchased_at: string;
  /** Prazo p/ iniciar o contato após desbloquear (purchased_at + janela). */
  contact_deadline?: string | null;
  /** Data/hora da confirmação de chegada (null = não confirmada). */
  arrived_at?: string | null;
  lead?: Lead;
  contact?: LeadContact;
}

/* ------------------------------------------------------------------ */
/* Auth / tokens                                                      */
/* ------------------------------------------------------------------ */

/** `TokenPair` do backend. */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
}

/**
 * Resposta de `POST /auth/register` e `POST /auth/login`.
 * O contrato (§4) descreve `{ user, tokens }`; aceitamos também o formato plano
 * `{ user, access_token, refresh_token, token_type }` para robustez.
 */
export interface AuthResponse {
  user: User;
  tokens?: TokenPair;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
}

/** Estado de sessão persistido no store. */
export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/* ------------------------------------------------------------------ */
/* Utilitários de API                                                 */
/* ------------------------------------------------------------------ */

/** Envelope paginado padrão (`?page=&page_size=`). */
export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}
