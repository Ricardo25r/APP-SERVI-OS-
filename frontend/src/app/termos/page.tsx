/**
 * **Termos de Uso** (`/termos`) — página pública.
 *
 * Renderiza o documento completo (`modules/legal/terms`) com o renderizador de
 * markdown mínimo. O aceite é registrado pelo banner `TermsGate`.
 */
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { SimpleMarkdown } from "@/components/simple-markdown";
import { TERMS_MARKDOWN } from "@/modules/legal/terms";

export const metadata = {
  title: "Termos de Uso — FazTudo",
};

export default function TermosPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Voltar
      </Link>

      <SimpleMarkdown content={TERMS_MARKDOWN} />

      <p className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
        Este documento reflete as melhores práticas de mercado e a legislação
        brasileira aplicável; recomenda-se revisão por advogado(a) antes de
        considerá-lo definitivo.
      </p>
    </main>
  );
}
