/**
 * **Termos de Uso** (`/termos`) — página pública.
 *
 * Texto-base em PT-BR (modelo). Recomenda-se revisão jurídica antes do
 * lançamento público. Só tokens do design system.
 */
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Termos de Uso — FazTudo",
};

const UPDATED = "21 de junho de 2026";

export default function TermosPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/suporte"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Voltar
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Termos de Uso
        </h1>
        <p className="text-sm text-muted-foreground">
          Última atualização: {UPDATED}
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground">
        <section className="space-y-2">
          <h2>1. Aceitação dos termos</h2>
          <p>
            Ao criar uma conta ou utilizar o aplicativo FazTudo, você concorda
            com estes Termos de Uso e com a nossa{" "}
            <Link href="/privacidade" className="font-medium text-primary hover:underline">
              Política de Privacidade
            </Link>
            . Se não concordar, não utilize a plataforma.
          </p>
        </section>

        <section className="space-y-2">
          <h2>2. O que é o FazTudo</h2>
          <p>
            O FazTudo é uma plataforma de <strong>intermediação</strong> que
            conecta <strong>contratantes</strong> (que precisam de um serviço) a{" "}
            <strong>profissionais</strong> (que prestam o serviço). O FazTudo{" "}
            <strong>não presta</strong> os serviços anunciados nem é parte na
            negociação, contratação ou execução entre as partes.
          </p>
        </section>

        <section className="space-y-2">
          <h2>3. Cadastro e conta</h2>
          <p>
            Você é responsável pela veracidade dos dados informados e pela
            segurança das suas credenciais. É proibido criar contas falsas,
            usar dados de terceiros ou compartilhar acesso.
          </p>
        </section>

        <section className="space-y-2">
          <h2>4. Créditos e pagamentos</h2>
          <p>
            Profissionais utilizam <strong>créditos</strong> para desbloquear o
            contato de oportunidades. A compra de créditos é processada por
            provedores de pagamento. Os créditos são pré-pagos e o uso para
            desbloquear um contato não é reembolsável, salvo disposição legal
            ou política específica informada na plataforma.
          </p>
        </section>

        <section className="space-y-2">
          <h2>5. Responsabilidades</h2>
          <p>
            A relação de prestação de serviço ocorre <strong>diretamente</strong>{" "}
            entre contratante e profissional. O FazTudo não se responsabiliza
            pela qualidade, prazos, pagamentos combinados fora da plataforma,
            danos ou prejuízos decorrentes da contratação. Recomendamos sempre
            verificar avaliações e combinar tudo por escrito.
          </p>
        </section>

        <section className="space-y-2">
          <h2>6. Conduta proibida</h2>
          <p>
            É vedado utilizar a plataforma para fins ilícitos, assédio, fraude,
            spam, coleta indevida de dados, ou qualquer atividade que viole leis
            ou direitos de terceiros. O descumprimento pode levar à suspensão ou
            ao encerramento da conta.
          </p>
        </section>

        <section className="space-y-2">
          <h2>7. Avaliações</h2>
          <p>
            As avaliações refletem a opinião dos usuários. Avaliações
            fraudulentas, ofensivas ou manipuladas podem ser removidas e a conta
            responsável, penalizada.
          </p>
        </section>

        <section className="space-y-2">
          <h2>8. Suspensão e encerramento</h2>
          <p>
            Podemos suspender ou encerrar contas que violem estes termos. Você
            pode encerrar sua conta a qualquer momento pelo Suporte.
          </p>
        </section>

        <section className="space-y-2">
          <h2>9. Limitação de responsabilidade</h2>
          <p>
            Na máxima extensão permitida pela lei, o FazTudo não responde por
            danos indiretos, lucros cessantes ou prejuízos decorrentes do uso ou
            da impossibilidade de uso da plataforma.
          </p>
        </section>

        <section className="space-y-2">
          <h2>10. Alterações</h2>
          <p>
            Estes termos podem ser atualizados. Mudanças relevantes serão
            comunicadas no aplicativo. O uso continuado após a atualização
            implica concordância.
          </p>
        </section>

        <section className="space-y-2">
          <h2>11. Contato</h2>
          <p>
            Dúvidas sobre estes termos? Fale com a gente pela{" "}
            <Link href="/suporte" className="font-medium text-primary hover:underline">
              Central de Suporte
            </Link>
            .
          </p>
        </section>

        <p className="rounded-xl border bg-muted/40 p-3 text-xs">
          Este documento é um modelo inicial e deve ser revisado por um
          profissional jurídico antes do lançamento público.
        </p>
      </div>
    </main>
  );
}
