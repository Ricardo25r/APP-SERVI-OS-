/**
 * Hooks utilitários de autenticação.
 *
 * - `useAuth()` expõe `user`, `role`, `isAuthenticated` e flags de papel,
 *   além de `logout` e o flag `hasHydrated`.
 * - `useRequireAuth(role?)` redireciona para `/login` se não autenticado
 *   (ou para `/` se o papel não bater). Use em páginas protegidas.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  useAuthStore,
  selectIsAuthenticated,
  type AuthState,
} from "@/store/auth";
import type { User, UserRole } from "@/types";

export interface UseAuthResult {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isCustomer: boolean;
  isProfessional: boolean;
  isAdmin: boolean;
  /** True após restaurar o estado persistido (evita decisões prematuras). */
  hasHydrated: boolean;
  logout: () => void;
}

export function useAuth(): UseAuthResult {
  const user = useAuthStore((s: AuthState) => s.user);
  const accessToken = useAuthStore((s: AuthState) => s.accessToken);
  const hasHydrated = useAuthStore((s: AuthState) => s.hasHydrated);
  const logout = useAuthStore((s: AuthState) => s.logout);

  const isAuthenticated = Boolean(accessToken && user);

  return {
    user,
    role: user?.role ?? null,
    isAuthenticated,
    isCustomer: user?.role === "customer",
    isProfessional: user?.role === "professional",
    isAdmin: user?.role === "admin",
    hasHydrated,
    logout,
  };
}

/**
 * Garante autenticação (e, opcionalmente, um papel específico).
 * Redireciona após a hidratação para evitar redirect indevido no SSR/primeiro
 * render. Retorna o estado de auth para uso conveniente na página.
 */
export function useRequireAuth(role?: UserRole): UseAuthResult {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.hasHydrated) return;

    if (!auth.isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (role && auth.role !== role) {
      router.replace("/");
    }
  }, [auth.hasHydrated, auth.isAuthenticated, auth.role, role, router]);

  return auth;
}

export { selectIsAuthenticated };
