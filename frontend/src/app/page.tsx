/**
 * Home (`/`) — despacha por HOST, plataforma, autenticação e papel.
 *
 * O site institucional mora em `www.faztudoapp.com.br`; o app no domínio puro
 * `faztudoapp.com.br`. A mesma build serve os dois hosts, então `/` decide:
 *
 * - **App nativo** (Capacitor) → sempre o fluxo do app (`/splash`).
 * - **Host do app** (domínio puro): logado → home por papel; deslogado → `/splash`.
 * - **Host do site** (www, localhost, previews): logado → home por papel;
 *   deslogado → **home institucional** (`MarketingHome`).
 *
 * Detecção de app nativo via `useIsNativeApp()`. `hasHydrated` evita flicker.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useIsNativeApp } from "@/hooks/use-native-app";
import { CustomerHome } from "@/modules/home/customer-home";
import { ProfessionalHome } from "@/modules/home/professional-home";
import { AdminHome } from "@/modules/home/admin-home";
import { MarketingShell } from "@/modules/site/marketing-shell";
import { MarketingHome } from "@/modules/site/marketing-home";

/** Domínio puro = host do APP (o site institucional fica no subdomínio www). */
function isAppHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "faztudoapp.com.br";
}

function FullscreenLoader() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    </main>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, role, isAuthenticated, hasHydrated } = useAuth();
  const isNativeApp = useIsNativeApp();

  // App (nativo OU domínio puro) + deslogado → entra pelo fluxo do app (splash).
  useEffect(() => {
    if (!hasHydrated || isAuthenticated) return;
    if (isNativeApp || isAppHost()) {
      router.replace("/splash");
    }
  }, [hasHydrated, isAuthenticated, isNativeApp, router]);

  // Antes da hidratação — evita flash de conteúdo errado.
  if (!hasHydrated) {
    return <FullscreenLoader />;
  }

  // Logado: home por papel (em qualquer host).
  if (isAuthenticated && user) {
    if (role === "professional") return <ProfessionalHome user={user} />;
    if (role === "admin") return <AdminHome user={user} />;
    return <CustomerHome user={user} />;
  }

  // Deslogado no app (nativo ou domínio puro): enquanto redireciona p/ splash.
  if (isNativeApp || isAppHost()) {
    return <FullscreenLoader />;
  }

  // Deslogado no host do site (www/dev): home institucional pública.
  return (
    <MarketingShell>
      <MarketingHome />
    </MarketingShell>
  );
}
