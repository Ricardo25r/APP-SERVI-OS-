/**
 * Termos de Uso do FazTudo — conteúdo + metadados.
 *
 * `TERMS_VERSION` deve casar com `settings.TERMS_VERSION` do backend: quando a
 * versão muda, o backend passa a devolver `terms_accepted=false` e o banner de
 * aceite reaparece para todos.
 *
 * ⚠️ Documento redigido espelhando Uber/iFood/99/GetNinjas + legislação BR
 * (CLT, CDC, LGPD, Marco Civil). Recomenda-se revisão por advogado(a) antes de
 * considerá-lo definitivo — a cláusula de não-vínculo não blinda 100% a Justiça
 * do Trabalho (princípio da primazia da realidade).
 */

export const TERMS_VERSION = "2026-06-24-v2";
export const TERMS_UPDATED_LABEL = "24 de junho de 2026";

/** Resumo curto exibido no banner de aceite (antes de "Li e concordo"). */
export const TERMS_SUMMARY =
  "O FazTudo é apenas uma plataforma de tecnologia que CONECTA você a profissionais autônomos. " +
  "O FazTudo NÃO presta o serviço, NÃO é parte do contrato e NÃO se responsabiliza pela qualidade, " +
  "prazo, segurança ou resultado do trabalho — isso é responsabilidade EXCLUSIVA do prestador. " +
  "O prestador é AUTÔNOMO, sem vínculo empregatício com o FazTudo, e responde por seus próprios " +
  "tributos, INSS e ferramentas. Você contrata e avalia o profissional por sua conta e risco. " +
  "Créditos comprados para desbloquear contatos NÃO são reembolsáveis, salvo nos casos previstos em lei. " +
  "Você também CONSENTE com o uso da sua LOCALIZAÇÃO (cidade/estado e, se você autorizar no aparelho, a posição por GPS) " +
  "para conectar você a oportunidades e profissionais próximos e calcular distâncias, conforme a LGPD.";

