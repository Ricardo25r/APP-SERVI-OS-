/**
 * Hook usado pelas telas públicas de auth (login/cadastro).
 *
 * Se o usuário já estiver autenticado (após a hidratação do estado persistido),
 * redireciona para a home do seu papel — evitando que veja o formulário à toa.
 *
 * Retorna `hasHydrated` para que a página possa segurar a renderização até a
 * decisão estar tomada (evita flicker do formulário antes do redirect).
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import { homePathForRole } from "@/modules/auth/utils";

export function useRedirectAuthenticated(): { hasHydrated: boolean } {
  const router = useRouter();
  const { isAuthenticated, role, hasHydrated } = useAuth();

  useEffect(() => {
    if (!hasHydrated) return;
    if (isAuthenticated && role) {
      router.replace(homePathForRole(role));
    }
  }, [hasHydrated, isAuthenticated, role, router]);

  return { hasHydrated };
}
