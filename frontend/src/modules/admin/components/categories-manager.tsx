"use client";

/**
 * `CategoriesManager` — CRUD de categorias (admin).
 *
 * Lista todas as categorias (inclusive inativas, via `/categories/?active=false`),
 * permite criar/editar (nome + faixa/tier) e desativar (soft delete, com
 * confirmação). Reaproveita os endpoints existentes de categorias.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, PowerOff, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import type { Category, CategoryTier } from "@/types";

import {
  createCategory,
  deactivateCategory,
  fetchAllCategories,
  updateCategory,
} from "../api";
import type { CategoryInput } from "../types";
import { adminErrorMessage, TIER_LABEL } from "../utils";
import { ConfirmDialog } from "./confirm-dialog";

export const categoriesKey = ["admin", "categories", "all"] as const;

const TIERS: CategoryTier[] = ["simple", "medium", "premium"];

interface FormState {
  /** Categoria em edição; `null` = criando nova. */
  editing: Category | null;
  name: string;
  tier: CategoryTier;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  editing: null,
  name: "",
  tier: "medium",
  active: true,
};

export function CategoriesManager() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<Category | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: categoriesKey,
    queryFn: fetchAllCategories,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
  };

  const saveMutation = useMutation({
    mutationFn: (vars: { id?: string; input: CategoryInput }) =>
      vars.id
        ? updateCategory(vars.id, vars.input)
        : createCategory(vars.input),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateCategory(id),
    onSuccess: () => {
      invalidate();
      setToDeactivate(null);
    },
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    saveMutation.reset();
    setShowForm(true);
  }

  function openEdit(category: Category) {
    setForm({
      editing: category,
      name: category.name,
      tier: category.tier,
      active: category.active,
    });
    saveMutation.reset();
    setShowForm(true);
  }

  function closeForm() {
    if (saveMutation.isPending) return;
    setShowForm(false);
    setForm(EMPTY_FORM);
    saveMutation.reset();
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: CategoryInput = {
      name: form.name.trim(),
      tier: form.tier,
      active: form.active,
    };
    saveMutation.mutate({ id: form.editing?.id, input });
  }

  const categories = data ?? [];

  return (
    <div>
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" aria-hidden />
          Nova categoria
        </Button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Carregando categorias...</span>
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {adminErrorMessage(error, "Não foi possível carregar as categorias.")}
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="text-base font-medium">Nenhuma categoria cadastrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Faixa</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {category.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {category.slug}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{TIER_LABEL[category.tier]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {category.active ? (
                        <Badge variant="success">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(category)}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!category.active}
                          onClick={() => {
                            deactivateMutation.reset();
                            setToDeactivate(category);
                          }}
                        >
                          <PowerOff className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                          Desativar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulário (modal) */}
      {showForm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={form.editing ? "Editar categoria" : "Nova categoria"}
          onClick={saveMutation.isPending ? undefined : closeForm}
        >
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold leading-none tracking-tight">
                {form.editing ? "Editar categoria" : "Nova categoria"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                disabled={saveMutation.isPending}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Nome</Label>
                <Input
                  id="cat-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ex.: Eletricista"
                  minLength={2}
                  maxLength={80}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  O identificador (slug) é gerado automaticamente a partir do nome.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cat-tier">Faixa de custo</Label>
                <Select
                  id="cat-tier"
                  value={form.tier}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      tier: e.target.value as CategoryTier,
                    }))
                  }
                >
                  {TIERS.map((tier) => (
                    <SelectOption key={tier} value={tier}>
                      {TIER_LABEL[tier]}
                    </SelectOption>
                  ))}
                </Select>
              </div>

              {form.editing ? (
                <div className="flex items-center gap-2">
                  <input
                    id="cat-active"
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, active: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <Label htmlFor="cat-active" className="cursor-pointer">
                    Categoria ativa
                  </Label>
                </div>
              ) : null}
            </div>

            {saveMutation.isError ? (
              <p
                role="alert"
                className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {adminErrorMessage(
                  saveMutation.error,
                  "Não foi possível salvar a categoria."
                )}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                disabled={saveMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Confirmação de desativação */}
      <ConfirmDialog
        open={Boolean(toDeactivate)}
        title="Desativar categoria?"
        description={
          toDeactivate
            ? `A categoria "${toDeactivate.name}" deixará de aparecer para novos leads. Os vínculos existentes são preservados.`
            : undefined
        }
        confirmLabel="Sim, desativar"
        confirmVariant="destructive"
        loading={deactivateMutation.isPending}
        error={
          deactivateMutation.isError
            ? adminErrorMessage(
                deactivateMutation.error,
                "Não foi possível desativar a categoria."
              )
            : null
        }
        onConfirm={() =>
          toDeactivate && deactivateMutation.mutate(toDeactivate.id)
        }
        onCancel={() => {
          if (deactivateMutation.isPending) return;
          setToDeactivate(null);
          deactivateMutation.reset();
        }}
      />
    </div>
  );
}
