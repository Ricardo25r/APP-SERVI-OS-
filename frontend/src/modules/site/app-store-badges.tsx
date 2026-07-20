/**
 * `AppStoreBadges` — selos "Baixar na App Store / Google Play".
 *
 * Enquanto o app não está publicado (`status: "coming_soon"`), os selos
 * aparecem desabilitados com o rótulo "Em breve". Quando `url` estiver
 * preenchida e `status: "live"`, viram links reais para as lojas.
 *
 * Componente puramente apresentacional (sem hooks) — pode ser usado tanto em
 * Server quanto em Client Components. Cores sempre via token do design system.
 */

import { cn } from "@/lib/utils";
import { APP_STORE, GOOGLE_PLAY, type StoreInfo } from "@/modules/site/site-config";

/** Glifo da Apple. */
function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.5 1.5c.1 1.2-.4 2.4-1.1 3.3-.8.9-2 1.6-3.1 1.5-.1-1.2.5-2.4 1.2-3.2.8-.9 2.1-1.6 3-1.6zM20.9 17.6c-.6 1.3-.9 1.9-1.7 3-1.1 1.6-2.6 3.6-4.5 3.6-1.7 0-2.1-1.1-4.4-1.1-2.2 0-2.7 1.1-4.4 1.1-1.9 0-3.3-1.9-4.4-3.4C-.9 17.4-.6 11 2.6 8.2c1.1-1 2.4-1.5 3.6-1.5 1.5 0 2.4 1 4.1 1 1.6 0 2.3-1 4.1-1 1.1 0 2.6.4 3.6 1.5-3.2 1.9-2.6 6.7 1 8.9z" />
    </svg>
  );
}

/** Glifo do Google Play (triângulo). */
function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M3.6 2.3a1 1 0 0 0-.6.9v17.6a1 1 0 0 0 .6.9l9.8-9.7L3.6 2.3zM14.7 12.9l2.9 2.9-11.3 6.5 8.4-9.4zm0-1.8L6.3 1.7l11.3 6.5-2.9 2.9zm1.3 1l3.9-2.2c.6-.4.6-1.4 0-1.8l-.1-.1-3.8 2.1 0 0 3.8 2.1z" />
    </svg>
  );
}

interface BadgeProps {
  store: StoreInfo;
  glyph: React.ReactNode;
  /** Variante de contraste: sobre fundo claro ou sobre fundo escuro (herói). */
  tone?: "dark" | "light";
  className?: string;
}

function StoreBadge({ store, glyph, tone = "dark", className }: BadgeProps) {
  const comingSoon = store.status === "coming_soon" || !store.url;

  const base =
    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 transition-colors";
  const skin =
    tone === "light"
      ? "bg-white/15 text-white hover:bg-white/25"
      : "bg-blue-900 text-white hover:bg-blue-900/90";

  const content = (
    <>
      <span className="shrink-0 [&>svg]:h-5 [&>svg]:w-5">{glyph}</span>
      <span className="flex flex-col text-left leading-tight">
        <span className="text-[0.65rem] font-medium opacity-80">
          {comingSoon ? "Em breve na" : "Baixar na"}
        </span>
        <span className="text-sm font-bold">{store.label}</span>
      </span>
    </>
  );

  if (comingSoon) {
    return (
      <span
        className={cn(base, skin, "cursor-default opacity-60", className)}
        aria-disabled
        title={`${store.label} — em breve`}
      >
        {content}
      </span>
    );
  }

  return (
    <a
      href={store.url!}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(base, skin, className)}
    >
      {content}
    </a>
  );
}

export interface AppStoreBadgesProps {
  tone?: "dark" | "light";
  className?: string;
}

/** Par de selos App Store + Google Play. */
export function AppStoreBadges({ tone = "dark", className }: AppStoreBadgesProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <StoreBadge store={APP_STORE} glyph={<AppleGlyph />} tone={tone} />
      <StoreBadge store={GOOGLE_PLAY} glyph={<PlayGlyph />} tone={tone} />
    </div>
  );
}
