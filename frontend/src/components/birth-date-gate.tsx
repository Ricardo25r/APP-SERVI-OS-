"use client";

/**
 * `BirthDateGate` — coleta obrigatória da data de nascimento do PRESTADOR.
 *
 * Para o profissional autenticado que ainda não informou a data de nascimento
 * (`user.birth_date === null`) — caso de quem já tinha conta antes do campo
 * existir ou entrou por login social (Google/Apple) — exibe um modal pedindo a
 * data. Não se aplica a contratantes. Reaparece até ser preenchida.
 *
 * Sessões antigas (store sem o campo) são atualizadas via `GET /auth/me` no
 * mount, para o gate aparecer no próximo acesso.
 */

import { useEffect, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { apiGet, apiPost } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import type { User } from "@/types";

/** Idade em anos a partir de uma data ISO 'YYYY-MM-DD' (null se inválida). */
function ageFromISO(iso: string): number | null {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const m = today.getMonth() - parsed.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < parsed.getDate())) age -= 1;
  return age;
}

export function BirthDateGate() {
  const { user, isAuthenticated, hasHydrated } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sessão antiga sem o campo → atualiza uma vez para conhecer o status.
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !user) return;
    if (user.role !== "professional") return;
    if (user.birth_date !== undefined) return;
    let active = true;
    void apiGet<User>("/auth/me")
      .then((fresh) => {
        if (active) setUser(fresh);
      })
      .catch(() => {
        /* offline/erro: tenta de novo no próximo acesso */
      });
    return () => {
      active = false;
    };
  }, [hasHydrated, isAuthenticated, user, setUser]);

  const needs =
    hasHydrated &&
    isAuthenticated &&
    user != null &&
    user.role === "professional" &&
    user.birth_date === null;

  if (!needs) return null;

  async function submit() {
    const age = ageFromISO(value);
    if (!value || age === null || age > 110) {
      setError("Informe uma data de nascimento válida.");
      return;
    }
    if (age < 18) {
      setError("É necessário ter pelo menos 18 anos.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiPost<User>("/auth/birth-date", {
        birth_date: value,
      });
      setUser(updated);
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
      setSubmitting(false);
    }
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Data de nascimento"
    >
      <div className="w-full max-w-lg rounded-t-2xl border bg-card p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Confirme sua data de nascimento
          </h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Para concluir seu perfil de profissional, informe sua data de
          nascimento. Usamos apenas para confirmar que você é maior de 18 anos.
        </p>

        <div className="mt-4 space-y-2">
          <Label htmlFor="gate-birth-date">Data de nascimento</Label>
          <Input
            id="gate-birth-date"
            type="date"
            max={todayISO}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <Button
            onClick={() => void submit()}
            disabled={submitting}
            size="lg"
            className="w-full"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Salvar
          </Button>
          <button
            type="button"
            onClick={() => logout()}
            disabled={submitting}
            className="py-1 text-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
