"use client";

/**
 * `useOpportunitiesCount` — nº de oportunidades (leads elegíveis) disponíveis para
 * o profissional. Alimenta o badge da aba "Oportunidades" no rodapé.
 *
 * Reaproveita `GET /leads/` (mesma lista do marketplace) com refetch periódico.
 * `enabled` deve ser true só para profissionais autenticados.
 */

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/services/api";
import type { Lead, Paginated } from "@/types";

import { normalizeLeadsResponse } from "./utils";

export const opportunitiesKey = ["leads", "available"] as const;

export function useOpportunitiesCount(enabled: boolean): number {
  const { data } = useQuery({
    queryKey: opportunitiesKey,
    queryFn: async () => {
      const res = await apiGet<Lead[] | Paginated<Lead>>("/leads/");
      return normalizeLeadsResponse(res);
    },
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return data?.length ?? 0;
}
