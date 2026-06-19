"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Category, LeadType, LeadUrgency } from "@/types";

import { LEAD_TYPE_OPTIONS, LEAD_URGENCY_OPTIONS } from "../constants";

/** Valores do formulário (string para campos controlados). */
export interface LeadFormValues {
  category_id: string;
  title: string;
  description: string;
  lead_type: LeadType;
  urgency: LeadUrgency;
  city: string;
  state: string;
  neighborhood: string;
}

export interface LeadFormProps {
  mode: "create" | "edit";
  /** Categorias para o select (modo create). */
  categories?: Category[];
  /** Valores iniciais (preenche no modo edit). */
  initialValues?: Partial<LeadFormValues>;
  submitting?: boolean;
  /** Mensagem de erro global (ex.: 422/403 da API). */
  error?: string | null;
  submitLabel: string;
  onSubmit: (values: LeadFormValues) => void;
  onCancel?: () => void;
}

const EMPTY: LeadFormValues = {
  category_id: "",
  title: "",
  description: "",
  lead_type: "one_time",
  urgency: "flexible",
  city: "",
  state: "",
  neighborhood: "",
};

export function LeadForm({
  mode,
  categories = [],
  initialValues,
  submitting = false,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: LeadFormProps) {
  const [values, setValues] = useState<LeadFormValues>({
    ...EMPTY,
    ...initialValues,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isEdit = mode === "edit";

  function setField<K extends keyof LeadFormValues>(
    key: K,
    value: LeadFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /** Validação client-side mínima dos obrigatórios. */
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!isEdit && !values.category_id) errs.category_id = "Selecione uma categoria.";
    if (!values.title.trim()) errs.title = "Informe um título.";
    if (!values.description.trim()) errs.description = "Descreva a solicitação.";
    if (!isEdit && !values.city.trim()) errs.city = "Informe a cidade.";
    if (!isEdit && !values.state.trim()) errs.state = "Informe o estado (UF).";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
      city: values.city.trim(),
      state: values.state.trim().toUpperCase(),
      neighborhood: values.neighborhood.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {!isEdit ? (
        <div className="space-y-1.5">
          <Label htmlFor="category_id">Categoria</Label>
          <Select
            id="category_id"
            value={values.category_id}
            onChange={(e) => setField("category_id", e.target.value)}
            aria-invalid={Boolean(fieldErrors.category_id)}
          >
            <SelectOption value="" disabled>
              Selecione uma categoria
            </SelectOption>
            {categories.map((c) => (
              <SelectOption key={c.id} value={c.id}>
                {c.name}
              </SelectOption>
            ))}
          </Select>
          {fieldErrors.category_id ? (
            <p className="text-xs text-destructive">{fieldErrors.category_id}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          value={values.title}
          onChange={(e) => setField("title", e.target.value)}
          placeholder="Ex.: Instalação de chuveiro elétrico"
          maxLength={200}
          aria-invalid={Boolean(fieldErrors.title)}
        />
        {fieldErrors.title ? (
          <p className="text-xs text-destructive">{fieldErrors.title}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Detalhe o que você precisa, prazos e observações."
          rows={5}
          aria-invalid={Boolean(fieldErrors.description)}
        />
        {fieldErrors.description ? (
          <p className="text-xs text-destructive">{fieldErrors.description}</p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {!isEdit ? (
          <div className="space-y-1.5">
            <Label htmlFor="lead_type">Tipo</Label>
            <Select
              id="lead_type"
              value={values.lead_type}
              onChange={(e) => setField("lead_type", e.target.value as LeadType)}
            >
              {LEAD_TYPE_OPTIONS.map((o) => (
                <SelectOption key={o.value} value={o.value}>
                  {o.label}
                </SelectOption>
              ))}
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="urgency">Urgência</Label>
          <Select
            id="urgency"
            value={values.urgency}
            onChange={(e) => setField("urgency", e.target.value as LeadUrgency)}
          >
            {LEAD_URGENCY_OPTIONS.map((o) => (
              <SelectOption key={o.value} value={o.value}>
                {o.label}
              </SelectOption>
            ))}
          </Select>
        </div>
      </div>

      {!isEdit ? (
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={values.city}
              onChange={(e) => setField("city", e.target.value)}
              placeholder="Ex.: Ariquemes"
              aria-invalid={Boolean(fieldErrors.city)}
            />
            {fieldErrors.city ? (
              <p className="text-xs text-destructive">{fieldErrors.city}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">Estado (UF)</Label>
            <Input
              id="state"
              value={values.state}
              onChange={(e) => setField("state", e.target.value)}
              placeholder="RO"
              maxLength={2}
              aria-invalid={Boolean(fieldErrors.state)}
            />
            {fieldErrors.state ? (
              <p className="text-xs text-destructive">{fieldErrors.state}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="neighborhood">Bairro (opcional)</Label>
        <Input
          id="neighborhood"
          value={values.neighborhood}
          onChange={(e) => setField("neighborhood", e.target.value)}
          placeholder="Ex.: Setor 01"
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : submitLabel}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
