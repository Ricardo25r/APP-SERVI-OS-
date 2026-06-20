/**
 * Mapeamento de categoria -> icone lucide + cor tonal do `IconChip`.
 *
 * Camada puramente visual: resolve o `slug` (ou o nome, como fallback) de uma
 * categoria para um par {icone, cor}. As cores sao sempre tokens do design
 * system (`blue`/`orange`/`green`/`default`), nunca hardcoded.
 *
 * Sem correspondencia, retorna um icone generico (`Wrench`) com cor azul.
 */

import {
  Baby,
  Brush,
  Hammer,
  Leaf,
  PaintRoller,
  Sparkles,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { IconChipProps } from "@/components/ui/icon-chip";

type ChipColor = NonNullable<IconChipProps["color"]>;

interface CategoryVisual {
  icon: LucideIcon;
  color: ChipColor;
}

/** Mapa por palavra-chave encontrada no slug/nome (normalizado). */
const KEYWORD_VISUALS: { keys: string[]; visual: CategoryVisual }[] = [
  { keys: ["bab", "cuidador", "cuidados"], visual: { icon: Baby, color: "orange" } },
  { keys: ["faxin", "limpez", "diaris", "higien"], visual: { icon: Sparkles, color: "blue" } },
  { keys: ["eletric"], visual: { icon: Zap, color: "orange" } },
  { keys: ["pedreir", "alvenar", "reforma", "obra", "construc"], visual: { icon: Hammer, color: "blue" } },
  { keys: ["encanad", "hidraul"], visual: { icon: Wrench, color: "blue" } },
  { keys: ["pintor", "pintur"], visual: { icon: PaintRoller, color: "orange" } },
  { keys: ["jardin", "paisag"], visual: { icon: Leaf, color: "green" } },
  { keys: ["lavagem", "lava"], visual: { icon: Brush, color: "blue" } },
  { keys: ["mudanc", "frete", "transport", "carret"], visual: { icon: Truck, color: "green" } },
];

const FALLBACK: CategoryVisual = { icon: Wrench, color: "blue" };

/** Normaliza removendo acentos e caixa para casar palavras-chave. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Resolve o visual (icone + cor) de uma categoria a partir do slug e/ou nome.
 * Aceita campos opcionais para funcionar tanto com `Category` quanto com
 * `CategorySummary` embutido no lead.
 */
export function categoryVisual(input?: {
  slug?: string | null;
  name?: string | null;
}): CategoryVisual {
  const haystack = normalize(`${input?.slug ?? ""} ${input?.name ?? ""}`);
  if (!haystack.trim()) return FALLBACK;

  for (const { keys, visual } of KEYWORD_VISUALS) {
    if (keys.some((k) => haystack.includes(k))) return visual;
  }
  return FALLBACK;
}

/** Fotos reais por slug de categoria (as demais usam o ícone). */
const CATEGORY_IMAGES: Record<string, string> = {
  baba: "/brand/categorias/baba.png",
  cuidador: "/brand/categorias/cuidador.png",
  diarista: "/brand/categorias/diarista.png",
  domestica: "/brand/categorias/domestica.png",
  eletricista: "/brand/categorias/eletricista.png",
  encanador: "/brand/categorias/encanador.png",
  jardinagem: "/brand/categorias/jardinagem.png",
  montagem: "/brand/categorias/montagem.png",
  pintor: "/brand/categorias/pintor.png",
  reforma: "/brand/categorias/reforma.png",
  outras: "/brand/categorias/outras.png",
};

/** Caminho da foto real da categoria (ou null para usar o ícone). */
export function categoryImage(slug?: string | null): string | null {
  if (!slug) return null;
  return CATEGORY_IMAGES[slug] ?? null;
}
