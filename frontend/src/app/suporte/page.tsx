/**
 * Tela de **Suporte** (`/suporte`) — Tela 39 dos mockups.
 *
 * Protegida por `useRequireAuth()`. Estrutura fiel à referência:
 * - Cartão de boas-vindas com saudação personalizada + **atendente** (mascote).
 * - Barra de busca que filtra as dúvidas frequentes.
 * - **Dúvidas frequentes**: grade de tópicos (filtro) + acordeão de perguntas.
 * - Ações: Fale com o suporte (WhatsApp), Abrir chamado (form real), Central de
 *   ajuda (FAQ).
 * - **Abrir um chamado** (form real, via `SupportTicketSection`) + Meus chamados.
 * - Outros canais (WhatsApp / E-mail / Horário).
 */
"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  HelpCircle,
  Mail,
  MessageCircle,
  MessageSquarePlus,
  Search,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { SettingsRow, SettingsRowList } from "@/components/ui/settings-row";
import { LoadingState } from "@/modules/profile/feedback";
import { SupportTicketSection } from "@/modules/support/ticket-section";

/** Contatos de suporte (placeholder — ajustar quando houver oficiais). */
const WHATSAPP_NUMBER = "5569999999999";
const WHATSAPP_DISPLAY = "(69) 99999-9999";
const SUPPORT_EMAIL = "suporte@faztudo.com.br";

type ChipColor = "blue" | "orange" | "green" | "default";

const TOPICS: ReadonlyArray<{
  id: string;
  icon: LucideIcon;
  color: ChipColor;
  title: string;
  desc: string;
}> = [
  {
    id: "como-funciona",
    icon: HelpCircle,
    color: "blue",
    title: "Como funciona",
    desc: "Entenda como a plataforma funciona",
  },
  {
    id: "pagamentos",
    icon: CreditCard,
    color: "green",
    title: "Pagamentos",
    desc: "Dúvidas sobre créditos e reembolsos",
  },
  {
    id: "conta",
    icon: UserCircle,
    color: "orange",
    title: "Conta e perfil",
    desc: "Ajuste sua conta e configurações",
  },
  {
    id: "servicos",
    icon: ClipboardList,
    color: "blue",
    title: "Solicitações e serviços",
    desc: "Tudo sobre solicitações e contratação",
  },
];

const FAQ: ReadonlyArray<{ topic: string; q: string; a: string }> = [
  {
    topic: "como-funciona",
    q: "Como funciona o FazTudo?",
    a: "O FazTudo conecta contratantes a profissionais locais. Contratantes publicam solicitações e os profissionais desbloqueiam o contato usando créditos.",
  },
  {
    topic: "pagamentos",
    q: "Como funcionam os créditos?",
    a: "Profissionais usam créditos para desbloquear o contato dos leads. Você compra pacotes na carteira e cada lead tem um custo conforme a categoria.",
  },
  {
    topic: "pagamentos",
    q: "Como compro créditos?",
    a: "Acesse a carteira (Créditos), escolha um pacote e finalize o pagamento. Os créditos entram na sua conta na hora.",
  },
  {
    topic: "conta",
    q: "Como edito meu perfil?",
    a: "Em Configurações > Editar perfil você atualiza seus dados, foto, categorias e área de atuação.",
  },
  {
    topic: "conta",
    q: "Esqueci minha senha. E agora?",
    a: "Na tela de login, use a opção de recuperação de senha. Você receberá instruções no e-mail cadastrado.",
  },
  {
    topic: "servicos",
    q: "Como crio uma solicitação de serviço?",
    a: "Como contratante, acesse 'Nova solicitação', escolha a categoria, descreva o que precisa e publique. Profissionais próximos receberão sua solicitação.",
  },
  {
    topic: "servicos",
    q: "Como recebo leads na minha região?",
    a: "Mantenha seu perfil completo, selecione suas categorias e defina cidade e raio de atendimento. Você passará a receber leads compatíveis.",
  },
  {
    topic: "servicos",
    q: "Como avalio um profissional ou contratante?",
    a: "Após a conclusão do serviço, a avaliação fica disponível na seção 'Avaliações'. Sua nota ajuda a manter a comunidade confiável.",
  },
];

