/**
 * Utilitários compartilhados entre as telas de Login e Cadastro.
 *
 * - `toSession`: normaliza a resposta do backend (`AuthResponse`, que pode vir
 *   como `{ user, tokens }` ou no formato plano `{ user, access_token, ... }`)
 *   para o `AuthSession` (camelCase) esperado por `useAuthStore.setAuth`.
 * - `homePathForRole`: rota de destino pós-login conforme o papel.
 * - `messageFromError`: extrai uma mensagem amigável (PT-BR) de erros da API.
 */

import { ApiError } from "@/services/api";
import type { AuthResponse, AuthSession, UserRole } from "@/types";

/**
 * Converte a resposta de `/auth/login` ou `/auth/register` no formato
 * persistido pela store. Aceita tanto `{ user, tokens }` quanto o formato
 * plano `{ user, access_token, refresh_token }`.
 *
 * @throws {Error} se a resposta não trouxer os tokens esperados.
 */
export function toSession(resp: AuthResponse): AuthSession {
  const accessToken = resp.tokens?.access_token ?? resp.access_token;
  const refreshToken = resp.tokens?.refresh_token ?? resp.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error("Resposta de autenticação inválida (tokens ausentes).");
  }

  return {
    user: resp.user,
    accessToken,
    refreshToken,
  };
}

/** Rota inicial conforme o papel do usuário. */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case "customer":
      return "/";
    case "professional":
      return "/marketplace";
    case "admin":
    default:
      return "/";
  }
}

/** Mensagem de erro amigável (PT-BR) para exibir no formulário. */
export function messageFromError(error: unknown): string {
  if (error instanceof ApiError) {
    // O `message` já prioriza o `detail` do FastAPI (inclui erros 422).
    if (error.message && error.message.trim().length > 0) {
      return error.message;
    }
    switch (error.status) {
      case 401:
        return "E-mail ou senha inválidos.";
      case 409:
        return "E-mail ou telefone já cadastrado.";
      case 422:
        return "Verifique os dados informados.";
      default:
        return "Não foi possível concluir a operação. Tente novamente.";
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Ocorreu um erro inesperado. Tente novamente.";
}
