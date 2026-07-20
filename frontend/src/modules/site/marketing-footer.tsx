/**
 * `MarketingFooter` — rodapé do site institucional.
 *
 * Fundo azul-marinho (`blue-900`), wordmark, grupos de links, selos das lojas
 * (em "Em breve") e barra inferior com redes sociais. Componente estático
 * (Server Component) — cores sempre via token.
 */

import Image from "next/image";
import Link from "next/link";
import { Instagram, Facebook, MessageCircle } from "lucide-react";

import { AppStoreBadges } from "@/modules/site/app-store-badges";
import { FOOTER_GROUPS } from "@/modules/site/site-config";

export function MarketingFooter() {
  const year = 2026; // build estático — data fixa do ano de lançamento

  return (
    <footer className="bg-blue-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.4fr]">
          {/* Marca */}
          <div>
            <div className="flex items-center gap-2 text-lg font-extrabold">
              <Image
                src="/brand/symbol.png"
                width={26}
                height={26}
                alt=""
                className="brightness-0 invert"
              />
              <span>
                <span>Faz</span>
                <span className="italic text-brand">Tudo</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-blue-100/80">
              O marketplace que conecta você a profissionais de confiança perto
              de você.
            </p>
          </div>

          {/* Grupos de links */}
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-bold">{group.title}</h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-blue-100/80 transition-colors hover:text-brand"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Baixe o app */}
          <div className="sm:col-span-2 lg:col-span-1">
            <h3 className="text-sm font-bold">Baixe o app</h3>
            <AppStoreBadges tone="light" className="mt-4" />
          </div>
        </div>

        {/* Barra inferior */}
        <div className="mt-10 flex flex-col items-center gap-4 border-t border-white/10 pt-6 text-sm text-blue-100/70 sm:flex-row sm:justify-between">
          <span>© {year} FazTudo. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            <a
              href="#"
              aria-label="Instagram"
              className="transition-colors hover:text-brand"
            >
              <Instagram className="h-5 w-5" aria-hidden />
            </a>
            <a
              href="#"
              aria-label="Facebook"
              className="transition-colors hover:text-brand"
            >
              <Facebook className="h-5 w-5" aria-hidden />
            </a>
            <a
              href="#"
              aria-label="WhatsApp"
              className="transition-colors hover:text-brand"
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
