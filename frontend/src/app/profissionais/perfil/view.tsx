"use client";

/**
 * Perfil **público** de um profissional (`/profissionais/perfil?id=`).
 *
 * Mostrado ao cliente: nome, foto, selo de verificado, nota, cidade, bio,
 * categorias, avaliações recebidas e botões "Solicitar serviço" e "Denunciar".
 * `GET /users/{id}/professional-profile` + `<ReviewList>`.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, MapPin } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiGet } from "@/services/api";
import { ReportButton } from "@/modules/reports/report-button";
import { ReviewList } from "@/modules/reviews/review-list";
import { StarRating } from "@/modules/reviews/star-rating";

interface PublicProfile {
  id: string;
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  rating: number;
  total_reviews: number;
  verified: boolean;
  categories?: { id: string; name: string }[];
}

export default function ProfessionalPublicView() {
  const auth = useRequireAuth();
  const params = useSearchParams();
  const id = params.get("id") ?? undefined;

  const { data, isLoading, isError } = useQuery<PublicProfile>({
    queryKey: ["professional-public", id],
    queryFn: () => apiGet<PublicProfile>(`/users/${id}/professional-profile`),
    enabled: Boolean(id) && auth.isAuthenticated,
  });

  if (!auth.hasHydrated || !auth.isAuthenticated) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/profissionais"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Profissionais
      </Link>

      {!id ? (
        <p className="text-sm text-muted-foreground">Perfil inválido.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : isError || !data ? (
        <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Perfil não encontrado.
        </p>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-4">
                <Avatar
                  src={data.avatar_url}
                  name={data.name ?? "Profissional"}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h1 className="truncate text-lg font-bold tracking-tight">
                      {data.name ?? "Profissional"}
                    </h1>
                    {data.verified ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                        Verificado
                      </span>
                    ) : null}
                  </div>
                  {data.headline ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {data.headline}
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <StarRating value={data.rating} size="sm" />
                      <span className="tabular-nums">
                        {data.rating.toFixed(1)} ({data.total_reviews})
                      </span>
                    </span>
                    {data.city ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        {data.city}
                        {data.state ? `/${data.state}` : ""}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {data.bio ? (
                <p className="whitespace-pre-line text-sm text-foreground">
                  {data.bio}
                </p>
              ) : null}

              {data.categories && data.categories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.categories.map((c) => (
                    <Badge key={c.id} variant="outline">
                      {c.name}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 pt-1">
                <Link href="/leads/new" className="flex-1">
                  <Button className="w-full">Solicitar serviço</Button>
                </Link>
                <ReportButton targetType="user" targetId={data.user_id} />
              </div>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <h2 className="text-base font-bold tracking-tight">Avaliações</h2>
            <ReviewList userId={data.user_id} showSummary />
          </section>
        </>
      )}
    </main>
  );
}
