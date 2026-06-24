/**
 * Seção de perfil do **profissional**.
 *
 * - `GET /users/me/professional-profile` para carregar.
 * - Se 404 → cria (`POST`).
 * - Se existe → edita (`PATCH`).
 *
 * Campos do contrato: headline, bio, city, state, service_radius_km,
 * availability_status (available | busy | unavailable). A resposta inclui
 * `balance`, exibido num card de créditos com link para `/credits`.
 *
 * As categorias ficam numa seção própria (`ProfessionalCategoriesSection`),
 * renderizada pela página logo abaixo desta.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { CitySelect } from "@/components/ui/city-select";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPatch, apiPost, ApiError } from "@/services/api";
import type { AvailabilityStatus, ProfessionalProfile } from "@/types";

import { StarRating } from "@/modules/reviews/star-rating";
import { ReviewList } from "@/modules/reviews/review-list";
import { LevelBadge } from "@/modules/gamification/level-badge";
import { formatXp } from "@/modules/gamification/utils";

import {
  AVAILABILITY_OPTIONS,
  BRAZIL_STATES,
  availabilityBadgeVariant,
  availabilityLabel,
} from "./constants";
import {
  ErrorBanner,
  LoadingState,
  SuccessBanner,
  errorMessage,
} from "./feedback";

const PROFESSIONAL_PROFILE_KEY = ["professional-profile"] as const;

/** A resposta inclui `balance` além dos campos do `ProfessionalProfile`. */
type ProfessionalProfileResponse = ProfessionalProfile & { balance?: number };

interface ProfessionalProfileForm {
  headline: string;
  bio: string;
  city: string;
  state: string;
  service_radius_km: string;
  latitude: number | null;
  longitude: number | null;
  availability_status: AvailabilityStatus;
}

const EMPTY_FORM: ProfessionalProfileForm = {
  headline: "",
  bio: "",
  city: "",
  state: "",
  service_radius_km: "",
  latitude: null,
  longitude: null,
  availability_status: "available",
};

function fromProfile(p: ProfessionalProfile): ProfessionalProfileForm {
  return {
    headline: p.headline ?? "",
    bio: p.bio ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    service_radius_km:
      p.service_radius_km != null ? String(p.service_radius_km) : "",
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    availability_status: p.availability_status,
  };
}

/** Monta o payload, omitindo strings vazias e convertendo o raio para número. */
function toPayload(form: ProfessionalProfileForm) {
  const radius = form.service_radius_km.trim();
  return {
    headline: form.headline.trim() ? form.headline.trim() : undefined,
    bio: form.bio.trim() ? form.bio.trim() : undefined,
    city: form.city.trim() ? form.city.trim() : undefined,
    state: form.state ? form.state : undefined,
    service_radius_km: radius ? Number(radius) : undefined,
    latitude: form.latitude ?? undefined,
    longitude: form.longitude ?? undefined,
    availability_status: form.availability_status,
  };
}

