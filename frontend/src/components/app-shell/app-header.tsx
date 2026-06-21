"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/ui/avatar";
import { fetchUnreadCount } from "@/modules/notifications/api";

/**
 * `AppHeader` — barra azul (`bg-primary`) sticky no topo, em 2 modos:
 *
 * - `mode="home"`: wordmark `Faz`+`Tudo` (itálico laranja) à esquerda,
 *   sino de notificações (link `/notificacoes`) e `Avatar` à direita.
 * - `mode="title"`: botão voltar (`ChevronLeft`) + título centralizado.
 *
 * Componente visual — não controla rotas; o consumidor decide quando usá-lo.
 * Complementa o `SiteHeader` (que segue como nav do topo no desktop).
 */
export interface AppHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Modo de exibição. */
  mode?: "home" | "title";
  /** Título centralizado (modo `title`). */
  title?: React.ReactNode;
  /** Destino do botão voltar; se ausente usa `router.back()`. */
  backHref?: string;
  /** Slot de ação à direita (modo `title`). */
  action?: React.ReactNode;
  /** Exibe o sino de notificações (modo `home`). */
  showNotifications?: boolean;
}

function Wordmark() {
  return (
    <Link
      href="/"
      className="text-xl font-extrabold tracking-tight text-primary-foreground"
    >
      Faz
      <span className="italic text-brand">Tudo</span>
    </Link>
  );
}

const AppHeader = React.forwardRef<HTMLElement, AppHeaderProps>(
  (
    {
      className,
      mode = "home",
      title,
      backHref,
      action,
      showNotifications = true,
      ...props
    },
    ref
  ) => {
    const router = useRouter();
    const { user } = useAuth();
    const [unread, setUnread] = React.useState(0);
    const showBell = mode === "home" && showNotifications;

    // Contador de não lidas para o sino (polling leve quando autenticado).
    React.useEffect(() => {
      if (!showBell || !user) return;
      let active = true;
      const tick = () =>
        fetchUnreadCount()
          .then((c) => {
            if (active) setUnread(c);
          })
          .catch(() => {});
      void tick();
      const id = setInterval(() => void tick(), 30000);
      return () => {
        active = false;
        clearInterval(id);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showBell, user?.id]);

    const handleBack = () => {
      if (backHref) {
        router.push(backHref);
      } else {
        router.back();
      }
    };

    return (
      <header
        ref={ref}
        className={cn(
          "sticky top-0 z-40 w-full bg-primary text-primary-foreground",
          className
        )}
        {...props}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          {mode === "title" ? (
            <>
              {backHref ? (
                <Link
                  href={backHref}
                  aria-label="Voltar"
                  className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Voltar"
                  className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
              )}
              <h1 className="flex-1 truncate text-center text-base font-bold">
                {title}
              </h1>
              <div className="flex h-9 w-9 items-center justify-end">
                {action}
              </div>
            </>
          ) : (
            <>
              <Wordmark />
              <div className="ml-auto flex items-center gap-1">
                {showNotifications ? (
                  <Link
                    href="/notificacoes"
                    aria-label="Notificações"
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10"
                  >
                    <Bell className="h-5 w-5" aria-hidden />
                    {unread > 0 ? (
                      <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-brand-foreground">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    ) : null}
                  </Link>
                ) : null}
                <Link href="/profile" aria-label="Meu perfil" className="ml-1">
                  <Avatar
                    name={user?.name}
                    size="sm"
                    className="bg-primary-foreground/15 text-primary-foreground ring-2 ring-primary-foreground/20"
                  />
                </Link>
                {action}
              </div>
            </>
          )}
        </div>
      </header>
    );
  }
);
AppHeader.displayName = "AppHeader";

export { AppHeader };
