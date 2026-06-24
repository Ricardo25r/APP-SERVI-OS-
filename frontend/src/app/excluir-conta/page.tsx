/**
 * Página pública **Excluir conta** (`/excluir-conta`).
 *
 * URL pública exigida pela Google Play (e boa prática LGPD): explica como
 * excluir a conta e o que é apagado/retido. A exclusão em si é feita logado,
 * em Perfil → "Excluir minha conta".
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Excluir conta — FazTudo",
  description:
    "Como excluir sua conta do FazTudo e o que acontece com os seus dados.",
};

export default function ExcluirContaPage() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Excluir sua conta
        </h1>
        <p className="text-sm text-muted-foreground">
          Você pode excluir sua conta do FazTudo a qualquer momento, direto pelo
          app.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="text-base font-bold text-foreground">Como excluir</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Entre na sua conta no app ou no site.</li>
          <li>
            Acesse <span className="font-medium text-foreground">Perfil</span>.
          </li>
          <li>
            Toque em{" "}
            <span className="font-medium text-foreground">
              “Excluir minha conta”
            </span>{" "}
            no fim da tela.
          </li>
          <li>
            Confirme digitando{" "}
            <span className="font-medium text-foreground">EXCLUIR</span>.
          </li>
        </ol>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="text-base font-bold text-foreground">
          O que acontece com seus dados
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Apagados:</span> nome,
            e-mail, telefone, documento, foto de perfil e documentos de
            verificação (KYC). As sessões são encerradas na hora.
          </li>
          <li>
            <span className="font-medium text-foreground">Cancelados:</span>{" "}
            pedidos em aberto.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Retidos de forma anonimizada:
            </span>{" "}
            registros de transações e avaliações, sem identificar você, quando a
            lei exige a guarda.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          A exclusão é permanente e não pode ser desfeita.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        Não consegue acessar sua conta? Escreva para{" "}
        <a
          href="mailto:inovalaserariquemes@gmail.com"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          inovalaserariquemes@gmail.com
        </a>{" "}
        que excluímos para você. Veja também a{" "}
        <Link
          href="/politica-de-privacidade"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Política de Privacidade
        </Link>
        .
      </p>
    </main>
  );
}
