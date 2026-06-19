"use client";

/**
 * Formulário de criação de uma nova solicitação (lead) do contratante.
 * Protegida para o papel `customer`. Carrega categorias públicas para o
 * select e, ao criar com sucesso, redireciona para `/leads`.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
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
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/leads"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-4 gap-1.5 px-2"
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Nova solicitação</CardTitle>
          <CardDescription>
            Descreva o serviço que você precisa para receber propostas de
            profissionais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCategories ? (
            <p className="text-sm text-muted-foreground">
              Carregando categorias...
            </p>
          ) : categoriesError ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {categoriesError}
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
  );
}
