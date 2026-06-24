"use client";

/**
 * `AccountModeCard` — papel duplo no perfil.
 *
 * - Mostra o **modo ativo** (Contratante/Profissional).
 * - Se o usuário já tem o outro papel → botão **Trocar para X** (switch-role +
 *   reload na home do modo).
 * - Se ainda não tem → botão **Ativar conta de X**: cria o outro perfil
 *   (reaproveitando cidade/estado de um perfil existente) e atualiza
 *   `available_roles`. Depois disso, o botão vira "Trocar".
 *
 * Não aparece para admin.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, Loader2, Repeat, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { apiGet, apiPost } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { homePathForRole, toSession } from "@/modules/auth";
import type { AuthResponse, User } from "@/types";

type Mode = "customer" | "professional";

const LABEL: Record<Mode, string> = {
  customer: "Contratante",
  professional: "Profissional",
};
const ICON: Record<Mode, typeof Briefcase> = {
  customer: UserRound,
  professional: Briefcase,
};

interface LocatedProfile {
  city?: string | null;
  state?: string | null;
}

export function AccountModeCard() {
  const { user } = useAuth();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"switch" | "activate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.role === "admin") return null;

  const active = (user.active_role ?? user.role) as Mode;
  const other: Mode = active === "customer" ? "professional" : "customer";
  const hasOther = (user.available_roles ?? []).includes(other);
  const OtherIcon = ICON[other];

  async function switchTo(target: Mode) {
    setBusy("switch");
    setError(null);
    try {
      const resp = await apiPost<AuthResponse>("/auth/switch-role", {
        active_role: target,
      });
      setAuth(toSession(resp));
      window.location.assign(homePathForRole(target));
    } catch {
      setError("Não foi possível trocar agora. Tente de novo.");
      setBusy(null);
    }
  }

  async function activate(target: Mode) {
    setBusy("activate");
    setError(null);
    try {
      // Reaproveita cidade/estado de qualquer perfil já existente.
      let city = "";
      let state = "";
      for (const path of [
        "/users/me/customer-profile",
        "/users/me/professional-profile",
      ]) {
        try {
          const p = await apiGet<LocatedProfile>(path);
          if (p?.city && p?.state) {
            city = p.city;
            state = p.state;
            break;
          }
        } catch {
          /* 404: perfil não existe ainda */
        }
      }
      if (!city || !state) {
        setError(
          "Defina sua cidade e estado no seu perfil antes de ativar o outro tipo de conta."
        );
        setBusy(null);
        return;
      }
      const endpoint =
        target === "professional"
          ? "/users/me/professional-profile"
          : "/users/me/customer-profile";
      await apiPost(endpoint, { city, state });
      const me = await apiGet<User>("/auth/me");
      setUser(me);
      queryClient.invalidateQueries();
      setBusy(null);
    } catch {
      setError("Não foi possível ativar agora. Tente de novo.");
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipo de conta</CardTitle>
        <CardDescription>
          Você está usando o FazTudo como{" "}
          <strong className="text-foreground">{LABEL[active]}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasOther ? (
          <>
            <p className="text-sm text-muted-foreground">
              Sua conta também funciona como {LABEL[other]}. Troque quando quiser
              — sem precisar sair.
            </p>
            <Button
              type="button"
              onClick={() => void switchTo(other)}
              disabled={busy !== null}
              className="w-full sm:w-auto"
            >
              {busy === "switch" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Repeat className="mr-2 h-4 w-4" aria-hidden />
              )}
              Trocar para {LABEL[other]}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Quer também {other === "professional"
                ? "oferecer seus serviços"
                : "contratar serviços"}
              ? Ative a conta de {LABEL[other]} — usa a mesma conta e login.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void activate(other)}
              disabled={busy !== null}
              className="w-full sm:w-auto"
            >
              {busy === "activate" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <OtherIcon className="mr-2 h-4 w-4" aria-hidden />
              )}
              Ativar conta de {LABEL[other]}
            </Button>
          </>
        )}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
