/**
 * Tela de **Perfil** do FazTudo (`/profile`).
 *
 * Protegida por `useRequireAuth()` — redireciona para `/login` se não houver
 * sessão (após a hidratação). Renderiza conforme o papel do usuário:
 *
 * - **customer**     → `CustomerProfileSection` (city/state; cria ou edita).
 * - **professional** → `ProfessionalProfileSection` (dados + saldo de créditos)
 *                      seguida de `ProfessionalCategoriesSection` (categorias).
 *
 * Estados de loading (hidratação/auth) e erro são tratados aqui e nas seções.
 */
"use client";

import { useRequireAuth } from "@/hooks/use-auth";

import { CustomerProfileSection } from "@/modules/profile/customer-profile-section";
import { ProfessionalProfileSection } from "@/modules/profile/professional-profile-section";
import { ProfessionalCategoriesSection } from "@/modules/profile/professional-categories-section";
import { LoadingState } from "@/modules/profile/feedback";

export default function ProfilePage() {
  const { user, role, isAuthenticated, hasHydrated } = useRequireAuth();

  // Enquanto a sessão persistida não foi restaurada (ou o redirect de
  // `useRequireAuth` ainda não rodou), evitamos renderizar conteúdo protegido.
  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <LoadingState label="Carregando..." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-muted-foreground">
          Olá, {user.name}. Gerencie suas informações abaixo.
        </p>
      </header>

      {role === "customer" && <CustomerProfileSection />}

      {role === "professional" && (
        <div className="space-y-6">
          <ProfessionalProfileSection />
          <ProfessionalCategoriesSection />
        </div>
      )}

      {role === "admin" && (
        <p className="text-sm text-muted-foreground">
          Administradores não possuem perfil de cliente ou profissional.
        </p>
      )}
    </main>
  );
}
