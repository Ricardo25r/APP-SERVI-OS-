/**
 * `/contato` — canais de atendimento + formulário de contato/suporte.
 */

import type { Metadata } from "next";
import Image from "next/image";
import { MessageCircle, Mail, MapPin } from "lucide-react";

import { Container, Section } from "@/modules/site/marketing-ui";
import { ContactForm } from "@/modules/site/contact-form";
import { CONTACT } from "@/modules/site/site-config";

export const metadata: Metadata = {
  title: "Contato | FazTudo",
  description: "Fale com a FazTudo — dúvidas, sugestões ou suporte.",
};

export default function ContatoPage() {
  return (
    <Section className="pb-16">
      <Container className="grid gap-10 lg:grid-cols-2">
        {/* Canais */}
        <div>
          <Image
            src="/brand/atendente-suporte.png"
            width={432}
            height={640}
            alt="Atendimento FazTudo"
            priority
            className="mb-4 h-40 w-auto drop-shadow-xl"
          />
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Fale com a gente
          </h1>
          <p className="mt-3 text-muted-foreground">
            Dúvidas, sugestões ou suporte — estamos por aqui.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            <li>
              <a
                href={`https://wa.me/${CONTACT.whatsappE164}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                  <MessageCircle className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold">
                  WhatsApp: {CONTACT.whatsappDisplay}
                </span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${CONTACT.email}`}
                className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold">{CONTACT.email}</span>
              </a>
            </li>
            <li>
              <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold">{CONTACT.city}</span>
              </div>
            </li>
          </ul>
        </div>

        {/* Formulário */}
        <div>
          <ContactForm />
        </div>
      </Container>
    </Section>
  );
}
