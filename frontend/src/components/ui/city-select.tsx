/**
 * `CitySelect` — lista suspensa de cidades dependente do **UF**, alimentada pela
 * API pública do **IBGE** (municípios por estado). Evita digitação manual.
 *
 * - Desabilitado até um estado ser escolhido.
 * - Mantém uma cidade já salva que ainda não esteja na lista carregada.
 * - Cache de 24h por UF (React Query).
 */
"use client";

import { useQuery } from "@tanstack/react-query";

import { Select, SelectOption } from "@/components/ui/select";

interface IbgeCity {
  id: number;
  nome: string;
}

async function fetchCities(uf: string): Promise<string[]> {
  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
  );
  if (!res.ok) throw new Error("Falha ao carregar municípios do IBGE.");
  const data: IbgeCity[] = await res.json();
  return data.map((c) => c.nome);
}

interface CitySelectProps {
  id?: string;
  /** UF selecionada (ex.: "RO"). Sem UF, o select fica desabilitado. */
  uf: string;
  value: string;
  onChange: (city: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CitySelect({
  id,
  uf,
  value,
  onChange,
  disabled,
  className,
}: CitySelectProps) {
  const {
    data: cities = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["ibge-cities", uf],
    queryFn: () => fetchCities(uf),
    enabled: Boolean(uf),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const placeholder = !uf
    ? "Selecione o estado primeiro"
    : isLoading
      ? "Carregando cidades..."
      : isError
        ? "Erro ao carregar — tente de novo"
        : "Selecione a cidade";

  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !uf || isLoading}
      className={className}
    >
      <SelectOption value="">{placeholder}</SelectOption>
      {value && !cities.includes(value) ? (
        <SelectOption value={value}>{value}</SelectOption>
      ) : null}
      {cities.map((c) => (
        <SelectOption key={c} value={c}>
          {c}
        </SelectOption>
      ))}
    </Select>
  );
}
