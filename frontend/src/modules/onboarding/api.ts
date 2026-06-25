/**
 * API do onboarding guiado — completude do perfil profissional + bônus.
 *
 * Backend: `GET /users/me/professional-profile/completion` (checklist + status)
 * e `POST /users/me/professional-profile/claim-welcome` (libera os 10 créditos
 * 1x quando o perfil fica 100%; idempotente).
 */

import { apiGet, apiPost } from "@/services/api";

export interface CompletionItem {
  key: "avatar" | "location" | "description" | "categories" | string;
  label: string;
  done: boolean;
}

export interface ProfileCompletion {
  percent: number;
  complete: boolean;
  items: CompletionItem[];
  credits_granted: boolean;
  reward: number;
}

export interface ClaimResult {
  granted: boolean;
  amount: number;
  balance: number;
  percent: number;
  complete: boolean;
  reason?: string | null;
}

export function getProfileCompletion(): Promise<ProfileCompletion> {
  return apiGet<ProfileCompletion>(
    "/users/me/professional-profile/completion"
  );
}

export function claimWelcomeCredits(): Promise<ClaimResult> {
  return apiPost<ClaimResult>(
    "/users/me/professional-profile/claim-welcome",
    {}
  );
}
