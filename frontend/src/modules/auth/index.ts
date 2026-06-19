/** Ponto de entrada do módulo de autenticação (telas públicas). */
export { AuthCard } from "@/modules/auth/auth-card";
export { FormError, FieldError } from "@/modules/auth/form-error";
export { useRedirectAuthenticated } from "@/modules/auth/use-redirect-authenticated";
export {
  toSession,
  homePathForRole,
  messageFromError,
} from "@/modules/auth/utils";
