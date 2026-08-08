/**
 * `/baixar` — página dedicada ao download do app.
 *
 * Enquanto o app não está publicado, mostra os selos em "Em breve" e captura
 * o e-mail de interessados ("Avise-me"). Quando publicar, os selos das lojas
 * viram links reais (ver `site-config.ts`).
 */

import type { Metadata } from "next";
import { Share, Plus } from "lucide-react";

import { AppStoreBadges } from "@/modules/site/app-store-badges";
import { ApkDownloadButton } from "@/modules/site/apk-download";
import { NotifyMeForm } from "@/modules/site/notify-me-form";
import { APK_AVAILABLE, APP_COMING_SOON } from "@/modules/site/site-config";
import { Container, HeroFigure } from "@/modules/site/marketing-ui";

export const metadata: Metadata = {
  title: "Baixar o app | FazTudo",
  description:
    "Baixe o app do FazTudo para Android agora (APK). Em breve também nas lojas.",
};

export default function BaixarPage() {
  return (
    <section className="bg-gradient-to-br from-primary to-blue-900 text-white">
      <Container className="flex flex-col items-center py-16 text-center sm:py-20">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Baixe o app FazTudo
        </h1>
        <p className="mt-4 max-w-lg text-blue-100 sm:text-lg">
          Disponível agora para <strong>Android</strong> (baixe o app) e{" "}
          <strong>iPhone</strong> (adicione pela tela de início). Nas lojas, em
          breve.
        </p>

        <HeroFigure
          src="/brand/mascote-trio.webp"
          alt="Equipe FazTudo"
          tone="dark"
          priority
          className="mt-8"
        />

        {/* Android — download direto (APK) */}
        {APK_AVAILABLE ? (
          <div className="mt-8 flex flex-col items-center">
            <ApkDownloadButton tone="dark" />
          </div>
        ) : null}

        {/* iPhone — instalar como PWA pelo Safari */}
        <div className="mt-6 w-full max-w-md rounded-2xl bg-white/10 p-5 text-left ring-1 ring-white/15">
          <p className="text-sm font-bold">No iPhone (iOS)</p>
          <ol className="mt-3 space-y-2 text-sm text-blue-100/90">
            <li className="flex gap-2">
              <span className="font-bold text-brand">1.</span>
              <span>
                Abra <strong>www.faztudoapp.com.br</strong> no{" "}
                <strong>Safari</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-brand">2.</span>
              <span className="inline-flex flex-wrap items-center gap-1">
                Toque em <strong>Compartilhar</strong>
                <Share className="inline h-4 w-4" aria-hidden />.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-brand">3.</span>
              <span className="inline-flex flex-wrap items-center gap-1">
                Escolha <strong>“Adicionar à Tela de Início”</strong>
                <Plus className="inline h-4 w-4" aria-hidden />.
              </span>
            </li>
          </ol>
          <p className="mt-3 text-xs text-blue-100/70">
            Pronto — o FazTudo abre como um app. Versão na App Store em breve.
          </p>
        </div>

        {/* Lojas oficiais (em breve) */}
        <div className="mt-10 flex flex-col items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-100/70">
            Em breve nas lojas oficiais
          </p>
          <AppStoreBadges tone="light" className="justify-center" />
        </div>

        {/* iOS — avise-me */}
        {APP_COMING_SOON ? (
          <div className="mt-8 w-full max-w-md">
            <p className="mb-2 text-sm text-blue-100/90">
              É usuário de iPhone? Avisamos você no lançamento:
            </p>
            <NotifyMeForm source="baixar" tone="dark" />
          </div>
        ) : null}
      </Container>
    </section>
  );
}
