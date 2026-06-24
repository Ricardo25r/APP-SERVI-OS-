/**
 * Categorias populares — helpers de dados e mapeamento de ícones.
 *
 * A Home (landing + contratante) exibe um grid de categorias. Buscamos as
 * categorias ativas via `GET /categories/` (público), mas como a Home é a
 * primeira tela e a API pode estar indisponível, mantemos um **fallback
 * estático** com as categorias mais comuns para nunca renderizar vazio.
 *
 * Como `Category` do backend não traz ícone, derivamos um ícone lucide a
 * partir do `slug`/nome (heurística simples, com fallback genérico).
 */

import {
  Baby,
  Sparkles,
  Zap,
  Hammer,
  Wrench,
  PaintRoller,
  Trees,
  Truck,
  Wind,
  Sprout,
  ShieldCheck,
  Dog,
  Camera,
  Scissors,
  Car,
  GraduationCap,
  Laptop,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

import { apiGet } from "@/services/api";
import type { Category } from "@/types";

/** Cores tonais alternadas para os IconChips das categorias. */
export type CategoryChipColor = "blue" | "orange" | "green";

/** Item normalizado para o grid de categorias. */
export interface CategoryItem {
  /** Slug (ou chave sintética para itens estáticos como "Outras"). */
  slug: string;
  /** Nome exibido. */
  name: string;
  /** Ícone lucide derivado do slug/nome. */
  icon: LucideIcon;
  /** Foto enviada pelo admin (tem prioridade sobre a imagem fixa por slug). */
  image?: string | null;
}

/**
 * Mapa slug → ícone. Cobre os serviços mais comuns do marketplace; nomes
 * próximos (ex.: "limpeza" ~ "faxina") são incluídos como apelidos.
 */
const ICON_BY_SLUG: Record<string, LucideIcon> = {
  baba: Baby,
  "baba-cuidador": Baby,
  cuidador: Baby,
  faxina: Sparkles,
  limpeza: Sparkles,
  "diarista": Sparkles,
  eletricista: Zap,
  eletrica: Zap,
  pedreiro: Hammer,
  alvenaria: Hammer,
  encanador: Wrench,
  hidraulica: Wrench,
  pintor: PaintRoller,
  pintura: PaintRoller,
  jardinagem: Trees,
  jardineiro: Sprout,
  mudanca: Truck,
  frete: Truck,
  "ar-condicionado": Wind,
  climatizacao: Wind,
  seguranca: ShieldCheck,
  "pet": Dog,
  "passeador-de-caes": Dog,
  fotografia: Camera,
  fotografo: Camera,
  beleza: Scissors,
  cabeleireiro: Scissors,
  automotivo: Car,
  mecanico: Car,
  "aulas": GraduationCap,
  professor: GraduationCap,
  informatica: Laptop,
  "ti": Laptop,
};

/** Resolve o ícone de uma categoria pelo slug (com fallback genérico). */
export function iconForCategory(slug: string): LucideIcon {
  return ICON_BY_SLUG[slug] ?? LayoutGrid;
}

/**
 * Fallback estático (mesma ordem do mockup): Babá, Faxina, Eletricista,
 * Pedreiro, Encanador, Pintor, Jardinagem, Outras.
 */
export const FALLBACK_CATEGORIES: CategoryItem[] = [
  { slug: "baba", name: "Babá", icon: Baby },
  { slug: "faxina", name: "Faxina", icon: Sparkles },
  { slug: "eletricista", name: "Eletricista", icon: Zap },
  { slug: "pedreiro", name: "Pedreiro", icon: Hammer },
  { slug: "encanador", name: "Encanador", icon: Wrench },
  { slug: "pintor", name: "Pintor", icon: PaintRoller },
  { slug: "jardinagem", name: "Jardinagem", icon: Trees },
  { slug: "outras", name: "Outras", icon: LayoutGrid },
];

/** Item fixo "Outras" anexado ao final do grid (leva ao catálogo completo). */
export const OUTRAS_CATEGORY: CategoryItem = {
  slug: "outras",
  name: "Outras",
  icon: LayoutGrid,
};

/** Cor tonal do chip por índice (alterna azul/laranja/verde). */
export function chipColorForIndex(index: number): CategoryChipColor {
  const colors: CategoryChipColor[] = ["blue", "orange", "green"];
  return colors[index % colors.length]!;
}

/**
 * Extrai a lista de itens de uma resposta que pode ser array cru ou envelope
 * paginado `{ items }`. Defensivo: qualquer outro formato vira lista vazia.
 */
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray((data as { items: unknown }).items)
  ) {
    return (data as { items: T[] }).items;
  }
  return [];
}

/**
 * Busca categorias ativas e normaliza para `CategoryItem`. Limita a `max`
 * itens (default 7) para reservar espaço ao item fixo "Outras". Em falha,
 * propaga o erro para o chamador decidir o fallback.
 */
export async function fetchCategoryItems(max = 7): Promise<CategoryItem[]> {
  const data = await apiGet<unknown>("/categories/");
  const categories = unwrapList<Category>(data);
  return categories
    .filter((c) => c.active !== false)
    .slice(0, max)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      icon: iconForCategory(c.slug),
      image: c.image_url ?? null,
    }));
}
