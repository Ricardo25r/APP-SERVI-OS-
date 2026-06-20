"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/ui/icon-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Category, LeadType, LeadUrgency } from "@/types";

import { categoryVisual } from "../category-icon";
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
  /** Categorias para a seleção (modo create). */
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

/** Unidades federativas (siglas) para o seletor de estado. */
const BR_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

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
  const [cities, setCities] = useState<string[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const isEdit = mode === "edit";

  function setField<K extends keyof LeadFormValues>(
    key: K,
    value: LeadFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  }

  // Municípios do estado selecionado (lista suspensa de cidade — API do IBGE).
  useEffect(() => {
    const uf = values.state;
    if (!uf || uf.length !== 2) {
      setCities([]);
      return;
    }
    let active = true;
    fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { nome: string }[]) => {
        if (active) setCities(data.map((m) => m.nome));
      })
      .catch(() => {
        if (active) setCities([]);
      });
    return () => {
      active = false;
    };
  }, [values.state]);

  // Detecta a localização do usuário e pré-preenche cidade/UF.
  function detectLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoMsg("Geolocalização não suportada neste dispositivo.");
      return;
    }
    setGeoLoading(true);
    setGeoMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`
          );
          const d = await res.json();
          const uf =
            String(d.principalSubdivisionCode || "").split("-")[1] || "";
          const city = d.city || d.locality || "";
          setValues((prev) => ({
            ...prev,
            state: uf || prev.state,
            city: city || prev.city,
          }));
          setFieldErrors((prev) => ({ ...prev, city: "", state: "" }));
          setGeoMsg(
            uf || city
              ? `Local detectado: ${city}${uf ? `/${uf}` : ""}`
              : "Não foi possível detectar sua cidade."
          );
        } catch {
          setGeoMsg("Não foi possível detectar a localização.");
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setGeoLoading(false);
        setGeoMsg("Não foi possível obter sua localização (permissão negada).");
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }

  // Pré-preenche pela localização ao abrir (criação, com campos vazios).
  useEffect(() => {
    if (isEdit) return;
    if (initialValues?.city || initialValues?.state) return;
    detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {/* Categoria via grid de IconChips (somente na criação). */}
      {!isEdit ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium leading-none">
            Categoria
          </legend>
          <div
            role="radiogroup"
            aria-label="Categoria"
            aria-invalid={Boolean(fieldErrors.category_id)}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {categories.map((c) => {
              const visual = categoryVisual({ slug: c.slug, name: c.name });
              const selected = values.category_id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setField("category_id", c.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center transition-colors",
                    "hover:border-primary/40 hover:bg-primary/5",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border"
                  )}
                >
                  {selected ? (
                    <span className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                  ) : null}
                  <IconChip icon={visual.icon} color={visual.color} size="md" />
                  <span className="line-clamp-2 text-xs font-medium leading-tight text-foreground">
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>
          {fieldErrors.category_id ? (
            <p className="text-xs text-destructive">{fieldErrors.category_id}</p>
          ) : null}
        </fieldset>
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
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium leading-none">Localização</span>
            <button
              type="button"
              onClick={detectLocation}
              disabled={geoLoading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary disabled:opacity-60"
            >
              {geoLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <MapPin className="h-3.5 w-3.5" aria-hidden />
              )}
              {geoLoading ? "Detectando..." : "Usar minha localização"}
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="state">Estado (UF)</Label>
              <Select
                id="state"
                value={values.state}
                onChange={(e) => {
                  setField("state", e.target.value);
                  setField("city", "");
                }}
                aria-invalid={Boolean(fieldErrors.state)}
              >
                <SelectOption value="">UF</SelectOption>
                {BR_UFS.map((uf) => (
                  <SelectOption key={uf} value={uf}>
                    {uf}
                  </SelectOption>
                ))}
              </Select>
              {fieldErrors.state ? (
                <p className="text-xs text-destructive">{fieldErrors.state}</p>
              ) : null}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                list="cidades-list"
                value={values.city}
                onChange={(e) => setField("city", e.target.value)}
                placeholder={
                  values.state
                    ? "Selecione ou digite a cidade"
                    : "Escolha o estado primeiro"
                }
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.city)}
              />
              <datalist id="cidades-list">
                {cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {fieldErrors.city ? (
                <p className="text-xs text-destructive">{fieldErrors.city}</p>
              ) : null}
            </div>
          </div>

          {geoMsg ? (
            <p className="text-xs text-muted-foreground">{geoMsg}</p>
          ) : null}
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
        <Button
          type="submit"
          disabled={submitting}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
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