export function ProfessionalProfileSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfessionalProfileForm>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useQuery<ProfessionalProfileResponse | null>({
    queryKey: PROFESSIONAL_PROFILE_KEY,
    queryFn: async () => {
      try {
        return await apiGet<ProfessionalProfileResponse>(
          "/users/me/professional-profile"
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });

  useEffect(() => {
    if (profile) setForm(fromProfile(profile));
  }, [profile]);

  const exists = Boolean(profile);

  const mutation = useMutation({
    mutationFn: async (values: ProfessionalProfileForm) => {
      const payload = toPayload(values);
      return exists
        ? apiPatch<ProfessionalProfileResponse>(
            "/users/me/professional-profile",
            payload
          )
        : apiPost<ProfessionalProfileResponse>(
            "/users/me/professional-profile",
            payload
          );
    },
    onSuccess: (data) => {
      queryClient.setQueryData(PROFESSIONAL_PROFILE_KEY, data);
      // Perfil criado/atualizado → recarrega as categorias do profissional
      // (some o estado "crie o perfil primeiro" e mostra o seletor na hora).
      void queryClient.invalidateQueries({
        queryKey: ["professional-profile", "categories"],
      });
      setSaved(true);
    },
  });

  const isDirty = useMemo(() => {
    if (!profile) return true;
    const original = fromProfile(profile);
    return (Object.keys(original) as Array<keyof ProfessionalProfileForm>).some(
      (k) => original[k] !== form[k]
    );
  }, [profile, form]);

  // O raio precisa ser um número não-negativo válido (quando preenchido).
  const radiusInvalid = useMemo(() => {
    const v = form.service_radius_km.trim();
    if (!v) return false;
    const n = Number(v);
    return Number.isNaN(n) || n < 0;
  }, [form.service_radius_km]);

  function detectLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoMsg("Geolocalização não suportada neste dispositivo.");
      return;
    }
    setGeoLoading(true);
    setGeoMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`
          );
          const d = await res.json();
          const uf =
            String(d.principalSubdivisionCode || "").split("-")[1] || "";
          const city = d.city || d.locality || "";
          setForm((f) => ({
            ...f,
            latitude,
            longitude,
            city: city || f.city,
            state: uf || f.state,
          }));
          setSaved(false);
          setGeoMsg(
            `Localização capturada${
              city ? `: ${city}${uf ? `/${uf}` : ""}` : ""
            } — clientes verão a distância até o serviço.`
          );
        } catch {
          setForm((f) => ({ ...f, latitude, longitude }));
          setSaved(false);
          setGeoMsg("Localização capturada para cálculo de distância.");
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        setGeoLoading(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada. Toque no cadeado/ícone ao lado do endereço (ou nos Ajustes do navegador) e permita a localização para este site."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Não foi possível obter sua localização (sinal indisponível). Verifique se o GPS/localização do aparelho está ligado e tente de novo."
              : "Tempo esgotado ao obter a localização. Tente novamente, de preferência com melhor sinal.";
        setGeoMsg(msg);
      },
      // maximumAge: reaproveita um fix recente (até 2 min) → resposta quase
      // instantânea quando o aparelho já tem a posição; sem alta precisão (rápido).
      { timeout: 15000, enableHighAccuracy: false, maximumAge: 120000 }
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (radiusInvalid) return;
    setSaved(false);
    mutation.mutate(form);
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingState label="Carregando seu perfil profissional..." />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Perfil profissional</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBanner
            message={errorMessage(
              error,
              "Não foi possível carregar seu perfil profissional."
            )}
          />
        </CardContent>
      </Card>
    );
  }

  const balance = profile?.balance ?? 0;
  const rating = profile?.rating ?? 0;
  const totalReviews = profile?.total_reviews ?? 0;
  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 0;

  return (
    <div className="space-y-6">
      {/* Reputação: nota média + total de avaliações + nível/XP */}
      {exists && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Reputação</p>
              <div className="flex items-center gap-2">
                <StarRating value={rating} />
                <span className="text-2xl font-semibold leading-tight">
                  {rating.toFixed(1)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {totalReviews === 0
                  ? "Nenhuma avaliação ainda"
                  : totalReviews === 1
                    ? "1 avaliação recebida"
                    : `${totalReviews} avaliações recebidas`}
              </p>
            </div>

            <div className="space-y-1 sm:text-right">
              <p className="text-sm text-muted-foreground">Nível</p>
              <div className="flex items-center gap-2 sm:justify-end">
                <LevelBadge level={level} size="md" />
                <span className="text-2xl font-semibold leading-tight tabular-nums">
                  {formatXp(xp)} XP
                </span>
              </div>
              <Link
                href="/gamificacao"
                className="inline-block text-sm font-medium text-primary hover:underline"
              >
                Ver progresso
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card de créditos / saldo */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center">
              <Image
                src="/brand/moedas.png"
                alt=""
                width={44}
                height={44}
                aria-hidden
                className="h-11 w-11 object-contain"
              />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Saldo de créditos</p>
              <p className="text-2xl font-semibold leading-tight">
                {exists ? balance : "—"}
              </p>
            </div>
          </div>
          <Link
            href="/credits"
            className={buttonVariants({ variant: "outline" })}
          >
            Gerenciar créditos
          </Link>
        </CardContent>
      </Card>

      {/* Card de dados do profissional */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Perfil profissional</CardTitle>
              <CardDescription>
                {exists
                  ? "Mantenha seus dados atualizados para atrair mais clientes."
                  : "Crie seu perfil profissional para começar a receber leads."}
              </CardDescription>
            </div>
            {exists && (
              <Badge
                variant={availabilityBadgeVariant(form.availability_status)}
              >
                {availabilityLabel(form.availability_status)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pro-headline">Título / chamada</Label>
              <Input
                id="pro-headline"
                placeholder="Ex.: Eletricista residencial com 10 anos de experiência"
                value={form.headline}
                onChange={(e) =>
                  setForm((f) => ({ ...f, headline: e.target.value }))
                }
                disabled={mutation.isPending}
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pro-bio">Sobre você</Label>
              <Textarea
                id="pro-bio"
                placeholder="Descreva sua experiência, especialidades e diferenciais."
                value={form.bio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bio: e.target.value }))
                }
                disabled={mutation.isPending}
                rows={4}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium leading-none">
                Localização
              </span>
              <button
                type="button"
                onClick={detectLocation}
                disabled={mutation.isPending || geoLoading}
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
            {geoMsg ? (
              <p className="text-xs text-muted-foreground">{geoMsg}</p>
            ) : form.latitude != null ? (
              <p className="text-xs text-success">
                Localização definida para cálculo de distância.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Defina sua localização para os clientes verem a distância até o
                serviço.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pro-state">Estado (UF)</Label>
                <Select
                  id="pro-state"
                  value={form.state}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, state: e.target.value, city: "" }))
                  }
                  disabled={mutation.isPending}
                >
                  <SelectOption value="">—</SelectOption>
                  {BRAZIL_STATES.map((uf) => (
                    <SelectOption key={uf} value={uf}>
                      {uf}
                    </SelectOption>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pro-city">Cidade</Label>
                <CitySelect
                  id="pro-city"
                  uf={form.state}
                  value={form.city}
                  onChange={(city) => setForm((f) => ({ ...f, city }))}
                  disabled={mutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pro-radius">Raio de atendimento (km)</Label>
                <Input
                  id="pro-radius"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  placeholder="Ex.: 20"
                  value={form.service_radius_km}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      service_radius_km: e.target.value,
                    }))
                  }
                  disabled={mutation.isPending}
                  aria-invalid={radiusInvalid}
                />
                {radiusInvalid && (
                  <p className="text-xs text-destructive">
                    Informe um número válido (km), maior ou igual a zero.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pro-availability">Disponibilidade</Label>
                <Select
                  id="pro-availability"
                  value={form.availability_status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      availability_status: e.target
                        .value as AvailabilityStatus,
                    }))
                  }
                  disabled={mutation.isPending}
                >
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <SelectOption key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectOption>
                  ))}
                </Select>
              </div>
            </div>

            {mutation.isError && (
              <ErrorBanner
                message={errorMessage(
                  mutation.error,
                  "Não foi possível salvar. Tente novamente."
                )}
              />
            )}
            {saved && !mutation.isPending && (
              <SuccessBanner message="Perfil salvo com sucesso." />
            )}

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={
                  mutation.isPending || radiusInvalid || (exists && !isDirty)
                }
              >
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
                {exists ? "Salvar alterações" : "Criar perfil"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Avaliações recebidas pelo profissional */}
      {exists && profile?.user_id && (
        <Card>
          <CardHeader>
            <CardTitle>Avaliações recebidas</CardTitle>
            <CardDescription>
              O que os contratantes dizem sobre o seu trabalho.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReviewList
              userId={profile.user_id}
              emptyLabel="Você ainda não recebeu avaliações."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
