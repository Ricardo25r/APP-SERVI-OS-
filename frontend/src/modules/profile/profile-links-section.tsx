/**
 * `ProfileLinksSection` — atalhos do perfil para **Configurações** e **Suporte**
 * (e logout), no estilo de lista dos mockups (Tela 16/21). Apenas visual.
 */
"use client";

import { useRouter } from "next/navigation";
import { Settings, LifeBuoy, LogOut } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SettingsRow, SettingsRowList } from "@/components/ui/settings-row";
import { useAuth } from "@/hooks/use-auth";

export function ProfileLinksSection() {
  const router = useRouter();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <Card className="overflow-hidden p-2">
      <SettingsRowList>
        <SettingsRow
          icon={Settings}
          iconColor="blue"
          title="Configurações"
          description="Preferências e conta"
          href="/configuracoes"
        />
        <SettingsRow
          icon={LifeBuoy}
          iconColor="green"
          title="Suporte"
          description="Central de ajuda e contato"
          href="/suporte"
        />
        <SettingsRow
          icon={LogOut}
          title="Sair"
          description="Encerrar a sessão"
          onClick={handleLogout}
          destructive
          hideChevron
        />
      </SettingsRowList>
    </Card>
  );
}