export const TERMS_MARKDOWN = `# Termos de Uso do FazTudo

**Versão: 24/06/2026**

Bem-vindo(a) ao **FazTudo**. Estes Termos de Uso ("Termos") regem o acesso e a utilização da plataforma FazTudo (aplicativo móvel e site), que conecta pessoas que precisam de serviços ("Contratantes") a profissionais autônomos que oferecem serviços locais ("Prestadores"), tais como eletricistas, diaristas, pintores, encanadores, montadores, entre outros.

**LEIA ESTES TERMOS COM ATENÇÃO ANTES DE USAR A PLATAFORMA.** Ao se cadastrar, acessar ou utilizar o FazTudo de qualquer forma, você declara ter lido, compreendido e aceito integralmente estes Termos. Caso não concorde, não utilize a plataforma.

**RESUMO IMPORTANTE (não substitui a leitura integral):** O FazTudo é apenas uma plataforma de tecnologia que conecta Contratantes e Prestadores. O FazTudo **não presta** os serviços anunciados, **não é parte** do contrato firmado entre Contratante e Prestador, e **não se responsabiliza** pela qualidade, execução, prazo, segurança ou resultado do serviço. O Prestador é **profissional autônomo** e **não possui vínculo empregatício** com o FazTudo. A contratação é feita **diretamente entre Contratante e Prestador**, por conta e risco de ambos.

**CONSENTIMENTO DE LOCALIZAÇÃO:** Para conectar você a oportunidades e profissionais próximos e calcular distâncias, o FazTudo coleta e utiliza a sua **localização** — a cidade/estado informados no perfil e, quando você autoriza no aparelho, a **posição do dispositivo (GPS)**. O uso da geolocalização é **opcional** e depende da sua permissão no sistema, que você pode conceder ou revogar a qualquer momento nas configurações do aparelho. Ao aceitar estes Termos, você **consente livremente** com o tratamento dos seus dados de localização para essas finalidades, nos termos da **LGPD (Lei nº 13.709/2018)**. Você pode usar a Plataforma sem a localização por GPS, informando manualmente sua cidade/estado.

---

## 1. Definições

Para os fins destes Termos, consideram-se:

1.1. **FazTudo** ou **Plataforma**: o aplicativo e o site de tecnologia que disponibilizam o espaço virtual de conexão entre Contratantes e Prestadores, operados pela pessoa jurídica titular do FazTudo.

1.2. **Usuário**: toda pessoa física ou jurídica que se cadastra e/ou utiliza a Plataforma, na condição de Contratante ou de Prestador.

1.3. **Contratante**: o Usuário que utiliza a Plataforma para localizar, avaliar e contratar um Prestador para a execução de um serviço.

1.4. **Prestador**: o profissional autônomo, pessoa física ou jurídica, independente e não exclusivo, que utiliza a Plataforma para divulgar seus serviços e ter acesso a oportunidades de contratação ("Leads").

1.5. **Lead** ou **Oportunidade**: o contato ou a solicitação de serviço publicada por um Contratante, que pode ser desbloqueada/acessada pelo Prestador mediante uso de Créditos.

1.6. **Créditos**: a unidade virtual adquirida pelo Prestador, por meio de pagamento, que permite o desbloqueio/acesso a Leads. Os Créditos não constituem moeda e não representam qualquer garantia de fechamento de negócio.

1.7. **Serviço-fim**: o serviço efetivamente prestado pelo Prestador ao Contratante (ex.: instalação elétrica, limpeza, pintura), que é executado **fora** da Plataforma, direta e exclusivamente pelo Prestador.

1.8. **Mercado Pago**: o provedor terceirizado de meios de pagamento utilizado para o processamento das transações de aquisição de Créditos.

---

## 2. Objeto e Natureza da Plataforma

2.1. O FazTudo é, exclusivamente, um **provedor de serviços de tecnologia** que disponibiliza um espaço virtual para **intermediação e conexão** entre Contratantes e Prestadores. O FazTudo permite que os Usuários se localizem, se contatem e negociem entre si diretamente.

2.2. **O FazTudo NÃO presta os serviços anunciados pelos Prestadores.** O FazTudo não executa, não supervisiona, não fiscaliza, não dirige e não interfere na execução do Serviço-fim. O FazTudo não é uma empresa de construção, manutenção, limpeza, transporte, logística ou de qualquer outra atividade-fim divulgada na Plataforma.

2.3. **O FazTudo NÃO é parte do contrato celebrado entre Contratante e Prestador.** O contrato de prestação de serviço é firmado **direta e exclusivamente** entre o Contratante e o Prestador, sem intervenção do FazTudo na negociação, no preço, no prazo, na forma de execução, no pagamento do Serviço-fim ou em qualquer condição ajustada entre as partes.

2.4. A função do FazTudo limita-se a: (i) disponibilizar a tecnologia e o espaço virtual; (ii) divulgar os anúncios e os Leads; (iii) permitir, mediante Créditos, que o Prestador desbloqueie o contato do Contratante; e (iv) oferecer ferramentas de avaliação e comunicação. **A negociação, a contratação, o pagamento e a execução do serviço ocorrem fora da Plataforma e diretamente entre as partes.**

2.5. O FazTudo atua como provedor de aplicação de internet, nos termos da Lei nº 12.965/2014 (Marco Civil da Internet), não se confundindo com o fornecedor do Serviço-fim.

---

## 3. Cadastro e Conta

3.1. Para utilizar a Plataforma, o Usuário deve realizar cadastro, fornecendo informações verdadeiras, completas e atualizadas, e ser plenamente capaz nos termos da lei civil. Pessoas jurídicas devem estar regularmente constituídas.

3.2. O Usuário é o **único responsável** pela veracidade e atualização dos dados informados, bem como pela guarda e sigilo de seu login e senha. Todas as ações realizadas na conta presumem-se feitas pelo titular.

3.3. O FazTudo **não realiza processo seletivo, não promove treinamentos, não exige disponibilidade ou periodicidade e não fiscaliza** a atividade do Prestador. O cadastro do Prestador não constitui contratação, aprovação técnica, certificação de qualidade ou garantia de idoneidade pelo FazTudo.

3.4. Embora o FazTudo possa solicitar documentos para fins de cadastro e segurança, **o FazTudo não garante a veracidade, a exatidão, a qualificação técnica, a regularidade ou a idoneidade** das informações e dos Usuários. Cabe ao Contratante verificar, por sua conta, a qualificação do Prestador.

3.5. O FazTudo poderá, a seu critério e mediante justificativa, recusar, suspender ou cancelar cadastros que violem estes Termos ou a legislação.

---

## 4. Créditos e Pagamentos

4.1. Para desbloquear e acessar os Leads, o Prestador adquire **Créditos**, cujo pagamento é processado por meio do **Mercado Pago** ou de outro provedor de pagamento indicado na Plataforma. O FazTudo não armazena dados completos de cartão; o processamento é realizado pelo provedor terceirizado, sujeito aos termos e à política de privacidade deste.

4.2. Os Créditos destinam-se **exclusivamente** ao acesso a Leads e a funcionalidades da Plataforma. **Os Créditos não garantem o fechamento do negócio, a resposta do Contratante, a contratação efetiva nem qualquer resultado.** O Prestador reconhece que paga pelo **acesso à oportunidade**, e não pela conclusão de qualquer serviço.

4.3. **Os Créditos NÃO são reembolsáveis**, salvo nas hipóteses expressamente previstas em lei (notadamente o direito de arrependimento aplicável a compras à distância, quando cabível, e os casos de falha comprovada da Plataforma). O simples insucesso na negociação com o Contratante, a não resposta do Contratante, a desistência do Contratante ou a não contratação do Prestador **não geram direito a reembolso**, por se tratar de risco inerente à atividade do Prestador.

4.4. O FazTudo poderá alterar valores, pacotes e regras de Créditos a qualquer tempo, mediante comunicação prévia na Plataforma, sem efeito retroativo sobre Créditos já adquiridos.

4.5. O FazTudo **não processa nem intermedia** o pagamento do Serviço-fim entre Contratante e Prestador. O preço do serviço, a forma e as condições de pagamento são ajustados **diretamente entre as partes**, sem qualquer participação ou responsabilidade do FazTudo.

4.6. Cada Usuário é o único responsável por suas obrigações fiscais e tributárias decorrentes de suas atividades, incluindo a emissão de documentos fiscais quando aplicável.

---

## 5. Ausência de Vínculo (Prestador Autônomo)

5.1. **O Prestador é profissional AUTÔNOMO e INDEPENDENTE.** Estes Termos **não geram e não constituem** qualquer contrato de trabalho, vínculo empregatício, relação de emprego, vínculo societário, de associação, de mandato, de representação, de agência, de franquia, de subordinação ou de qualquer outra natureza entre o FazTudo e o Prestador.

5.2. O Prestador reconhece e aceita expressamente que:

a) **não há subordinação** ao FazTudo — o FazTudo não controla, não administra, não dirige e não tem o direito de fazê-lo, não impondo jornada, metas, escala, roteiro, exclusividade ou forma de execução do serviço;

b) **não há pessoalidade obrigatória** — o Prestador decide livremente se aceita, recusa ou ignora cada Lead, podendo organizar sua atividade como quiser;

c) **não há habitualidade imposta** — o Prestador define livremente quando, onde, com que frequência e por quanto tempo utiliza a Plataforma;

d) **atua por conta e risco próprios**, utilizando seus próprios recursos, ferramentas, materiais, veículos e equipamentos;

e) **é livre para atuar em outras plataformas concorrentes**, simultaneamente, sem qualquer exclusividade com o FazTudo;

f) é o **único responsável** por seus tributos, contribuições previdenciárias (INSS), encargos, licenças, certificações, seguros e obrigações fiscais, trabalhistas e regulatórias relativas à sua atividade.

5.3. O FazTudo não remunera o Prestador. Os valores recebidos pelo Prestador decorrem **exclusivamente** do contrato direto com o Contratante, e não do FazTudo.

5.4. O Prestador concorda em **manter o FazTudo indene** e em ressarci-lo de quaisquer valores, custos, despesas, multas ou condenações (incluindo de natureza trabalhista, previdenciária e tributária) que o FazTudo venha a suportar em razão da atividade do Prestador ou de alegação de vínculo por ele suscitada, na máxima extensão permitida em lei.

---

## 6. Obrigações do Prestador

6.1. O Prestador obriga-se a:

a) executar os serviços com **competência técnica, qualidade, segurança e diligência**, sendo o **único e exclusivo responsável** pela execução, pelo resultado e por eventuais danos;

b) possuir e manter as **habilitações, licenças, registros profissionais e certificações** exigidos para a atividade;

c) prestar informações verdadeiras sobre sua qualificação, experiência e serviços oferecidos;

d) cumprir os preços, prazos e condições acordados diretamente com o Contratante;

e) tratar Contratantes e demais Usuários com respeito e boa-fé;

f) responder, perante o Contratante e terceiros, por toda e qualquer obrigação, dano, prejuízo, vício ou defeito decorrente do serviço prestado;

g) arcar com seus próprios tributos, INSS, seguros, ferramentas, materiais e despesas;

h) não utilizar a Plataforma para fins ilícitos, fraudulentos ou em desacordo com estes Termos e a legislação.

6.2. O Prestador reconhece que o desbloqueio de um Lead representa apenas o **acesso a uma oportunidade**, não havendo qualquer garantia de contratação, de pagamento pelo Contratante ou de resultado.

---

## 7. Obrigações e Ciência do Contratante

7.1. **O Contratante declara estar CIENTE e DE ACORDO que:**

a) o FazTudo é **apenas uma plataforma de tecnologia que conecta** Contratante e Prestador, **não sendo parte** do contrato de prestação de serviço nem fornecedor do Serviço-fim;

b) **contrata o Prestador por sua conta e risco**, sendo responsável por **avaliar, selecionar e verificar** a qualificação, a experiência, a idoneidade, os documentos e a reputação do Prestador antes da contratação;

c) a negociação de preço, prazo, escopo, forma de execução e pagamento do serviço é feita **diretamente com o Prestador**, sem participação do FazTudo;

d) o FazTudo **não garante** a qualidade, a segurança, a pontualidade, a legalidade ou o resultado do serviço, nem a veracidade das informações prestadas pelos Prestadores;

e) eventuais conflitos, reclamações, vícios, defeitos, atrasos, danos ou prejuízos relativos ao serviço devem ser resolvidos **diretamente entre Contratante e Prestador**.

7.2. O Contratante obriga-se a fornecer informações verdadeiras sobre o serviço desejado, a tratar os Prestadores com respeito e boa-fé, e a honrar os pagamentos e as condições acordadas diretamente com o Prestador.

7.3. Recomenda-se ao Contratante adotar cautelas de segurança, tais como verificar referências e documentos, solicitar orçamentos por escrito, conferir a identidade do profissional e exigir garantias quando aplicável.

---

## 8. Isenção e Limitação de Responsabilidade da Plataforma

8.1. **Os Usuários reconhecem e aceitam que, ao negociar e contratar entre si, fazem-no por sua exclusiva conta e risco**, reconhecendo o FazTudo como **mero provedor de tecnologia e disponibilizador de espaço virtual** para conexão entre as partes.

8.2. **O FazTudo NÃO se responsabiliza, na máxima extensão permitida pela lei, por:**

a) a **qualidade, a execução, os prazos, a segurança, a legalidade ou o resultado** do serviço prestado, que são de **responsabilidade exclusiva do Prestador**;

b) **danos, prejuízos, perdas, vícios ou defeitos** decorrentes do serviço ou da conduta de qualquer Usuário;

c) a **veracidade, a exatidão ou a idoneidade** das informações, anúncios, qualificações e documentos fornecidos pelos Usuários;

d) o **inadimplemento, a desistência, a fraude ou a má conduta** de qualquer Usuário;

e) negócios **não realizados, lucros cessantes** ou expectativas frustradas de contratação;

f) **vícios ou falhas técnicas** oriundas do equipamento, do sistema ou da conexão do Usuário ou de terceiros, não garantindo o FazTudo o funcionamento contínuo e ininterrupto da Plataforma.

8.3. O FazTudo não é parte de nenhuma transação realizada entre Usuários e **não possui controle** sobre a qualidade, a segurança ou a legalidade dos serviços, nem sobre a capacidade dos Usuários de negociar e contratar.

8.4. **Limites legais desta isenção.** Os Usuários reconhecem que esta isenção e limitação de responsabilidade tem por objetivo refletir a real natureza intermediadora do FazTudo, e que **não se destina a afastar responsabilidades que a lei não permita excluir**, em especial as normas de ordem pública. Nas relações regidas pelo Código de Defesa do Consumidor (Lei nº 8.078/1990), responde o FazTudo apenas nos limites e nas hipóteses que a lei lhe imputar, ficando ressalvado que a execução do Serviço-fim e seus efeitos são atribuídos exclusivamente ao Prestador, na condição de fornecedor direto.

8.5. Em nenhuma hipótese a responsabilidade eventualmente atribuída ao FazTudo excederá os valores efetivamente pagos pelo Usuário ao FazTudo (a título de Créditos) nos 12 (doze) meses anteriores ao evento, ressalvadas as hipóteses em que a lei vede tal limitação.

---

## 9. Propriedade Intelectual

9.1. A marca "FazTudo", o logotipo, o nome de domínio, o software, o código-fonte, o layout, o design, os textos, as funcionalidades e demais elementos da Plataforma são de **titularidade exclusiva** do FazTudo (ou de seus licenciadores) e protegidos pela legislação de propriedade intelectual.

9.2. É concedida ao Usuário uma licença **limitada, pessoal, intransferível, não exclusiva e revogável** para uso da Plataforma conforme estes Termos. É vedado copiar, modificar, distribuir, vender, alugar, realizar engenharia reversa, extrair dados de forma automatizada (scraping) ou explorar a Plataforma fora das finalidades previstas.

9.3. O Usuário garante ser titular ou legítimo licenciado dos conteúdos que publica (textos, imagens, anúncios) e concede ao FazTudo licença gratuita para exibi-los e divulgá-los na Plataforma, responsabilizando-se por eventual violação de direitos de terceiros.

---

## 10. Proteção de Dados (LGPD — Lei nº 13.709/2018)

10.1. O FazTudo trata dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD) e com sua Política de Privacidade, que integra estes Termos.

10.2. Os dados são coletados e tratados para as finalidades de: cadastro, autenticação, conexão entre Contratantes e Prestadores, processamento de pagamentos de Créditos, prevenção a fraudes, cumprimento de obrigações legais e melhoria da Plataforma, com base nas hipóteses legais aplicáveis (execução de contrato, legítimo interesse, cumprimento de obrigação legal e consentimento, quando exigido).

10.3. Ao desbloquear um Lead, o Prestador terá acesso a dados de contato do Contratante **exclusivamente** para a finalidade de prestação do serviço, comprometendo-se a tratá-los de forma segura, a não utilizá-los para outras finalidades (como marketing não autorizado) e a respeitar a LGPD, sob pena de responsabilização exclusiva.

10.4. O Usuário pode exercer seus direitos de titular (acesso, correção, eliminação, portabilidade, revogação de consentimento, entre outros) por meio dos canais indicados na Política de Privacidade.

10.5. O compartilhamento de dados com o provedor de pagamento (Mercado Pago) e demais operadores ocorre na medida necessária à prestação do serviço, observada a LGPD.

---

## 11. Conduta Proibida

11.1. É vedado ao Usuário, entre outras condutas:

a) fornecer informações falsas, criar perfis falsos ou se passar por terceiros;

b) praticar fraudes, golpes, ou induzir outros Usuários a erro;

c) utilizar a Plataforma para fins ilícitos, discriminatórios, ofensivos ou que violem direitos de terceiros;

d) burlar o sistema de Créditos ou tentar acessar Leads de forma não autorizada;

e) assediar, ameaçar, difamar ou agir de má-fé com outros Usuários;

f) coletar dados de outros Usuários para fins não autorizados;

g) introduzir vírus, malware ou comprometer a segurança da Plataforma;

h) anunciar serviços ilegais ou para os quais não possua habilitação.

11.2. A prática de condutas proibidas poderá ensejar advertência, suspensão ou cancelamento da conta, sem prejuízo das medidas legais cabíveis e da responsabilização do infrator.

---

## 12. Suspensão e Cancelamento

12.1. O Usuário pode encerrar sua conta a qualquer momento, observado que **Créditos não utilizados não são reembolsáveis**, salvo previsão legal.

12.2. O FazTudo poderá, a seu critério e mediante justificativa razoável, **suspender ou cancelar** a conta de Usuário que violar estes Termos, a legislação, ou que apresentar reclamações graves, fraude, conduta abusiva ou risco a outros Usuários.

12.3. O exercício, pelo FazTudo, de medidas de moderação, bloqueio ou exclusão de perfis em razão de reclamações **não descaracteriza** sua natureza de mero intermediador de tecnologia, tratando-se de medida legítima de segurança e de cumprimento destes Termos e da lei.

12.4. O cancelamento não exime o Usuário das responsabilidades assumidas perante outros Usuários nem das obrigações já constituídas.

---

## 13. Alterações dos Termos

13.1. O FazTudo poderá alterar estes Termos a qualquer tempo, para refletir mudanças legais, regulatórias ou operacionais. As alterações serão comunicadas na Plataforma e/ou por outros meios.

13.2. A continuidade do uso da Plataforma após a publicação das alterações implica **aceite** dos novos Termos. Caso não concorde, o Usuário deve cessar o uso e encerrar sua conta.

---

## 14. Legislação Aplicável e Foro de Eleição

14.1. Estes Termos são regidos pela legislação da República Federativa do Brasil, em especial pelo Código Civil (Lei nº 10.406/2002), pelo Marco Civil da Internet (Lei nº 12.965/2014), pela LGPD (Lei nº 13.709/2018) e, quando aplicável, pelo Código de Defesa do Consumidor (Lei nº 8.078/1990).

14.2. Fica eleito o foro do domicílio do Contratante consumidor para dirimir eventuais controvérsias decorrentes destes Termos, quando se tratar de relação de consumo. Nas demais hipóteses, fica eleito o foro da Comarca da sede do FazTudo, com renúncia a qualquer outro, por mais privilegiado que seja.

---

## 15. Aceite

Ao clicar em **"Li e concordo"**, ao se cadastrar ou ao utilizar a Plataforma, o Usuário declara ter lido, compreendido e aceito integralmente estes Termos de Uso, registrando-se o aceite eletrônico (data, hora e IP) para fins de comprovação.

**FazTudo — Versão de 24/06/2026.**`;
