"use client";

/**
 * Formulário de criação de uma nova solicitação (lead) do contratante.
 * Protegida para o papel `customer`. Carrega categorias públicas para a
 * seleção e, ao criar com sucesso, redireciona para `/leads`.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { AppHeader } from "@/components/app-shell/app-header";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import type { Category } from "@/types";

import {
  createLead,
  describeApiError,
  fetchCategories,
  LeadForm,
  type LeadFormValues,
} from "@/modules/leads";

export default function NewLeadPage() {
  const auth = useRequireAuth("customer");
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isCustomer) return;

    let active = true;
    (async () => {
      setLoadingCategories(true);
      setCategoriesError(null);
      try {
        const data = await fetchCategories();
        // Mostra apenas categorias ativas quando o flag existir.
        const usable = data.filter((c) => c.active !== false);
        if (active) setCategories(usable);
      } catch (err) {
        if (active) {
          setCategoriesError(
            describeApiError(err, "Não foi possível carregar as categorias.")
          );
        }
      } finally {
        if (active) setLoadingCategories(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [auth.hasHydrated, auth.isAuthenticated, auth.isCustomer]);

  function reloadCategories() {
    // Re-dispara o efeito alternando o estado de loading (simples retry).
    setCategoriesError(null);
    setLoadingCategories(true);
    fetchCategories()
      .then((data) => setCategories(data.filter((c) => c.active !== false)))
      .catch((err) =>
        setCategoriesError(
          describeApiError(err, "Não foi possível carregar as categorias.")
        )
      )
      .finally(() => setLoadingCategories(false));
  }

  async function handleSubmit(values: LeadFormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createLead({
        category_id: values.category_id,
        title: values.title,
        description: values.description,
        lead_type: values.lead_type,
        urgency: values.urgency,
        city: values.city,
        state: values.state,
        neighborhood: values.neighborhood || undefined,
      });
      router.push("/leads");
    } catch (err) {
      setSubmitError(
        describeApiError(err, "Não foi possível criar a solicitação.")
      );
      setSubmitting(false);
    }
  }

  if (!auth.hasHydrated) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <>
      <AppHeader
        mode="title"
        title="Nova solicitação"
        backHref="/leads"
        className="lg:hidden"
      />

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Voltar (desktop). */}
        <Link
          href="/leads"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-4 hidden gap-1.5 px-2 lg:inline-flex"
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Nova solicitação</CardTitle>
            <CardDescription>
              Descreva o serviço que você precisa para receber propostas de
              profissionais.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCategories ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-[88px] animate-pulse rounded-xl border bg-muted/40"
                    />
                  ))}
                </div>
                <div className="h-10 animate-pulse rounded-md bg-muted/40" />
                <div className="h-28 animate-pulse rounded-md bg-muted/40" />
              </div>
            ) : categoriesError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-4 text-center text-sm text-destructive">
                <p>{categoriesError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={reloadCategories}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <LeadForm
                mode="create"
                categories={categories}
                submitting={submitting}
                error={submitError}
                submitLabel="Criar solicitação"
                onSubmit={handleSubmit}
                onCancel={() => router.push("/leads")}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
