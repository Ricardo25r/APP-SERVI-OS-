/**
 * `PortfolioManager` — galeria de trabalhos do profissional (#58).
 *
 * Lista, envia (multipart) e remove fotos da própria galeria. As fotos aparecem
 * no perfil público (`<ProfessionalPublicView>`). Só tokens do design system.
 */
"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiDelete, apiGet, apiUpload } from "@/services/api";

interface PortfolioItem {
  id: string;
  image_url: string | null;
  caption: string | null;
}

const KEY = ["portfolio", "me"] as const;
const MAX = 12;

export function PortfolioManager() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery<PortfolioItem[]>({
    queryKey: KEY,
    queryFn: () => apiGet<PortfolioItem[]>("/users/me/portfolio"),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiUpload<PortfolioItem>("/users/me/portfolio", form);
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: () =>
      setError(
        "Não foi possível enviar (JPG/PNG/WEBP até 5 MB, máximo 12 fotos)."
      ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/users/me/portfolio/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });

  const items = data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length}/{MAX} fotos
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending || items.length >= MAX}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="mr-2 h-4 w-4" aria-hidden />
          )}
          Adicionar foto
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Mostre seus trabalhos. As fotos aparecem no seu perfil público e ajudam
          o cliente a confiar.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((p) => (
            <div
              key={p.id}
              className="relative overflow-hidden rounded-xl border bg-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image_url ?? ""}
                alt={p.caption ?? "Trabalho"}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => remove.mutate(p.id)}
                aria-label="Remover foto"
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-destructive shadow hover:bg-background"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
