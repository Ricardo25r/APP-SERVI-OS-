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

/** Telas full-screen com header próprio (não mostram a barra de marketing). */
const AUTH_ROUTES = [
  "/splash",
  "/onboarding",
  "/login",
  "/register",
  "/escolha-perfil",
  "/recuperar-senha",
];

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
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-xl font-extrabold tracking-tight"
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

        {/* Evita flash de conteúdo errado antes da hidratação. */}
        {!hasHydrated ? (
          <span className="flex-1" />
        ) : isAuthenticated && user ? (
          <>
            {/* Links (desktop); no mobile a navegação fica na BottomNav. */}
            <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "shrink-0"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Usuário + Sair — sempre visíveis à direita. */}
            <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-2">
              <div className="hidden items-center gap-2 sm:flex">
                <span className="max-w-[9rem] truncate text-sm font-medium">
                  {user.name}
                </span>
                {role ? (
                  <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>
                ) : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="shrink-0"
              >
                Sair
              </Button>
            </div>
          </>
        ) : (
          <div className="ml-auto flex shrink-0 items-center gap-2">
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
          </div>
        )}
      </div>
    </header>
  );
}
