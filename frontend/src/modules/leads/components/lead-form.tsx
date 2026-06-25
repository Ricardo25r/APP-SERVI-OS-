"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, ImagePlus, Loader2, MapPin, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/ui/icon-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Category, LeadType, LeadUrgency } from "@/types";

import { categoryImage, categoryVisual } from "../category-icon";
import {
  BUDGET_RANGE_OPTIONS,
  LEAD_TYPE_OPTIONS,
  LEAD_URGENCY_OPTIONS,
} from "../constants";

/** Valores do formulário (string para campos controlados). */
export interface LeadFormValues {
  category_id: string;
  title: string;
  description: string;
  lead_type: LeadType;
  urgency: LeadUrgency;
  budget_range: string;
  city: string;
  state: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  /** Fotos novas selecionadas (enviadas após criar o lead). */
  photos: File[];
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
  budget_range: "",
  city: "",
  state: "",
  neighborhood: "",
  latitude: null,
  longitude: null,
  photos: [],
};

/** Grupo de chips selecionáveis (1 valor). `allowClear` permite desmarcar. */
function ChoiceChips({
  options,
  value,
  onChange,
  allowClear = false,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(allowClear && selected ? "" : o.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

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
  const [cityOpen, setCityOpen] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const cityBoxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  // Detecta a localização do usuário e pré-preenche cidade/UF + coordenadas.
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
            latitude,
            longitude,
          }));
          setFieldErrors((prev) => ({ ...prev, city: "", state: "" }));
          setGeoMsg(
            uf || city
              ? `Local detectado: ${city}${uf ? `/${uf}` : ""}`
              : "Localização detectada."
          );
        } catch {
          // Mesmo sem reverse-geocode, guardamos as coordenadas (mapa/distância).
          setValues((prev) => ({
            ...prev,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }));
          setGeoMsg("Localização detectada (cidade não identificada).");
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

  // Fecha a lista de cidades ao clicar fora.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (cityBoxRef.current && !cityBoxRef.current.contains(e.target as Node)) {
        setCityOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Revoga as URLs de preview ao desmontar (evita vazamento de memória).
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;
    setValues((prev) => ({ ...prev, photos: [...prev.photos, ...files] }));
    setPreviews((prev) => [
      ...prev,
      ...files.map((f) => URL.createObjectURL(f)),
    ]);
    // Permite re-selecionar o mesmo arquivo depois.
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
    setValues((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  }

  const cityQuery = values.city.trim().toLowerCase();
  const cityExact = cities.some((c) => c.toLowerCase() === cityQuery);
  const cityOptions =
    !cityQuery || cityExact
      ? cities
      : cities.filter((c) => c.toLowerCase().includes(cityQuery));

  /** Validação client-side mínima dos obrigatórios. */
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!isEdit && !values.category_id) errs.category_id = "Selecione uma categoria.";
    if (values.title.trim().length < 4)
      errs.title = "Informe um título claro (ex.: Pintura de 2 quartos).";
    if (values.description.trim().length < 20)
      errs.description =
        "Conte com mais detalhes (o que precisa, onde e quando) — pedidos completos recebem muito mais respostas.";
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

  const hasCoords = values.latitude != null && values.longitude != null;
  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${
        (values.longitude as number) - 0.012
      }%2C${(values.latitude as number) - 0.008}%2C${
        (values.longitude as number) + 0.012
      }%2C${(values.latitude as number) + 0.008}&layer=mapnik&marker=${
        values.latitude
      }%2C${values.longitude}`
    : null;

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

      {/* Categoria via grid (somente na criação). */}
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
              const img = c.image_url ?? categoryImage(c.slug);
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
                  {img ? (
                    <Image
                      src={img}
                      width={96}
                      height={96}
                      alt=""
                      aria-hidden
                      className="h-12 w-12 rounded-xl object-cover object-top"
                    />
                  ) : (
                    <IconChip icon={visual.icon} color={visual.color} size="md" />
                  )}
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
          placeholder="Ex.: Pintar 2 quartos (~30 m²), paredes brancas, já tenho a tinta. Para a próxima semana, no bairro Setor 01."
          rows={5}
          aria-invalid={Boolean(fieldErrors.description)}
        />
        {fieldErrors.description ? (
          <p className="text-xs text-destructive">{fieldErrors.description}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Quanto mais detalhe (medidas, local e prazo), mais profissionais
            respondem ao seu pedido.
          </p>
        )}
      </div>

      {/* Tipo de serviço (chips) — só na criação (afeta o custo). */}
      {!isEdit ? (
        <div className="space-y-2">
          <span className="text-sm font-medium leading-none">
            Tipo de serviço
          </span>
          <ChoiceChips
            options={LEAD_TYPE_OPTIONS}
            value={values.lead_type}
            onChange={(v) => setField("lead_type", v as LeadType)}
          />
        </div>
      ) : null}

      {/* Urgência (chips). */}
      <div className="space-y-2">
        <span className="text-sm font-medium leading-none">Urgência</span>
        <ChoiceChips
          options={LEAD_URGENCY_OPTIONS}
          value={values.urgency}
          onChange={(v) => setField("urgency", v as LeadUrgency)}
        />
      </div>

      {/* Orçamento (faixas, chips) — opcional. */}
      <div className="space-y-2">
        <span className="text-sm font-medium leading-none">
          Orçamento{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </span>
        <ChoiceChips
          options={BUDGET_RANGE_OPTIONS}
          value={values.budget_range}
          onChange={(v) => setField("budget_range", v)}
          allowClear
        />
      </div>

      {/* Localização + mapa (somente na criação). */}
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
              <div ref={cityBoxRef} className="relative">
                <Input
                  id="city"
                  value={values.city}
                  onChange={(e) => {
                    setField("city", e.target.value);
                    setCityOpen(true);
                  }}
                  onFocus={() => setCityOpen(true)}
                  onClick={() => setCityOpen(true)}
                  placeholder={
                    values.state
                      ? "Selecione ou digite a cidade"
                      : "Escolha o estado primeiro"
                  }
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={cityOpen}
                  aria-invalid={Boolean(fieldErrors.city)}
                />
                {cityOpen && cityOptions.length > 0 ? (
                  <ul
                    role="listbox"
                    className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg"
                  >
                    {cityOptions.map((c) => (
                      <li key={c}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setField("city", c);
                            setCityOpen(false);
                          }}
                          className="flex w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-primary/5"
                        >
                          {c}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {fieldErrors.city ? (
                <p className="text-xs text-destructive">{fieldErrors.city}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="neighborhood">Bairro (opcional)</Label>
            <Input
              id="neighborhood"
              value={values.neighborhood}
              onChange={(e) => setField("neighborhood", e.target.value)}
              placeholder="Ex.: Setor 01"
            />
          </div>

          {mapSrc ? (
            <div className="overflow-hidden rounded-xl border">
              <iframe
                title="Mapa do local do serviço"
                src={mapSrc}
                loading="lazy"
                className="h-44 w-full border-0"
              />
            </div>
          ) : null}

          {geoMsg ? (
            <p className="text-xs text-muted-foreground">{geoMsg}</p>
          ) : null}
        </div>
      ) : null}

      {/* Fotos (somente na criação). */}
      {!isEdit ? (
        <div className="space-y-2">
          <span className="text-sm font-medium leading-none">
            Fotos{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPickFiles}
          />
          <div className="flex flex-wrap gap-2">
            {previews.map((url, i) => (
              <div
                key={url}
                className="relative h-20 w-20 overflow-hidden rounded-xl border bg-muted"
              >
                <Image
                  src={url}
                  alt={`Foto ${i + 1}`}
                  width={80}
                  height={80}
                  unoptimized
                  className="h-20 w-20 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label="Remover foto"
                  className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground/70 text-background transition-colors hover:bg-foreground"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <ImagePlus className="h-5 w-5" aria-hidden />
              <span className="text-[10px] font-medium">Adicionar</span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tire uma foto ou anexe da galeria (JPG/PNG/WEBP, até 5 MB cada).
          </p>
        </div>
      ) : null}

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
