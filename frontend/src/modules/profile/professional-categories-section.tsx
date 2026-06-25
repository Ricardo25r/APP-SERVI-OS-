/**
 * Seção de **categorias do profissional**.
 *
 * - `GET /categories/` (público) → lista de categorias disponíveis.
 * - `GET /users/me/professional-profile/categories` → categorias atuais.
 * - `PUT /users/me/professional-profile/categories` body `{ category_ids }`.
 *
 * Multi-seleção via chips clicáveis (Badge). Só habilita salvar quando há
 * alteração em relação ao conjunto atual.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ApiError, apiGet, apiPut } from "@/services/api";
import type { Category } from "@/types";

import { categoryImage } from "@/modules/leads/category-icon";

import {
  ErrorBanner,
  LoadingState,
  SuccessBanner,
  errorMessage,
} from "./feedback";

const ALL_CATEGORIES_KEY = ["categories", "all"] as const;
const MY_CATEGORIES_KEY = ["professional-profile", "categories"] as const;

/** Ordem de exibição dos grupos no acordeão; demais vêm depois, "Outros" por último. */
const GROUP_ORDER = [
  "Reformas e Construção",
  "Casa e Manutenção",
  "Limpeza",
  "Cuidados e Pets",
  "Tecnologia e Segurança",
  "Transporte e Entregas",
];
const OUTROS = "Outros";

