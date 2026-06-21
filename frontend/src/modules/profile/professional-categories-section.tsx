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
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiGet, apiPut } from "@/services/api";
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

export function ProfessionalCategoriesSection() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorias de atuação</CardTitle>
        <CardDescription>
          Selecione os serviços que você oferece. Você receberá leads dessas
          categorias.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <LoadingState label="Carregando categorias..." />}

        {!isLoading && (allCategories.isError || myCategories.isError) && (
          <ErrorBanner
            message={errorMessage(
              loadError,
              "Não foi possível carregar as categorias."
            )}
          />
        )}

        {!isLoading &&
          !allCategories.isError &&
          !myCategories.isError &&
          (allCategories.data?.length ? (
            <>
              <div className="flex flex-wrap gap-2">
                {allCategories.data
                  .filter((c) => c.active || selected.has(c.id))
                  .map((category) => {
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
