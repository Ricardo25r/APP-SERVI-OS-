/**
 * **Política de Privacidade** (`/privacidade`) — página pública (LGPD).
 *
 * Texto-base em PT-BR (modelo). Recomenda-se revisão jurídica antes do
 * lançamento público. Só tokens do design system.
 */
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Política de Privacidade — FazTudo",
};

const UPDATED = "21 de junho de 2026";

export default function PrivacidadePage() {
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
          Política de Privacidade
        </h1>
        <p className="text-sm text-muted-foreground">
          Última atualização: {UPDATED} · Conforme a LGPD (Lei nº 13.709/2018)
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground">
        <section className="space-y-2">
          <h2>1. Dados que coletamos</h2>
          <p>
            Coletamos os dados que você fornece (nome, e-mail, telefone, foto de
            perfil, cidade/estado, categorias e descrições de serviço) e dados
            de uso (oportunidades visualizadas, compras de crédito, avaliações,
            mensagens) necessários para o funcionamento da plataforma.
          </p>
        </section>

        <section className="space-y-2">
          <h2>2. Para que usamos</h2>
          <p>
            Usamos seus dados para criar e gerenciar sua conta, conectar
            contratantes e profissionais, processar créditos/pagamentos, exibir
            distância e oportunidades compatíveis, prevenir fraudes e melhorar o
            serviço.
          </p>
        </section>

        <section className="space-y-2">
          <h2>3. Compartilhamento</h2>
          <p>
            O contato (telefone/e-mail) só é liberado ao profissional após o
            desbloqueio com créditos. Compartilhamos dados com provedores
            essenciais (pagamento, e-mail, armazenamento e infraestrutura)
            estritamente para operar a plataforma. Não vendemos seus dados.
          </p>
        </section>

        <section className="space-y-2">
          <h2>4. Seus direitos (LGPD)</h2>
          <p>
            Você pode solicitar acesso, correção, exclusão, anonimização,
            portabilidade e informações sobre o tratamento dos seus dados, bem
            como revogar consentimentos. Para exercer seus direitos, fale com a{" "}
            <Link href="/suporte" className="font-medium text-primary hover:underline">
              Central de Suporte
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2>5. Segurança</h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger seus dados
            (senhas com hash, transporte criptografado, controle de acesso).
            Nenhum sistema é 100% infalível, mas trabalhamos para mitigar riscos.
          </p>
        </section>

        <section className="space-y-2">
          <h2>6. Cookies e sessão</h2>
          <p>
            Usamos armazenamento local e cookies estritamente necessários para
            manter sua sessão e preferências. Não usamos cookies de rastreamento
            de terceiros sem o seu consentimento.
          </p>
        </section>

        <section className="space-y-2">
          <h2>7. Retenção</h2>
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa e pelo prazo
            necessário para cumprir obrigações legais. Após a exclusão da conta,
            dados podem ser retidos de forma anonimizada ou pelo período exigido
            por lei.
          </p>
        </section>

        <section className="space-y-2">
          <h2>8. Encarregado de dados (DPO)</h2>
          <p>
            Para assuntos de privacidade e proteção de dados, entre em contato
            pela Central de Suporte. Indicaremos o encarregado responsável
            conforme exigido pela LGPD.
          </p>
        </section>

        <section className="space-y-2">
          <h2>9. Alterações</h2>
          <p>
            Esta política pode ser atualizada. Mudanças relevantes serão
            comunicadas no aplicativo.
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
