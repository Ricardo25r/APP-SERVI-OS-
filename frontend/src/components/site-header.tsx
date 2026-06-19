"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types";

const ROLE_LABEL: Record<UserRole, string> = {
  customer: "Contratante",
  professional: "Profissional",
  admin: "Admin",
};

interface NavLink {
  href: string;
  label: string;
}

const NAV_BY_ROLE: Record<UserRole, NavLink[]> = {
  customer: [
    { href: "/leads", label: "Minhas solicitações" },
    { href: "/leads/new", label: "Nova solicitação" },
    { href: "/conversas", label: "Conversas" },
    { href: "/avaliacoes", label: "Avaliações" },
    { href: "/ranking", label: "Ranking" },
    { href: "/profile", label: "Meu perfil" },
    { href: "/configuracoes", label: "Configurações" },
    { href: "/suporte", label: "Suporte" },
  ],
  professional: [
    { href: "/marketplace", label: "Oportunidades" },
    { href: "/credits", label: "Créditos" },
    { href: "/conversas", label: "Conversas" },
    { href: "/avaliacoes", label: "Avaliações" },
    { href: "/gamificacao", label: "Nível" },
    { href: "/ranking", label: "Ranking" },
    { href: "/profile", label: "Meu perfil" },
    { href: "/configuracoes", label: "Configurações" },
    { href: "/suporte", label: "Suporte" },
  ],
  admin: [
    { href: "/admin", label: "Painel" },
    { href: "/admin/usuarios", label: "Usuários" },
    { href: "/admin/leads", label: "Leads" },
    { href: "/admin/financeiro", label: "Financeiro" },
    { href: "/admin/categorias", label: "Categorias" },
    { href: "/admin/creditos", label: "Créditos" },
    { href: "/admin/auditoria", label: "Auditoria" },
  ],
};

/** Rotas de autenticação têm header próprio (painel azul / AppHeader). */
const AUTH_ROUTES = ["/login", "/register", "/escolha-perfil", "/recuperar-senha"];

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { user, role, isAuthenticated, hasHydrated, logout } = useAuth();

  // Não mostrar a barra de marketing nas telas de auth (evita header duplicado).
  if (AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const links = role ? NAV_BY_ROLE[role] : [];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-extrabold tracking-tight"
        >
          <Image
            src="/brand/symbol.png"
            width={28}
            height={28}
            alt="FazTudo"
            priority
          />
          <span>
            <span className="text-primary">Faz</span>
            <span className="italic text-brand">Tudo</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {/* Evita flash de conteúdo errado antes da hidratação. */}
          {!hasHydrated ? null : isAuthenticated && user ? (
            <>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" })
                  )}
                >
                  {link.label}
                </Link>
              ))}

              <div className="ml-2 hidden items-center gap-2 sm:flex">
                <span className="text-sm font-medium">{user.name}</span>
                {role ? (
                  <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>
                ) : null}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="ml-2"
              >
                Sair
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Cadastrar
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
