/**
 * Store de autenticação (Zustand) do TrampoJá.
 *
 * Guarda `{ user, accessToken, refreshToken }` e persiste em localStorage
 * (zustand/middleware `persist`). A hidratação acontece no client; use
 * `useAuthHydrated()` para saber se o estado persistido já foi restaurado
 * (evita flicker / mismatch de SSR).
 *
 * O cliente HTTP (`src/services/api.ts`) lê/atualiza esta store diretamente
 * via `useAuthStore.getState()` — NÃO importe a store aqui a partir do api.ts
 * de forma circular: a store é independente.
 */
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { AuthSession, User, UserRole } from "@/types";

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** True após a hidratação do estado persistido (client only). */
  hasHydrated: boolean;

  /** Define a sessão completa (login/register/refresh bem-sucedidos). */
  setAuth: (session: AuthSession) => void;
  /** Atualiza apenas os tokens (ex.: após refresh) mantendo o user. */
  setTokens: (tokens: {
    accessToken: string;
    refreshToken: string;
  }) => void;
  /** Atualiza apenas o user (ex.: após `GET /auth/me`). */
  setUser: (user: User) => void;
  /** Limpa a sessão (sinônimo de `logout`). */
  clear: () => void;
  /** Limpa a sessão (logout). */
  logout: () => void;
  /** Marca a hidratação como concluída (uso interno do middleware). */
  setHasHydrated: (value: boolean) => void;
}

const STORAGE_KEY = "trampoja-auth";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hasHydrated: false,

      setAuth: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken }),

      setTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken }),

      setUser: (user) => set({ user }),

      clear: () => set({ user: null, accessToken: null, refreshToken: null }),

      logout: () => set({ user: null, accessToken: null, refreshToken: null }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persiste apenas o necessário (não o flag de hidratação).
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/* ------------------------------------------------------------------ */
/* Seletores utilitários                                              */
/* ------------------------------------------------------------------ */

/** True se há um access token + user na store. */
export const selectIsAuthenticated = (s: AuthState): boolean =>
  Boolean(s.accessToken && s.user);

export const selectRole = (s: AuthState): UserRole | null => s.user?.role ?? null;

export const selectIsCustomer = (s: AuthState): boolean =>
  s.user?.role === "customer";

export const selectIsProfessional = (s: AuthState): boolean =>
  s.user?.role === "professional";

export const selectIsAdmin = (s: AuthState): boolean => s.user?.role === "admin";

/** Hook conveniente para o flag de hidratação. */
export const useAuthHydrated = (): boolean =>
  useAuthStore((s) => s.hasHydrated);
