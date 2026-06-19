/**
 * Tela de **Configurações** (`/configuracoes`) — Tela 21 dos mockups.
 *
 * Protegida por `useRequireAuth()`. Estrutura:
 * - Cartão de perfil no topo (`ProfileHeaderCard`).
 * - Seção **Preferências** (tema/idioma/notificações) — em estilo de lista com
 *   `IconChip` + chevron/toggle.
 * - Seção **Conta** (Editar perfil → /profile, Suporte → /suporte, Sair).
 *
 * ⚠️ Os toggles/seletores de Preferências são **VISUAIS (placeholder)**: mantêm
 * estado apenas local na UI e NÃO são persistidos no backend (não há endpoint
 * de preferências). Servem para fidelidade visual ao mockup. Quando o backend
 * expuser preferências, basta plugar o estado a uma mutation.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Palette,
  Shield,
  Lock,
  Languages,
  Bell,
  UserCog,
  LifeBuoy,
  LogOut,
  ChevronRight,
} from "lucide-react";

import { useRequireAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { SettingsRow, SettingsRowList } from "@/components/ui/settings-row";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { ProfileHeaderCard } from "@/modules/profile/profile-header-card";
import { LoadingState } from "@/modules/profile/feedback";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated, logout } = useRequireAuth();

  // Estado VISUAL das preferências (placeholder — sem persistência no backend).
  const [theme, setTheme] = useState<"claro" | "escuro">("claro");
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <LoadingState label="Carregando..." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground">
          Ajuste suas preferências e gerencie sua conta.
        </p>
      </header>

      <ProfileHeaderCard user={user} />

      {/* Preferências (toggles/seletores visuais — placeholder) */}
      <section className="space-y-3">
        <SectionHeader title="Preferências" as="h2" />
        <Card className="overflow-hidden p-2">
          <SettingsRowList>
            <SettingsRow
              icon={Palette}
              iconColor="blue"
              title="Tema do aplicativo"
              description="Escolha entre claro e escuro"
              onClick={() =>
                setTheme((t) => (t === "claro" ? "escuro" : "claro"))
              }
              trailing={
                <span className="flex items-center gap-1 text-sm font-medium text-primary">
                  {theme === "claro" ? "Claro" : "Escuro"}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              }
            />
            <SettingsRow
              icon={Shield}
              iconColor="green"
              title="Segurança"
              description="Senha, sessões e privacidade"
              href="/suporte"
            />
            <SettingsRow
              icon={Lock}
              iconColor="blue"
              title="Privacidade"
              description="Controle seus dados e permissões"
              href="/suporte"
            />
            <SettingsRow
              icon={Languages}
              iconColor="blue"
              title="Idioma"
              description="Idioma da interface"
              trailing={
                <span className="text-sm font-medium text-muted-foreground">
                  Português (Brasil)
                </span>
              }
            />
            <SettingsRow
              icon={Bell}
              iconColor="orange"
              title="Notificações push"
              description="Receba alertas de leads e mensagens"
              trailing={
                <ToggleSwitch
                  checked={notifications}
                  onCheckedChange={setNotifications}
                  label="Ativar notificações push"
                />
              }
            />
            <SettingsRow
              icon={Bell}
              iconColor="orange"
              title="Resumo por e-mail"
              description="Novidades e oportunidades por e-mail"
              trailing={
                <ToggleSwitch
                  checked={emailUpdates}
                  onCheckedChange={setEmailUpdates}
                  label="Ativar resumo por e-mail"
                />
              }
            />
          </SettingsRowList>
        </Card>
        <p className="px-1 text-xs text-muted-foreground">
          As preferências acima são ilustrativas e ainda não são salvas.
        </p>
      </section>

      {/* Conta */}
      <section className="space-y-3">
        <SectionHeader title="Conta" as="h2" />
        <Card className="overflow-hidden p-2">
          <SettingsRowList>
            <SettingsRow
              icon={UserCog}
              iconColor="blue"
              title="Editar perfil"
              description="Atualize seus dados"
              href="/profile"
            />
            <SettingsRow
              icon={LifeBuoy}
              iconColor="green"
              title="Ajuda e suporte"
              description="Central de ajuda e contato"
              href="/suporte"
            />
            <SettingsRow
              icon={LogOut}
              title="Sair"
              description="Desconectar do FazTudo"
              onClick={handleLogout}
              destructive
              hideChevron
            />
          </SettingsRowList>
        </Card>
      </section>

      <Card>
        <CardContent className="py-4 text-center text-xs text-muted-foreground">
          FazTudo · Versão 1.0.0
        </CardContent>
      </Card>
    </main>
  );
}