export default function SuportePage() {
  const { user, isAuthenticated, hasHydrated } = useRequireAuth();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);

  const filteredFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ.filter(
      (f) =>
        (!topic || f.topic === topic) &&
        (!q ||
          f.q.toLowerCase().includes(q) ||
          f.a.toLowerCase().includes(q))
    );
  }, [query, topic]);

  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <LoadingState label="Carregando..." />
      </main>
    );
  }

  const firstName = user.name?.trim().split(/\s+/)[0] ?? "";
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}`;
  const emailHref = `mailto:${SUPPORT_EMAIL}`;
  const hasFilter = Boolean(topic || query.trim());

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Suporte</h1>

      {/* Boas-vindas com o atendente */}
      <Card className="overflow-hidden border-primary/15 bg-primary/5">
        <CardContent className="relative min-h-[150px] p-5 pr-28 sm:p-6 sm:pr-36">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">
            Olá, {firstName}!
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Como podemos te ajudar hoje?
          </p>
          <Image
            src="/brand/atendente-suporte.png"
            alt="Atendente FazTudo"
            width={206}
            height={306}
            priority
            className="pointer-events-none absolute bottom-0 right-2 h-auto w-24 select-none object-contain sm:right-4 sm:w-28"
          />
        </CardContent>
      </Card>

      {/* Busca */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Digite sua dúvida ou problema"
          className="pl-9"
          aria-label="Buscar nas dúvidas frequentes"
        />
      </div>

      {/* Dúvidas frequentes */}
      <section id="faq" className="scroll-mt-20 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold tracking-tight sm:text-lg">
            Dúvidas frequentes
          </h2>
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setTopic(null);
                setQuery("");
              }}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Ver todas
            </button>
          )}
        </div>

        {/* Grade de tópicos (filtro) */}
        <div className="grid grid-cols-2 gap-3">
          {TOPICS.map((t) => {
            const active = topic === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopic((cur) => (cur === t.id ? null : t.id))}
                aria-pressed={active}
                className={cn(
                  "flex items-start gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "border-primary ring-1 ring-primary"
                )}
              >
                <IconChip icon={t.icon} color={t.color} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {t.title}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {t.desc}
                  </p>
                </div>
                <ChevronRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </button>
            );
          })}
        </div>

        {/* Acordeão de perguntas (filtrado por busca/tópico) */}
        <div className="space-y-2 pt-1">
          {filteredFaq.length === 0 ? (
            <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma dúvida encontrada. Tente outra busca ou abra um chamado.
            </p>
          ) : (
            filteredFaq.map((item) => (
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
            ))
          )}
        </div>
      </section>

      {/* Ações de atendimento */}
      <Card className="overflow-hidden p-2">
        <SettingsRowList>
          <SettingsRow
            icon={MessageCircle}
            iconColor="green"
            title="Fale com o suporte"
            description="Nossa equipe está pronta para te atender"
            href={whatsappHref}
            trailing={
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                ~2 min
              </span>
            }
          />
          <SettingsRow
            icon={MessageSquarePlus}
            iconColor="orange"
            title="Abrir chamado"
            description="Descreva seu problema e retornaremos por e-mail"
            href="#abrir-chamado"
          />
          <SettingsRow
            icon={HelpCircle}
            iconColor="blue"
            title="Central de ajuda"
            description="Acesse as dúvidas frequentes e resolva você mesmo"
            href="#faq"
          />
          <SettingsRow
            icon={FileText}
            iconColor="blue"
            title="Termos e privacidade"
            description="Termos de uso e Política de privacidade (LGPD)"
            href="/termos"
          />
        </SettingsRowList>
      </Card>

      {/* Formulário real de chamado + meus chamados */}
      <SupportTicketSection />

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
