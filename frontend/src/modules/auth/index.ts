/** Ponto de entrada do módulo de autenticação (telas públicas). */
export { AuthCard } from "@/modules/auth/auth-card";
export { AuthLayout } from "@/modules/auth/auth-layout";
export { RoleSelector } from "@/modules/auth/role-selector";
export { FormError, FieldError } from "@/modules/auth/form-error";
export { useRedirectAuthenticated } from "@/modules/auth/use-redirect-authenticated";
export {
  toSession,
  homePathForRole,
  messageFromError,
} from "@/modules/auth/utils";
