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
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

/**
 * Origem do APP (domínio puro) para os CTAs do site que levam ao aplicativo
 * (Entrar/Cadastrar/Criar solicitação). O site mora no subdomínio `www` e o app
 * no domínio puro; mandar as ações de app para lá mantém uma sessão só.
 *
 * Vem de `NEXT_PUBLIC_APP_ORIGIN` (definido no build de produção). Em dev fica
 * vazio → links relativos (funciona no localhost).
 */
export const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "";

/** Monta um link para uma rota do APP (absoluto em prod, relativo em dev). */
export function appHref(path: string): string {
  return `${APP_ORIGIN}${path}`;
}

/**
 * Base para os formulários públicos do site chamarem a API. Em produção usa o
 * MESMO host (relativo) — assim o `www` chama `www/api/*` (o Caddy encaminha ao
 * backend) e não há CORS entre subdomínio e domínio puro. Em dev usa a API_URL.
 */
export function siteApiBase(): string {
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") {
      return process.env.NEXT_PUBLIC_API_URL ?? "";
    }
    return "";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

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

/**
 * APK do Android para download direto (sideload), enquanto o app não está na
 * Play Store. Servido estaticamente pelo site (`public/downloads`). É um caminho
 * relativo → funciona tanto no site (www) quanto no domínio puro.
 */
export const APK_URL = "/downloads/faztudo.apk";
/** Liga o botão "Baixar APK (Android)" no site. */
export const APK_AVAILABLE = true;

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

/** Categoria em destaque no site (nome + ícone lucide + foto real opcional). */
export interface SiteCategory {
  name: string;
  icon: LucideIcon;
  /** Foto real da categoria (`/brand/categorias/*`). Cai no ícone se ausente. */
  image?: string;
}

const CAT = "/brand/categorias";

/** Grid curto exibido na Home ("Categorias populares") — todas com foto real. */
export const POPULAR_CATEGORIES: SiteCategory[] = [
  { name: "Eletricista", icon: Zap, image: `${CAT}/eletricista.png` },
  { name: "Encanador", icon: Wrench, image: `${CAT}/encanador.png` },
  { name: "Diarista", icon: Sparkles, image: `${CAT}/diarista.png` },
  { name: "Babá", icon: Baby, image: `${CAT}/baba.png` },
  { name: "Pintor", icon: PaintRoller, image: `${CAT}/pintor.png` },
  { name: "Reformas", icon: Hammer, image: `${CAT}/reforma.png` },
];

/** Lista completa exibida na página `/categorias` — fotos reais disponíveis. */
export const ALL_CATEGORIES: SiteCategory[] = [
  { name: "Eletricista", icon: Zap, image: `${CAT}/eletricista.png` },
  { name: "Encanador", icon: Wrench, image: `${CAT}/encanador.png` },
  { name: "Diarista", icon: Sparkles, image: `${CAT}/diarista.png` },
  { name: "Doméstica", icon: Sparkles, image: `${CAT}/domestica.png` },
  { name: "Babá", icon: Baby, image: `${CAT}/baba.png` },
  { name: "Cuidador(a)", icon: Baby, image: `${CAT}/cuidador.png` },
  { name: "Pintor", icon: PaintRoller, image: `${CAT}/pintor.png` },
  { name: "Reformas", icon: Hammer, image: `${CAT}/reforma.png` },
  { name: "Jardinagem", icon: Trees, image: `${CAT}/jardinagem.png` },
  { name: "Montagem de móveis", icon: Hammer, image: `${CAT}/montagem.png` },
  { name: "Outras", icon: LayoutGrid, image: `${CAT}/outras.png` },
];