export function ProfessionalCategoriesSection() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  function toggleGroup(group: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  // Catálogo público de categorias (aceita lista crua ou envelope {items}).
  const allCategories = useQuery<Category[]>({
    queryKey: ALL_CATEGORIES_KEY,
    queryFn: async () => {
      const data = await apiGet<Category[] | { items: Category[] }>(
        "/categories/"
      );
      return Array.isArray(data) ? data : data.items ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Categorias do profissional — o backend devolve { categories: [...] }.
  const myCategories = useQuery<Category[]>({
    queryKey: MY_CATEGORIES_KEY,
    queryFn: async () => {
      const data = await apiGet<{ categories: Category[] }>(
        "/users/me/professional-profile/categories"
      );
      return data.categories ?? [];
    },
    // 404 = perfil ainda não criado; não adianta repetir.
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  // Hidrata a seleção quando as categorias atuais chegam.
  useEffect(() => {
    if (myCategories.data) {
      setSelected(new Set(myCategories.data.map((c) => c.id)));
    }
  }, [myCategories.data]);

  const mutation = useMutation({
    mutationFn: async (categoryIds: string[]) => {
      const data = await apiPut<{ categories: Category[] }>(
        "/users/me/professional-profile/categories",
        { category_ids: categoryIds }
      );
      return data.categories ?? [];
    },
    onSuccess: (data) => {
      queryClient.setQueryData(MY_CATEGORIES_KEY, data);
      setSaved(true);
    },
  });

  const currentIds = useMemo(
    () => new Set((myCategories.data ?? []).map((c) => c.id)),
    [myCategories.data]
  );

  const isDirty = useMemo(() => {
    if (selected.size !== currentIds.size) return true;
    for (const id of selected) if (!currentIds.has(id)) return true;
    return false;
  }, [selected, currentIds]);

  // Agrupa as categorias visíveis por `group` (fallback "Outros") e ordena.
  const grouped = useMemo(() => {
    const cats = (allCategories.data ?? []).filter(
      (c) => c.active || selected.has(c.id)
    );
    const map = new Map<string, Category[]>();
    for (const c of cats) {
      const g = c.group?.trim() || OUTROS;
      const arr = map.get(g);
      if (arr) arr.push(c);
      else map.set(g, [c]);
    }
    const rank = (g: string) => {
      const i = GROUP_ORDER.indexOf(g);
      if (i !== -1) return i;
      return g === OUTROS ? 999 : 500;
    };
    return Array.from(map.entries())
      .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
      .map(
        ([g, items]) =>
          [g, items.sort((x, y) => x.name.localeCompare(y.name))] as const
      );
  }, [allCategories.data, selected]);

  // Na carga inicial, abre os grupos que já têm categorias selecionadas.
  useEffect(() => {
    if (!allCategories.data || !myCategories.data) return;
    const sel = new Set(myCategories.data.map((c) => c.id));
    const withSel = new Set<string>();
    for (const c of allCategories.data) {
      if (sel.has(c.id)) withSel.add(c.group?.trim() || OUTROS);
    }
    setOpenGroups((prev) => (prev.size === 0 ? withSel : prev));
  }, [allCategories.data, myCategories.data]);

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    setSaved(false);
    mutation.mutate(Array.from(selected));
  }

  const isLoading = allCategories.isLoading || myCategories.isLoading;
  const loadError = allCategories.error ?? myCategories.error;
  // 404 nas categorias do profissional = perfil ainda não foi criado.
  const noProfile =
    myCategories.isError &&
    myCategories.error instanceof ApiError &&
    myCategories.error.status === 404;

  return (
    <Card data-tour="profile-categories">
      <CardHeader>
        <CardTitle>Categorias de atuação</CardTitle>
        <CardDescription>
          Selecione os serviços que você oferece. Você receberá leads dessas
          categorias.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <LoadingState label="Carregando categorias..." />}

        {!isLoading && noProfile && (
          <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
            Primeiro crie seu perfil acima (localização e disponibilidade).
            Depois você escolhe aqui as categorias de atuação.
          </p>
        )}

        {!isLoading && !noProfile && (allCategories.isError || myCategories.isError) && (
          <ErrorBanner
            message={errorMessage(
              loadError,
              "Não foi possível carregar as categorias."
            )}
          />
        )}

        {!isLoading &&
          !noProfile &&
          !allCategories.isError &&
          !myCategories.isError &&
          (allCategories.data?.length ? (
            <>
              <div className="space-y-2">
                {grouped.map(([group, items]) => {
                  const selCount = items.filter((c) =>
                    selected.has(c.id)
                  ).length;
                  const open = openGroups.has(group);
                  return (
                    <div
                      key={group}
                      className="overflow-hidden rounded-xl border bg-card"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        aria-expanded={open}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                      >
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                              open && "rotate-180"
                            )}
                            aria-hidden
                          />
                          {group}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                            selCount > 0
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground"
                          )}
                        >
                          {selCount > 0
                            ? `${selCount} selecionada${selCount > 1 ? "s" : ""}`
                            : `${items.length} ${items.length === 1 ? "serviço" : "serviços"}`}
                        </span>
                      </button>
                      {open ? (
                        <div className="flex flex-wrap gap-2 border-t bg-background/40 px-4 py-3">
                          {items.map((category) => {
                            const isSelected = selected.has(category.id);
                            const img = categoryImage(category.slug);
                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => toggle(category.id)}
                                disabled={mutation.isPending}
                                aria-pressed={isSelected}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border py-1.5 pr-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                                  img ? "pl-1.5" : "pl-3",
                                  isSelected
                                    ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                                )}
                              >
                                {img ? (
                                  <Image
                                    src={img}
                                    width={40}
                                    height={40}
                                    alt=""
                                    aria-hidden
                                    className="h-5 w-5 rounded-full object-cover object-top"
                                  />
                                ) : isSelected ? (
                                  <Check className="h-3.5 w-3.5" aria-hidden />
                                ) : null}
                                {category.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                {selected.size}{" "}
                {selected.size === 1
                  ? "categoria selecionada"
                  : "categorias selecionadas"}
              </p>

              {mutation.isError && (
                <ErrorBanner
                  message={errorMessage(
                    mutation.error,
                    "Não foi possível salvar as categorias."
                  )}
                />
              )}
              {saved && !mutation.isPending && (
                <SuccessBanner message="Categorias atualizadas." />
              )}

              <Button
                type="button"
                onClick={handleSave}
                disabled={mutation.isPending || !isDirty}
              >
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
                Salvar categorias
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma categoria disponível no momento.
            </p>
          ))}
      </CardContent>
    </Card>
  );
}
