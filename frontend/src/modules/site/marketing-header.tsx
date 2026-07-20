"use client";

/**
 * `MarketingHeader` — cabeçalho do site institucional (público).
 *
 * Wordmark + navegação + CTAs ("Entrar" e "Baixar o app"). No mobile a
 * navegação vira um menu retrátil (hambúrguer). Distinto do `SiteHeader` do
 * app (que traz a navegação por papel); este é só para as páginas de marketing.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SITE_NAV } from "@/modules/site/site-config";

/** Wordmark clicável (símbolo + "FazTudo"). */
function Wordmark() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2 text-xl font-extrabold tracking-tight"
      aria-label="FazTudo — início"
    >
      <Image src="/brand/symbol.png" width={28} height={28} alt="" priority />
      <span>
        <span className="text-primary">Faz</span>
        <span className="italic text-brand">Tudo</span>
      </span>
    </Link>
  );
}

export function MarketingHeader() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = React.useState(false);

  // Fecha o menu ao trocar de rota.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Wordmark />

        {/* Navegação desktop */}
        <nav className="ml-6 hidden flex-1 items-center gap-1 lg:flex">
          {SITE_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                isActive(link.href) && "text-primary"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* CTAs desktop */}
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Entrar
          </Link>
          <Link
            href="/baixar"
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-brand text-brand-foreground hover:bg-brand/90"
            )}
          >
            Baixar o app
          </Link>
        </div>

        {/* Botão do menu mobile */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto lg:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </Button>
      </div>

      {/* Painel mobile */}
      {open ? (
        <div className="border-t bg-background lg:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {SITE_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm font-medium",
                  isActive(link.href)
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-accent"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t pt-3">
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              >
                Entrar
              </Link>
              <Link
                href="/baixar"
                className={cn(
                  buttonVariants(),
                  "w-full bg-brand text-brand-foreground hover:bg-brand/90"
                )}
              >
                Baixar o app
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
