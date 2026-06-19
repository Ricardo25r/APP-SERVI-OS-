"use client";

/**
 * Detalhe de uma solicitação (lead) do contratante, com edição inline
 * dos campos permitidos (título, descrição, urgência, bairro) enquanto
 * a solicitação está aberta. Protegida para o papel `customer`.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Coins, MapPin, Pencil } from "lucide-react";

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
import type { Lead } from "@/types";

import {
  describeApiError,
  fetchLead,
  LeadForm,
  LeadStatusBadge,
  leadTypeLabel,
  leadUrgencyLabel,
  updateLead,
  type LeadFormValues,
} from "@/modules/leads";

export default function LeadDetailPage() {
  const auth = useRequireAuth("customer");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLead(id);
      setLead(data);
    } catch (err) {
      setError(
        describeApiError(err, "Não foi possível carregar a solicitação.")
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isCustomer) return;
    void load();
  }, [auth.hasHydrated, auth.isAuthenticated, auth.isCustomer, load]);

  async function handleSave(values: LeadFormValues) {
    if (!lead) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateLead(lead.id, {
        title: values.title,
        description: values.description,
        urgency: values.urgency,
        neighborhood: values.neighborhood ? values.neighborhood : null,
      });
      setLead(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(
        describeApiError(err, "Não foi possível salvar as alterações.")
      );
    } finally {
      setSaving(false);
    }
  }

  if (!auth.hasHydrated) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const isOpen = lead?.status === "open";

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

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg border bg-muted/40" />
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void load()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : !lead ? null : editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar solicitação</CardTitle>
            <CardDescription>
              Você pode ajustar título, descrição, urgência e bairro enquanto a
              solicitação está aberta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeadForm
              mode="edit"
              initialValues={{
                title: lead.title,
                description: lead.description,
                urgency: lead.urgency,
                neighborhood: lead.neighborhood ?? "",
              }}
              submitting={saving}
              error={saveError}
              submitLabel="Salvar alterações"
              onSubmit={handleSave}
              onCancel={() => {
                setEditing(false);
                setSaveError(null);
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle>{lead.title}</CardTitle>
              <LeadStatusBadge status={lead.status} />
            </div>
            <CardDescription>
              {lead.category?.name ?? "Sem categoria"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="whitespace-pre-wrap text-sm">{lead.description}</p>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" aria-hidden />
                {lead.city}
                {lead.state ? `/${lead.state}` : ""}
                {lead.neighborhood ? ` — ${lead.neighborhood}` : ""}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Coins className="h-4 w-4" aria-hidden />
                {lead.credits_cost}{" "}
                {lead.credits_cost === 1 ? "crédito" : "créditos"}
              </div>
              <div className="text-muted-foreground">
                Tipo:{" "}
                <span className="font-medium text-foreground">
                  {leadTypeLabel(lead.lead_type)}
                </span>
              </div>
              <div className="text-muted-foreground">
                Urgência:{" "}
                <span className="font-medium text-foreground">
                  {leadUrgencyLabel(lead.urgency)}
                </span>
              </div>
            </div>

            {isOpen ? (
              <div className="pt-2">
                <Button className="gap-1.5" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  Editar
                </Button>
              </div>
            ) : (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Esta solicitação não está mais aberta e não pode ser editada.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
