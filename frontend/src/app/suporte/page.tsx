/**
 * Tela de **Suporte** (`/suporte`) — Tela 22 dos mockups.
 *
 * Protegida por `useRequireAuth()`. Estrutura fiel ao mockup:
 * - Cartão de boas-vindas com ilustração (mascote) — "Como podemos te ajudar?".
 * - Lista de ações (FAQ, abrir chamado, falar com suporte) em estilo de lista.
 * - **Perguntas frequentes** (accordion simples via `<details>` — sem libs).
 * - **Outros canais de atendimento**: WhatsApp / E-mail com botões + status
 *   "Online" e o horário de atendimento.
 *
 * Conteúdo estático em PT-BR (placeholder). Sem chamadas ao backend.
 */
"use client";

import Image from "next/image";
import {
  HelpCircle,
  MessageSquarePlus,
  Headphones,
  MessageCircle,
  Mail,
  Clock,
  ChevronDown,
} from "lucide-react";

import { useRequireAuth } from "@/hooks/use-auth";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { SectionHeader } from "@/components/ui/section-header";
import { SettingsRow, SettingsRowList } from "@/components/ui/settings-row";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/modules/profile/feedback";
import { SupportTicketSection } from "@/modules/support/ticket-section";

/** Telefone/e-mail de contato (placeholder — ajustar quando houver oficiais). */
const WHATSAPP_NUMBER = "5569999999999";
const WHATSAPP_DISPLAY = "(69) 99999-9999";
const SUPPORT_EMAIL = "suporte@faztudo.com.br";

const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "Como funcionam os créditos?",
    a: "Profissionais usam créditos para desbloquear o contato dos leads (solicitações). Você compra pacotes de créditos na carteira e cada lead tem um custo conforme a categoria.",
  },
  {
    q: "Como crio uma solicitação de serviço?",
    a: "Como contratante, acesse 'Nova solicitação', escolha a categoria, descreva o que precisa e publique. Profissionais próximos receberão sua solicitação.",
  },
  {
    q: "Como recebo leads na minha região?",
    a: "Mantenha seu perfil profissional completo, selecione suas categorias de atuação e defina cidade e raio de atendimento. Você passará a receber leads compatíveis.",
  },
  {
    q: "Como avalio um profissional ou contratante?",
    a: "Após a conclusão do serviço, a avaliação fica disponível na seção 'Avaliações'. Sua nota ajuda a manter a comunidade confiável.",
  },
  {
    q: "Esqueci minha senha. E agora?",
    a: "Na tela de login, use a opção de recuperação de senha. Você receberá instruções no e-mail cadastrado.",
  },
];

export default function SuportePage() {
  const { user, isAuthenticated, hasHydrated } = useRequireAuth();

  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <LoadingState label="Carregando..." />
      </main>
    );
  }

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}`;
  const emailHref = `mailto:${SUPPORT_EMAIL}`;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Suporte
        </h1>
        <p className="text-sm text-muted-foreground">
          Estamos aqui para ajudar você.
        </p>
      </header>

      {/* Cartão de boas-vindas com mascote (ilustração) */}
      <Card className="overflow-hidden border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-4 p-5 sm:p-6">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">
              Como podemos te ajudar?
            </h2>
            <p className="text-sm text-muted-foreground">
              Encontre respostas rápidas no FAQ ou fale com nossa equipe em
              qualquer canal abaixo.
            </p>
          </div>
          <Image
            src="/brand/mascote-tudo.png"
            width={96}
            height={96}
            alt="Mascote FazTudo"
            className="h-20 w-20 shrink-0 object-contain sm:h-24 sm:w-24"
          />
        </CardContent>
      </Card>

      {/* Formulário real de chamado + meus chamados */}
      <SupportTicketSection />

      {/* Atalhos de atendimento */}
      <Card className="overflow-hidden p-2">
        <SettingsRowList>
          <SettingsRow
            icon={HelpCircle}
            iconColor="blue"
            title="Perguntas frequentes (FAQ)"
            description="Encontre respostas para as dúvidas mais comuns"
            href="#faq"
          />
          <SettingsRow
            icon={MessageSquarePlus}
            iconColor="orange"
            title="Abrir chamado"
            description="Relate um problema específico para nossa equipe"
            href="#abrir-chamado"
          />
          <SettingsRow
            icon={Headphones}
            iconColor="green"
            title="Falar com o suporte"
            description="Atendimento em horário comercial"
            href={whatsappHref}
            trailing={<StatusBadge label="Online" variant="success" />}
          />
        </SettingsRowList>
      </Card>

      {/* FAQ — accordion simples (sem libs, via <details>) */}
      <section id="faq" className="scroll-mt-20 space-y-3">
        <SectionHeader title="Perguntas frequentes" as="h2" />
        <div className="space-y-2">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border bg-card px-4 py-3 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
                <span>{item.q}</span>
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Outros canais de atendimento */}
      <section className="space-y-3">
        <SectionHeader title="Outros canais de atendimento" as="h2" />

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <IconChip icon={MessageCircle} color="green" size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">WhatsApp</p>
              <p className="truncate text-xs text-muted-foreground">
                {WHATSAPP_DISPLAY}
              </p>
            </div>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "sm" })}
            >
              Abrir
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <IconChip icon={Mail} color="blue" size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">E-mail</p>
              <p className="truncate text-xs text-muted-foreground">
                {SUPPORT_EMAIL}
              </p>
            </div>
            <a
              href={emailHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Enviar
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <IconChip icon={Clock} color="orange" size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Horário de atendimento</p>
              <p className="text-xs text-muted-foreground">
                Segunda a sexta, das 8h às 18h (horário de Brasília)
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
