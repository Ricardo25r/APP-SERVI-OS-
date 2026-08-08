/**
 * `/baixar` — página dedicada ao download do app.
 *
 * Enquanto o app não está publicado, mostra os selos em "Em breve" e captura
 * o e-mail de interessados ("Avise-me"). Quando publicar, os selos das lojas
 * viram links reais (ver `site-config.ts`).
 */

import type { Metadata } from "next";

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
          Disponível agora para <strong>Android</strong>. Para iPhone, cadastre
          seu e-mail e avisamos no lançamento.
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
