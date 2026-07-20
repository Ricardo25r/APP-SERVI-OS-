/**
 * `/categorias` — catálogo de serviços (bom para SEO). Busca no client.
 */

import type { Metadata } from "next";

import { Container, Section } from "@/modules/site/marketing-ui";
import { CategorySearch } from "@/modules/site/category-search";

export const metadata: Metadata = {
  title: "Categorias de serviços | FazTudo",
  description:
    "Eletricista, encanador, diarista, babá, pintor, reformas e muito mais. Encontre o profissional certo na FazTudo.",
};

export default function CategoriasPage() {
  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Todas as categorias
          </h1>
          <p className="mt-3 text-muted-foreground">
            Escolha um serviço e crie sua solicitação gratuita.
          </p>
        </div>
        <div className="mt-10">
          <CategorySearch />
        </div>
      </Container>
    </Section>
  );
}
