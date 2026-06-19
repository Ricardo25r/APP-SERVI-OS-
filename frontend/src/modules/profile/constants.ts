/**
 * Constantes compartilhadas da feature de perfil.
 *
 * Mantém as opções de UF e os rótulos de disponibilidade num só lugar para
 * evitar divergências entre os formulários de customer e professional.
 */
import type { AvailabilityStatus } from "@/types";

/** Unidades federativas do Brasil (siglas), para o `Select` de estado. */
export const BRAZIL_STATES: readonly string[] = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

/** Opções de disponibilidade do profissional, com rótulo e cor de badge. */
export const AVAILABILITY_OPTIONS: ReadonlyArray<{
  value: AvailabilityStatus;
  label: string;
  badgeVariant: "success" | "secondary" | "destructive";
}> = [
  { value: "available", label: "Disponível", badgeVariant: "success" },
  { value: "busy", label: "Ocupado", badgeVariant: "secondary" },
  {
    value: "unavailable",
    label: "Indisponível",
    badgeVariant: "destructive",
  },
] as const;

/** Rótulo legível para um status de disponibilidade. */
export function availabilityLabel(status: AvailabilityStatus): string {
  return (
    AVAILABILITY_OPTIONS.find((o) => o.value === status)?.label ?? status
  );
}

/** Variante de badge para um status de disponibilidade. */
export function availabilityBadgeVariant(
  status: AvailabilityStatus
): "success" | "secondary" | "destructive" {
  return (
    AVAILABILITY_OPTIONS.find((o) => o.value === status)?.badgeVariant ??
    "secondary"
  );
}
