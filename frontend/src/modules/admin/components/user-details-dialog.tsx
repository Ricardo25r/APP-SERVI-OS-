"use client";

/**
 * `UserDetailsDialog` — ficha completa ("Ver detalhes") de um usuário no admin.
 * Carrega `GET /admin/users/{id}/details` e mostra o DNA do profissional
 * (categorias, idade, localização, atendidos, reputação, KYC, créditos) ou do
 * contratante. Sheet no mobile, card centralizado no desktop.
 */

import { useQuery } from "@tanstack/react-query";
import { Loader2, Star, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { fetchUserDetails } from "../api";
import {
  ROLE_LABEL,
  USER_STATUS_LABEL,
  formatDateTime,
  userStatusVariant,
} from "../utils";

const KYC_LABEL: Record<string, string> = {
  none: "Não enviado",
  pending: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
};

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

export function UserDetailsDialog({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "user-details", userId],
    queryFn: () => fetchUserDetails(userId as string),
    enabled: Boolean(userId),
  });

  if (!userId) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold tracking-tight">
            Detalhes do usuário
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando ficha...
            </div>
          ) : isError || !data ? (
            <p className="py-10 text-center text-sm text-destructive">
              Não foi possível carregar os detalhes.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Cabeçalho */}
              <div className="flex items-center gap-3">
                {data.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.avatar_url}
                    alt={data.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-base font-bold text-muted-foreground">
                    {data.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {data.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {data.email}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{ROLE_LABEL[data.role]}</Badge>
                    <Badge variant={userStatusVariant(data.status)}>
                      {USER_STATUS_LABEL[data.status]}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Dados básicos */}
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados
                </h3>
                <div className="divide-y divide-border/60">
                  <Row
                    label="Idade"
                    value={data.age != null ? `${data.age} anos` : "—"}
                  />
                  <Row label="Telefone" value={data.phone || "—"} />
                  <Row label="Gênero" value={data.gender || "—"} />
                  <Row label="CPF/Documento" value={data.document || "—"} />
                  <Row
                    label="Verificação (KYC)"
                    value={KYC_LABEL[data.kyc_status ?? "none"] ?? "—"}
                  />
                  <Row
                    label="Cadastro"
                    value={formatDateTime(data.created_at)}
                  />
                  {data.last_login_at ? (
                    <Row
                      label="Último acesso"
                      value={formatDateTime(data.last_login_at)}
                    />
                  ) : null}
                </div>
              </section>

              {/* DNA do profissional */}
              {data.professional ? (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Profissional
                  </h3>

                  <div className="mb-3">
                    <p className="mb-1.5 text-xs text-muted-foreground">
                      Categorias habilitadas
                    </p>
                    {data.professional.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {data.professional.categories.map((c) => (
                          <Badge key={c} variant="secondary">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma categoria selecionada.
                      </p>
                    )}
                  </div>

                  <div className="divide-y divide-border/60">
                    <Row
                      label="Localização"
                      value={
                        data.professional.city || data.professional.state
                          ? `${data.professional.city ?? "—"}${
                              data.professional.state
                                ? ` / ${data.professional.state}`
                                : ""
                            }`
                          : "—"
                      }
                    />
                    <Row
                      label="Raio de atendimento"
                      value={
                        data.professional.service_radius_km != null
                          ? `${data.professional.service_radius_km} km`
                          : "—"
                      }
                    />
                    <Row
                      label="Atendimentos (leads)"
                      value={data.professional.leads_attended}
                    />
                    <Row
                      label="Avaliação"
                      value={
                        <span className="inline-flex items-center gap-1">
                          <Star
                            className="h-3.5 w-3.5 fill-orange-400 text-orange-400"
                            aria-hidden
                          />
                          {data.professional.rating.toFixed(1)} (
                          {data.professional.total_reviews})
                        </span>
                      }
                    />
                    <Row label="Nível" value={data.professional.level} />
                    <Row
                      label="Faltas (no-show)"
                      value={data.professional.no_show_count}
                    />
                    <Row
                      label="Créditos"
                      value={data.professional.credits_balance}
                    />
                    <Row
                      label="Verificado"
                      value={data.professional.verified ? "Sim" : "Não"}
                    />
                    <Row
                      label="Plano PRO"
                      value={data.professional.premium ? "Sim" : "Não"}
                    />
                    <Row
                      label="Bônus de boas-vindas"
                      value={
                        data.professional.welcome_credits_granted
                          ? "Recebido"
                          : "Pendente"
                      }
                    />
                  </div>

                  {data.professional.headline || data.professional.bio ? (
                    <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                      {data.professional.headline ? (
                        <p className="text-sm font-medium text-foreground">
                          {data.professional.headline}
                        </p>
                      ) : null}
                      {data.professional.bio ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {data.professional.bio}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {/* DNA do contratante */}
              {data.customer ? (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contratante
                  </h3>
                  <div className="divide-y divide-border/60">
                    <Row
                      label="Localização"
                      value={
                        data.customer.city || data.customer.state
                          ? `${data.customer.city ?? "—"}${
                              data.customer.state
                                ? ` / ${data.customer.state}`
                                : ""
                            }`
                          : "—"
                      }
                    />
                    <Row
                      label="Pedidos publicados"
                      value={data.customer.leads_posted}
                    />
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
