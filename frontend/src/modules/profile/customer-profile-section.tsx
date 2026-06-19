/**
 * Seção de perfil do **cliente** (customer).
 *
 * - `GET /users/me/customer-profile` para carregar.
 * - Se 404 → o cliente ainda não tem perfil: mostra formulário de criação
 *   (`POST` city/state).
 * - Se existe → mostra/edita (`PATCH` city/state).
 *
 * Campos do contrato: apenas `city` e `state` (ambos opcionais no backend).
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import type { CustomerProfile } from "@/types";

import { BRAZIL_STATES } from "./constants";
import {
  ErrorBanner,
  LoadingState,
  SuccessBanner,
  errorMessage,
} from "./feedback";

const CUSTOMER_PROFILE_KEY = ["customer-profile"] as const;

/** Payload de criação/edição (campos do contrato). */
interface CustomerProfileForm {
  city: string;
  state: string;
}

/** Normaliza valores vazios para `undefined` (não envia strings vazias). */
function toPayload(form: CustomerProfileForm) {
  return {
    city: form.city.trim() ? form.city.trim() : undefined,
    state: form.state ? form.state : undefined,
  };
}

export function CustomerProfileSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomerProfileForm>({ city: "", state: "" });
  const [saved, setSaved] = useState(false);

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useQuery<CustomerProfile | null>({
    queryKey: CUSTOMER_PROFILE_KEY,
    queryFn: async () => {
      try {
        return await apiGet<CustomerProfile>("/users/me/customer-profile");
      } catch (err) {
        // 404 → perfil ainda não criado: tratamos como "null", não como erro.
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });

  // Hidrata o formulário quando o perfil chega (ou muda).
  useEffect(() => {
    if (profile) {
      setForm({ city: profile.city ?? "", state: profile.state ?? "" });
    }
  }, [profile]);

  const exists = Boolean(profile);

  const mutation = useMutation({
    mutationFn: async (values: CustomerProfileForm) => {
      const payload = toPayload(values);
      return exists
        ? apiPatch<CustomerProfile>("/users/me/customer-profile", payload)
        : apiPost<CustomerProfile>("/users/me/customer-profile", payload);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(CUSTOMER_PROFILE_KEY, data);
      setSaved(true);
    },
  });

  const isDirty = useMemo(() => {
    if (!profile) return Boolean(form.city.trim() || form.state);
    return (
      (profile.city ?? "") !== form.city || (profile.state ?? "") !== form.state
    );
  }, [profile, form]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    mutation.mutate(form);
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingState label="Carregando seu perfil..." />
        </CardContent>
      </Card>
    );
  }

  // Erro real (não-404) ao carregar.
  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meu perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBanner
            message={errorMessage(
              error,
              "Não foi possível carregar seu perfil."
            )}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meus dados</CardTitle>
        <CardDescription>
          {exists
            ? "Atualize sua localização para receber prestadores próximos."
            : "Complete seu perfil informando sua localização."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="customer-city">Cidade</Label>
              <Input
                id="customer-city"
                placeholder="Ex.: Ariquemes"
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
                disabled={mutation.isPending}
                autoComplete="address-level2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-state">Estado (UF)</Label>
              <Select
                id="customer-state"
                className="sm:w-28"
                value={form.state}
                onChange={(e) =>
                  setForm((f) => ({ ...f, state: e.target.value }))
                }
                disabled={mutation.isPending}
              >
                <SelectOption value="">—</SelectOption>
                {BRAZIL_STATES.map((uf) => (
                  <SelectOption key={uf} value={uf}>
                    {uf}
                  </SelectOption>
                ))}
              </Select>
            </div>
          </div>

          {mutation.isError && (
            <ErrorBanner
              message={errorMessage(
                mutation.error,
                "Não foi possível salvar. Tente novamente."
              )}
            />
          )}
          {saved && !mutation.isPending && (
            <SuccessBanner message="Perfil salvo com sucesso." />
          )}

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={mutation.isPending || (exists && !isDirty)}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              )}
              {exists ? "Salvar alterações" : "Criar perfil"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
