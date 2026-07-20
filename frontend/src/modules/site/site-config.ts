/**
 * Configuração central do site institucional (público).
 *
 * Fonte única de verdade para navegação, categorias em destaque, status das
 * lojas e dados de contato. Mudou o menu/contato? Muda aqui, num lugar só.
 *
 * ⚠️ Os dados de contato são PLACEHOLDERS até o dono confirmar os reais.
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
  Car,
  Camera,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

/** Link de navegação do header/footer de marketing. */
export interface SiteNavLink {
  href: string;
  label: string;
}

/** Menu principal do header público. */
export const SITE_NAV: SiteNavLink[] = [
  { href: "/para-contratantes", label: "Para contratantes" },
  { href: "/para-profissionais", label: "Para profissionais" },
  { href: "/categorias", label: "Categorias" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
];

/** Grupos de links do rodapé. */
export const FOOTER_GROUPS: { title: string; links: SiteNavLink[] }[] = [
  {
    title: "Produto",
    links: [
      { href: "/para-contratantes", label: "Para contratantes" },
      { href: "/para-profissionais", label: "Para profissionais" },
      { href: "/categorias", label: "Categorias" },
      { href: "/baixar", label: "Baixar o app" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "/sobre", label: "Sobre" },
      { href: "/contato", label: "Contato" },
      { href: "/suporte", label: "Suporte" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/termos", label: "Termos de uso" },
      { href: "/privacidade", label: "Privacidade" },
    ],
  },
];

/**
 * Status de publicação nas lojas. Enquanto o app não está publicado, os selos
 * ficam em "Em breve" (desabilitados) e a página `/baixar` captura e-mail.
 */
export type StoreStatus = "coming_soon" | "live";

export interface StoreInfo {
  /** Nome exibido (App Store / Google Play). */
  label: string;
  /** URL da loja quando publicado (null enquanto "em breve"). */
  url: string | null;
  status: StoreStatus;
}

export const APP_STORE: StoreInfo = {
  label: "App Store",
  url: null,
  status: "coming_soon",
};

export const GOOGLE_PLAY: StoreInfo = {
  label: "Google Play",
  url: null,
  status: "coming_soon",
};

/** true enquanto qualquer loja ainda está "em breve" (mostra captura de e-mail). */
export const APP_COMING_SOON =
  APP_STORE.status === "coming_soon" || GOOGLE_PLAY.status === "coming_soon";

/**
 * Dados de contato do site. PLACEHOLDERS — substituir pelos reais do dono
 * (WhatsApp, e-mail e cidade). Ver spec: docs/superpowers/specs/.
 */
export const CONTACT = {
  whatsappDisplay: "(00) 00000-0000",
  /** Só dígitos, com DDI, para link wa.me. */
  whatsappE164: "5500000000000",
  email: "contato@faztudo.app",
  city: "Ariquemes, RO",
} as const;

/** Categoria em destaque no site (nome + ícone lucide). */
export interface SiteCategory {
  name: string;
  icon: LucideIcon;
}

/** Grid curto exibido na Home ("Categorias populares"). */
export const POPULAR_CATEGORIES: SiteCategory[] = [
  { name: "Eletricista", icon: Zap },
  { name: "Encanador", icon: Wrench },
  { name: "Diarista", icon: Sparkles },
  { name: "Babá", icon: Baby },
  { name: "Pintor", icon: PaintRoller },
  { name: "Reformas", icon: Hammer },
];

/** Lista completa exibida na página `/categorias`. */
export const ALL_CATEGORIES: SiteCategory[] = [
  { name: "Eletricista", icon: Zap },
  { name: "Encanador", icon: Wrench },
  { name: "Diarista", icon: Sparkles },
  { name: "Babá", icon: Baby },
  { name: "Pintor", icon: PaintRoller },
  { name: "Reformas", icon: Hammer },
  { name: "Jardinagem", icon: Trees },
  { name: "Ar-condicionado", icon: Wind },
  { name: "Mudanças", icon: Truck },
  { name: "Automotivo", icon: Car },
  { name: "Fotografia", icon: Camera },
  { name: "Mais serviços", icon: LayoutGrid },
];
