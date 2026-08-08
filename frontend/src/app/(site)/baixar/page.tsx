/**
 * `/baixar` — página dedicada ao download do app.
 *
 * Enquanto o app não está publicado, mostra os selos em "Em breve" e captura
 * o e-mail de interessados ("Avise-me"). Quando publicar, os selos das lojas
 * viram links reais (ver `site-config.ts`).
 */

import type { Metadata } from "next";

import { AppStoreBadges } from "@/modules/site/app-store-badges";
import { NotifyMeForm } from "@/modules/site/notify-me-form";
import { APP_COMING_SOON } from "@/modules/site/site-config";
import { Container, HeroFigure } from "@/modules/site/marketing-ui";

export const metadata: Metadata = {
  title: "Baixar o app | FazTudo",
  description:
    "O app FazTudo está chegando às lojas. Cadastre seu e-mail e seja avisado no lançamento.",
};

export default function BaixarPage() {
  return (
    <section className="bg-gradient-to-br from-primary to-blue-900 text-white">
      <Container className="flex flex-col items-center py-16 text-center sm:py-20">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {APP_COMING_SOON ? "O app FazTudo está chegando" : "Baixe o app FazTudo"}
        </h1>
        <p className="mt-4 max-w-lg text-blue-100 sm:text-lg">
          {APP_COMING_SOON
            ? "Cadastre seu e-mail e seja avisado assim que lançarmos nas lojas."
            : "Leve a FazTudo no bolso — disponível para iOS e Android."}
        </p>

        <HeroFigure
          src="/brand/mascote-trio.webp"
          alt="Equipe FazTudo"
          tone="dark"
          priority
          className="mt-8"
        />

        <AppStoreBadges tone="light" className="mt-8 justify-center" />

        {APP_COMING_SOON ? (
          <div className="mt-8 w-full max-w-md">
            <NotifyMeForm source="baixar" tone="dark" />
          </div>
        ) : null}
      </Container>
    </section>
  );
}
