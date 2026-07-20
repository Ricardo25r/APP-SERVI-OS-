/**
 * Home (`/`) — despacha por plataforma, estado de autenticação e papel.
 *
 * - **Logado:** home por papel (`CustomerHome`, `ProfessionalHome`, `AdminHome`).
 * - **Deslogado no app nativo:** redireciona para a **Splash** (`/splash`), que
 *   conduz o primeiro acesso (Splash → Onboarding → Login/Cadastro) — a "cara de app".
 * - **Deslogado no navegador (web):** mostra a **home institucional**
 *   (`MarketingHome`) dentro da `MarketingShell` (header/footer de marketing).
 *
 * A detecção navegador × app usa `useIsNativeApp()` (Capacitor). Usa `hasHydrated`
 * para evitar flicker entre SSR e hidratação.
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

  // Deslogado + app nativo: entra pelo fluxo do app (splash → onboarding → login).
  useEffect(() => {
    if (hasHydrated && !isAuthenticated && isNativeApp) {
      router.replace("/splash");
    }
  }, [hasHydrated, isAuthenticated, isNativeApp, router]);

  // Antes da hidratação — evita flash de conteúdo errado.
  if (!hasHydrated) {
    return <FullscreenLoader />;
  }

  // Logado: home por papel.
  if (isAuthenticated && user) {
    if (role === "professional") return <ProfessionalHome user={user} />;
    if (role === "admin") return <AdminHome user={user} />;
    return <CustomerHome user={user} />;
  }

  // Deslogado no app nativo: enquanto redireciona para a splash.
  if (isNativeApp) {
    return <FullscreenLoader />;
  }

  // Deslogado no navegador (web): home institucional pública.
  return (
    <MarketingShell>
      <MarketingHome />
    </MarketingShell>
  );
}
