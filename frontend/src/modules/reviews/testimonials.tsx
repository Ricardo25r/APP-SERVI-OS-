"use client";

/**
 * `Testimonials` — depoimentos em destaque (avaliações 4–5★ com comentário),
 * dos dois lados (contratantes e profissionais). Busca `/reviews/highlights`
 * (público). Some quando não há depoimentos. Estilo da referência (foto/iniciais
 * + nome + papel + data + estrelas + texto).
 */

import { useQuery } from "@tanstack/react-query";

import { Avatar } from "@/components/ui/avatar";
import { StarRating } from "@/modules/reviews/star-rating";
import { apiGet } from "@/services/api";

interface Highlight {
  author_name: string;
  author_avatar_url: string | null;
  author_role: string;
  score: number;
  comment: string;
  created_at: string;
}

function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "");
}

export function Testimonials({ title = "O que dizem por aqui" }: { title?: string }) {
  const { data } = useQuery({
    queryKey: ["reviews", "highlights"],
    queryFn: () => apiGet<{ items: Highlight[] }>("/reviews/highlights"),
  });
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold tracking-tight sm:text-lg">{title}</h2>
      <div className="space-y-3">
        {items.map((t, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar
                src={t.author_avatar_url}
                name={t.author_name}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">
                  {t.author_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.author_role === "professional"
                    ? "Profissional"
                    : "Contratante"}
                  {monthYear(t.created_at) ? ` · ${monthYear(t.created_at)}` : ""}
                </p>
              </div>
              <StarRating value={t.score} size="sm" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.comment}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
