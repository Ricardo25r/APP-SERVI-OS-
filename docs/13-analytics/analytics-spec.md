# analytics-spec.md

# Analytics & Business Intelligence — Especificação de Métricas, KPIs e Dashboards

Projeto: FazTudo

Versão: 1.0

Status: Documento Oficial

---

# 1. Objetivo

O módulo de Analytics é a **camada de consolidação, definição e padronização de métricas** do marketplace FazTudo.

Ele **não cria** novas metas de negócio nem redefine regras dos motores existentes. Sua missão é:

* **Consolidar** em um único lugar todas as métricas já citadas de forma dispersa nos motores (Lead Engine, Payment Engine, Matching Engine, Reputation Engine, Gamification Engine).
* **Definir fórmulas explícitas** para cada métrica (muitas aparecem apenas pelo nome nos documentos de origem).
* **Mapear a fonte de cada dado** para o schema oficial (`docs/04-banco-de-dados/database-schema.md`), indicando tabela e campo.
* **Definir a frequência** de cálculo/agregação de cada indicador.
* **Padronizar dashboards** (executivo, financeiro, operacional) e cohorts/funis.
* **Garantir consistência total** com as metas e definições já oficializadas na fonte da verdade.

Princípio mestre: **toda métrica aqui deve ser rastreável a uma tabela/campo do schema e a uma meta já existente quando houver.** Nada é reinventado; tudo é consolidado e formalizado.

---

# 2. Escopo

## 2.1 Dentro do escopo

* Definição formal (Nome · Definição · Fórmula · Fonte · Frequência) de:
  * Métricas de negócio (marketplace)
  * Métricas operacionais
  * Métricas financeiras (receita, ticket médio, MRR, ARR, LTV, CAC)
  * Métricas de retenção
  * KPIs com metas oficiais
* Dashboards: Executivo, Financeiro, Operacional.
* Análise de coortes (profissionais e contratantes).
* Funis de conversão (cadastro→ativação→primeira compra; lead→contato→contratação).
* Indicadores específicos de marketplace (liquidez, fill rate, take rate, razão oferta/demanda).
* Camada de coleta/agregação de dados e regras de acesso a dados sensíveis/financeiros.

## 2.2 Fora do escopo (delegado a outros documentos)

* Regras de **monetização e preços** → `docs/05-payment-engine/payment-engine.md`.
* Regras de **distribuição/score** → `docs/06-matching-engine/matching-engine.md`.
* Cálculo do **reputation_score** → `docs/07-reputation-engine/reputation-engine.md`.
* Regras de **XP/níveis/medalhas** → `docs/08-gamification-engine/gamification-engine.md`.
* **Modelagem física** das tabelas → `docs/04-banco-de-dados/database-schema.md`.
* **Detecção de fraude** → `anti-fraud-engine.md` (**DISPONÍVEL** em docs/19 — ver Seção 10; integração a detalhar na implementação).

> Este documento é **complementar**: consome dados produzidos pelos motores acima e referencia o schema; não os duplica nem os contradiz.

---

# 3. Regras de Negócio

1. **Fonte única da verdade do dado**: toda métrica deve apontar para tabela/campo do schema oficial. Se um dado não existe no schema, a métrica é marcada como *bloqueada* até a criação do campo (ver Seção 10).
2. **Cálculo exclusivo no backend**: nenhuma métrica é calculada ou alterada pelo cliente. Coerente com a regra "Toda pontuação deve ser calculada no backend" (Matching) e "Toda reputação é calculada exclusivamente pelo backend" (Reputation).
3. **Imutabilidade da base**: métricas financeiras derivam de `credit_transactions` e `payment_orders`, que **nunca podem ser apagados ou editados** (Payment Engine / Regras de Integridade do schema). Analytics apenas **lê**.
4. **Reaproveitamento de metas**: as metas dos KPIs são as já oficializadas na fonte da verdade. Analytics não cria metas novas; quando uma meta não existe na fonte, o alvo é marcado como **"a definir"**.
5. **Definições canônicas**: quando dois documentos divergem na definição de uma métrica, vale a definição registrada na Seção 8 deste documento, com o conflito documentado na Seção 10.
6. **Janela temporal padrão**: salvo indicação contrária, "mês" = mês-calendário; "ativo no período" segue a definição de retenção da Seção 8.6.
7. **Receita reconhecida**: receita é reconhecida no momento do pagamento aprovado (`payment_orders.status = 'paid'`, `paid_at`), não no momento da criação do pedido.
8. **Créditos não são receita**: o consumo de créditos (`credit_transactions.transaction_type = 'spend'`) é métrica **operacional**, não financeira. Receita ocorre apenas na compra (`payment_orders`).
9. **Segmentação obrigatória**: indicadores de marketplace devem poder ser segmentados por **categoria** (`categories`), **cidade** e **estado** (`leads.city/state`, `professional_profiles.city/state`).

---

# 4. Fluxos (coleta e agregação de dados)

## 4.1 Origem dos dados (event sources)

Analytics não possui base própria de eventos transacionais; ele agrega a partir das tabelas operacionais já existentes:

| Domínio | Tabela(s) fonte | Eventos derivados |
|---|---|---|
| Cadastro/Usuários | `users`, `professional_profiles`, `customer_profiles` | cadastro, ativação |
| Leads | `leads`, `lead_purchases` | lead criado, lead comprado/vendido, lead encerrado |
| Contato | `conversations`, `messages` | contato iniciado, primeira mensagem |
| Contratação | `reviews`, `leads.status` | serviço fechado/contratação |
| Financeiro | `payment_orders`, `credit_transactions`, `credit_wallets`, `credit_packages` | compra de créditos, consumo, bônus, estorno |
| Reputação | `reviews`, `professional_profiles.rating` | avaliação registrada |
| Gamificação | `xp_transactions`, `user_achievements`, `professional_profiles.xp/level` | XP, conquista |
| Moderação | `reports`, `verification_requests` | denúncia, verificação |
| Auditoria | `audit_logs`, `admin_actions` | acesso, ação administrativa |

## 4.2 Fluxo de agregação

```text
Tabelas operacionais (PostgreSQL — fonte da verdade)
        ↓  (extração read-only / réplica de leitura)
Camada de agregação Analytics (jobs agendados + views materializadas)
        ↓
Tabelas/Views de métricas agregadas (snapshots diários, MRR mensal, cohorts)
        ↓
Cache de dashboards (Redis)
        ↓
Dashboards (Executivo / Financeiro / Operacional)
```

## 4.3 Frequências de agregação

* **Tempo real / sob demanda**: contadores simples lidos direto das tabelas (saldo, leads abertos).
* **Horária**: indicadores operacionais voláteis (fill rate do dia, leads abertos por categoria).
* **Diária (snapshot)**: receita diária, créditos vendidos/consumidos, retenção D1/D7/D30, funis do dia. Snapshot persistido em tabela de séries temporais (ver Seção 10 — `analytics_daily_snapshots`).
* **Mensal**: MRR, ARR, ticket médio mensal, LTV, CAC, cohorts mensais, NPS.
* **Por temporada (90 dias)**: indicadores alinhados às Temporadas da Gamificação.

## 4.4 Reconciliação

Os totais financeiros agregados (ex.: receita mensal) devem ser **reconciliáveis** com a soma direta de `payment_orders` pagas no período. Divergência é tratada como incidente de dados.

---

# 5. Casos Especiais

1. **Lead reembolsado** (`credit_transactions.transaction_type = 'refund'` / `payment_orders.status = 'refunded'`): não conta como "lead vendido" para receita; o crédito retorna à carteira. O lead pode reabrir conforme regra do Lead Engine. Excluir da receita líquida e do fill rate efetivo.
2. **Chargeback**: créditos bloqueados e conta suspensa (Payment Engine). A receita correspondente é **estornada** das métricas financeiras do período em que o chargeback é confirmado.
3. **Crédito bônus** (`transaction_type = 'bonus'`): entra como consumo possível, mas **não gera receita**. Deve ser segregado em métricas (receita real vs. valor transacionado em bônus). Relevante para LTV (não inflar com bônus).
4. **Profissional novo** (< 30 dias e < 10 serviços — definição do Matching Engine): tratado separadamente em cohorts e na cota de 20% de leads reservados; não distorcer fill rate geral.
5. **Lead cancelado pelo contratante** (`leads.status = 'cancelled'`): conta como demanda criada, mas não como demanda atendível; remover do denominador de fill rate quando cancelado antes de qualquer compra.
6. **Avaliação suspeita / sob revisão** (Reputation Engine): não contabilizada até validação; excluir de avaliação média e NPS até liberada.
7. **Auto contratação / múltiplas contas**: eventos sinalizados pelo Anti-Fraude devem ser **excluídos** de todas as métricas de conversão, GMV-proxy e reputação (dependente de `anti-fraud-engine.md`).
8. **Período sem dados**: cohort/funil sem volume mínimo (ex.: cidade recém-lançada) é exibido com flag de baixa amostragem, não como 0%.
9. **Ajuste administrativo** (`transaction_type` de ajuste / `admin_actions`): rastreável e segregado; nunca silencioso nas métricas financeiras.

---

# 6. Segurança (acesso a dados sensíveis e financeiros)

1. **RBAC** (conforme arquitetura e master-task):
   * **admin**: acesso total aos dashboards Executivo, Financeiro e Operacional.
   * **professional**: acesso **apenas** às próprias métricas (dashboard profissional já definido em Reputation/Gamification) — nunca a agregados globais ou de terceiros.
   * **customer**: acesso apenas às próprias métricas simplificadas.
2. **Dados financeiros** (`payment_orders`, `credit_transactions`, `credit_wallets`): visíveis apenas para `admin`. Coerente com o Painel Financeiro Admin do Payment Engine.
3. **Dados pessoais sensíveis** (documentos/selfies em `verification_requests`): **fora** do escopo analítico; nunca compõem métricas. Apenas contagem de status (`pending/approved/rejected`) é agregada.
4. **Princípio do menor privilégio**: a camada Analytics acessa o banco em modo **read-only** (réplica de leitura quando possível).
5. **Ownership / IDOR**: toda consulta de métrica individual valida propriedade (`user_id`), conforme "Ownership Validation" e "Proteção IDOR" da arquitetura.
6. **Imutabilidade**: Analytics nunca escreve nas tabelas-fonte; apenas em tabelas de agregação próprias.
7. **Não exposição de PII em agregados**: dashboards executivos exibem números agregados; drill-down a nível de usuário restrito a `admin` com registro em auditoria.

---

# 7. Auditoria

1. **Acesso a dashboards financeiros** gera registro em `audit_logs` (`action`, `entity`, `user_id`, `ip_address`, `user_agent`, `created_at`).
2. **Exportações** de relatórios (CSV/planilha) são auditadas com usuário, escopo e data.
3. **Ações administrativas** que afetem dados-base (ex.: reembolso, ajuste) já são auditadas em `admin_actions`; Analytics apenas reflete, nunca mascara.
4. **Rastreabilidade financeira**: toda métrica financeira deve ser reconstituível a partir dos registros imutáveis (`credit_transactions`, `payment_orders`), atendendo "rastreabilidade financeira" da Definição de Sucesso do schema.
5. **Versionamento de definição de métrica**: qualquer alteração de fórmula deve constar no changelog deste documento (controle de versão), pois muda a interpretação histórica.

---

# 8. Métricas

> Formato padrão de cada métrica: **Nome · Definição · Fórmula · Fonte (tabela.campo) · Frequência**.
> Convenção de status de lead: `open / purchased / closed / cancelled` (schema 04). "Contratação/serviço fechado" é representado por `reviews` existente para o lead e/ou `leads.status = 'closed'` (ver conflito na Seção 10).

## 8.1 Métricas de Negócio (marketplace)

### Leads Gerados
* **Definição**: total de leads criados por contratantes no período.
* **Fórmula**: `COUNT(leads.id) WHERE created_at ∈ período`
* **Fonte**: `leads.id`, `leads.created_at`
* **Frequência**: diária

### Leads Vendidos
* **Definição**: total de leads adquiridos por profissionais (MVP = exclusivo, 1 compra por lead).
* **Fórmula**: `COUNT(lead_purchases.id) WHERE purchased_at ∈ período`
* **Fonte**: `lead_purchases.id`, `lead_purchases.purchased_at`
* **Frequência**: diária

### Conversão Lead → Contato
* **Definição**: proporção de leads que evoluem para contato iniciado (conversa criada). Equivale ao "Contato liberado" do ciclo do Lead Engine.
* **Fórmula**: `Leads com conversa iniciada ÷ Leads gerados × 100`
* **Fonte**: numerador `conversations.lead_id` (distinct); denominador `leads.id`
* **Frequência**: diária
* **Meta (oficial — Lead Engine)**: **> 60%**

### Conversão Contato → Contratação
* **Definição**: proporção de contatos que evoluem para contratação/serviço fechado.
* **Fórmula**: `Leads contratados ÷ Leads com contato × 100`
* **Fonte**: numerador `leads.status = 'closed'` (ou `reviews.lead_id` distinct); denominador `conversations.lead_id` distinct
* **Frequência**: diária
* **Meta (oficial — Lead Engine)**: **> 25%**

### Avaliação Média da Plataforma
* **Definição**: média das notas de avaliação.
* **Fórmula**: `AVG(reviews.score)` no período (ou consolidado por `professional_profiles.rating`)
* **Fonte**: `reviews.score`; consolidado em `professional_profiles.rating`, `professional_profiles.total_reviews`
* **Frequência**: diária
* **Meta (oficial — Lead Engine / Reputation)**: **> 4.5**

### Receita por Lead
* **Definição**: receita média atribuível a cada lead vendido (valor monetário dos créditos consumidos no lead).
* **Fórmula**: `Receita do período ÷ Leads vendidos` (proxy) ou, por lead, `credits_used × preço médio do crédito`
* **Fonte**: `lead_purchases.credits_used`, `credit_packages.price`, `credit_packages.credits`, `payment_orders.amount`
* **Frequência**: mensal

### Receita por Profissional
* **Definição**: receita média gerada por profissional pagante.
* **Fórmula**: `Receita total ÷ Profissionais pagantes`
* **Fonte**: `payment_orders.amount` agrupado por `payment_orders.user_id` (role professional)
* **Frequência**: mensal

## 8.2 Métricas Operacionais

### Créditos Vendidos
* **Definição**: total de créditos adquiridos por compra (não inclui bônus).
* **Fórmula**: `SUM(credit_transactions.amount) WHERE transaction_type = 'purchase'`
* **Fonte**: `credit_transactions.amount`, `credit_transactions.transaction_type`
* **Frequência**: diária

### Créditos Consumidos
* **Definição**: total de créditos gastos em compra de leads.
* **Fórmula**: `SUM(credit_transactions.amount) WHERE transaction_type = 'spend'`
* **Fonte**: `credit_transactions.amount`, `credit_transactions.transaction_type`
* **Frequência**: diária

### Saldo Médio em Carteira
* **Definição**: média de saldo de créditos não consumidos (estoque de moeda).
* **Fórmula**: `AVG(credit_wallets.balance)`
* **Fonte**: `credit_wallets.balance`
* **Frequência**: diária

### Tempo até Compra do Lead
* **Definição**: tempo entre criação do lead e sua compra.
* **Fórmula**: `AVG(lead_purchases.purchased_at − leads.created_at)`
* **Fonte**: `lead_purchases.purchased_at`, `leads.created_at`
* **Frequência**: diária

### Tempo Médio de Resposta
* **Definição**: tempo entre compra do lead (contato liberado) e a primeira mensagem do profissional.
* **Fórmula**: `AVG(primeira messages.created_at do profissional − lead_purchases.purchased_at)`
* **Fonte**: `messages.created_at`, `messages.sender_id`, `lead_purchases.purchased_at`
* **Frequência**: diária
* **Referência**: faixas usadas por Matching/Reputation (<5min, <15min, <1h).

### Taxa de Compra do Lead (Matching)
* **Definição**: proporção de leads distribuídos que foram comprados.
* **Fórmula**: `Leads comprados ÷ Leads distribuídos × 100`
* **Fonte**: `lead_purchases.lead_id` distinct ÷ `leads.id` (status ≠ cancelled)
* **Frequência**: horária/diária

### Taxa de Comparecimento
* **Definição**: proporção de serviços em que o profissional compareceu.
* **Fórmula**: `Comparecimentos ÷ Serviços agendados × 100`
* **Fonte**: **bloqueada** — não há campo de comparecimento no schema (ver Seção 10). Peso de 10% existe no Reputation Engine.
* **Frequência**: diária (quando viabilizado)

### Taxa de Reclamação / Denúncia
* **Definição**: volume de denúncias válidas relativo à base.
* **Fórmula**: `COUNT(reports WHERE status = 'resolved' e válida) ÷ usuários ativos × 100`
* **Fonte**: `reports.status`, `reports.target_user_id`
* **Frequência**: mensal

### XP Distribuído / Missões Concluídas / Usuários Gamificados
* **Definição**: volume de XP creditado e engajamento na gamificação.
* **Fórmula**: `SUM(xp_transactions.amount)`; `COUNT(user_achievements)`; usuários com XP no período.
* **Fonte**: `xp_transactions.amount`, `xp_transactions.created_at`, `user_achievements.earned_at`
* **Frequência**: diária

## 8.3 Métricas Financeiras

> Receita reconhecida em `payment_orders.status = 'paid'` (Regra 7). Bônus não é receita (Regra 8).

### Receita (Diária / Mensal)
* **Definição**: soma dos pagamentos aprovados no período.
* **Fórmula**: `SUM(payment_orders.amount) WHERE status = 'paid' AND paid_at ∈ período`
* **Fonte**: `payment_orders.amount`, `payment_orders.status`, `payment_orders.paid_at`
* **Frequência**: diária e mensal
* **Decomposição (relatórios do Payment Engine)**: por dia, por cidade (`leads.city`/`professional_profiles.city`), por categoria (`categories`), por profissional (`payment_orders.user_id`).

### Ticket Médio
* **Definição**: valor médio por pedido pago.
* **Fórmula**: `SUM(payment_orders.amount) ÷ COUNT(pedidos pagos)`
* **Fonte**: `payment_orders.amount`, `payment_orders.status = 'paid'`
* **Frequência**: mensal
* **Meta (oficial — Payment Engine)**: **R$ 50+**

### MRR (Monthly Recurring Revenue)
* **Definição**: receita recorrente mensal das assinaturas Premium (normalizada para base mensal).
* **Fórmula**: `Σ (valor mensal normalizado de cada assinatura Premium ativa)` — ex.: anual ÷ 12, trimestral ÷ 3, conforme planos R$29,90 / R$79,90 / R$249,90 do Payment Engine.
* **Fonte**: **assinaturas Premium** — atualmente **sem tabela dedicada** no schema (ver Seção 10 — `subscriptions` proposta). Proxy temporário: pedidos pagos de assinatura via `payment_orders`.
* **Frequência**: mensal

### ARR (Annual Recurring Revenue)
* **Definição**: receita recorrente anualizada.
* **Fórmula**: `MRR × 12`
* **Fonte**: derivada do MRR (mesma dependência de `subscriptions`).
* **Frequência**: mensal

### LTV (Lifetime Value)
* **Definição**: receita líquida média gerada por um profissional ao longo de seu ciclo de vida na plataforma.
* **Fórmula**: `Ticket médio × Frequência de compra média × Tempo de vida médio (meses)`; ou, observado: `Receita total do cohort ÷ nº de profissionais do cohort`. Exclui créditos bônus.
* **Fonte**: `payment_orders.amount` (status paid) por `user_id` ao longo do tempo; tempo de vida via `users.created_at` e atividade.
* **Frequência**: mensal

### CAC (Customer Acquisition Cost)
* **Definição**: custo médio de aquisição de um profissional pagante.
* **Fórmula**: `Investimento total em aquisição ÷ Novos profissionais pagantes no período`
* **Fonte**: **denominador** no schema (`users` role professional + primeiro `payment_orders` pago); **numerador (gasto de marketing) não está no schema** → entrada manual/externa (ver Seção 10).
* **Frequência**: mensal

### Razão LTV/CAC (derivada)
* **Definição**: eficiência de aquisição.
* **Fórmula**: `LTV ÷ CAC`
* **Fonte**: derivada.
* **Frequência**: mensal · **Meta (a definir — não consta na fonte da verdade)**.

### Assinaturas Premium Ativas
* **Definição**: número de assinaturas Premium vigentes.
* **Fórmula**: `COUNT(assinaturas ativas)`
* **Fonte**: `subscriptions` (proposta) / proxy `payment_orders` de plano.
* **Frequência**: diária
* **Meta (oficial — Payment Engine)**: **5% dos profissionais**

### Perfis Verificados
* **Definição**: número de profissionais com verificação aprovada.
* **Fórmula**: `COUNT(professional_profiles WHERE verified = true)`
* **Fonte**: `professional_profiles.verified`; pipeline `verification_requests.status = 'approved'`
* **Frequência**: diária

### Reembolsos e Chargebacks
* **Definição**: volume e valor de reembolsos (em créditos) e chargebacks.
* **Fórmula**: `COUNT/SUM(credit_transactions WHERE transaction_type = 'refund')`; chargebacks via `payment_orders.status = 'refunded'`
* **Fonte**: `credit_transactions.transaction_type`, `payment_orders.status`
* **Frequência**: diária

### Conversão de Compra (visitante/profissional → comprador)
* **Definição**: proporção de profissionais que efetivam compra de créditos.
* **Fórmula**: `Profissionais que compraram créditos ÷ Profissionais ativos × 100`
* **Fonte**: `payment_orders` (status paid) distinct `user_id` ÷ profissionais ativos
* **Frequência**: mensal
* **Meta (oficial — Payment Engine)**: **10%+**

## 8.4 Métricas de Retenção

### Retenção Mensal
* **Definição**: proporção de usuários ativos em um mês que permanecem ativos no mês seguinte.
* **Fórmula**: `Usuários ativos em M e M+1 ÷ Usuários ativos em M × 100`
* **Fonte**: atividade derivada de `lead_purchases.purchased_at`, `messages.created_at`, `users.last_login_at`, `xp_transactions.created_at`
* **Frequência**: mensal
* **Meta (oficial — Lead Engine e Payment Engine)**: **> 70%**
* **Definição de "ativo"**: profissional com ao menos uma ação relevante no período (compra de lead, mensagem, login, ou ganho de XP).

### Churn Mensal (derivada)
* **Definição**: complemento da retenção.
* **Fórmula**: `100% − Retenção mensal`
* **Fonte**: derivada.
* **Frequência**: mensal · **Meta implícita**: **< 30%** (complemento de 70%).

### Retenção D1 / D7 / D30
* **Definição**: retorno do usuário 1, 7 e 30 dias após o cadastro.
* **Fórmula**: `Usuários com atividade no dia N após cadastro ÷ Cadastros do cohort × 100`
* **Fonte**: `users.created_at` vs. atividade (acima).
* **Frequência**: diária (alimenta cohorts)

### Frequência de Uso
* **Definição**: intensidade de uso por usuário ativo (alinhada ao Programa de Fidelidade: 30/90/180 dias ativos).
* **Fórmula**: `Dias ativos no período ÷ usuário`; e DAU/MAU como stickiness.
* **Fonte**: `users.last_login_at`, `xp_transactions.created_at`, `messages.created_at`
* **Frequência**: diária/mensal

### Programa de Fidelidade — Marcos
* **Definição**: profissionais que atingiram 30/90/180 dias ativos contínuos.
* **Fórmula**: contagem de sequências ativas por faixa.
* **Fonte**: derivada de atividade + `user_achievements` (ex.: "Profissional Ativo — 30 dias").
* **Frequência**: diária

## 8.5 KPIs (com metas oficiais da fonte da verdade)

> **Nenhuma meta abaixo é nova.** Todas reaproveitam valores já oficializados nos motores.

| KPI | Definição | Fórmula | Fonte | Freq. | Meta (origem) |
|---|---|---|---|---|---|
| Conversão Lead → Contato | leads que viram conversa | conversas distintas ÷ leads gerados | `conversations.lead_id` ÷ `leads.id` | diária | **> 60%** (Lead Engine) |
| Conversão Contato → Contratação | contatos que viram contratação | leads fechados ÷ leads com contato | `leads.status='closed'` ÷ `conversations.lead_id` | diária | **> 25%** (Lead Engine) |
| Avaliação Média | qualidade percebida | AVG(score) | `reviews.score` / `professional_profiles.rating` | diária | **> 4.5** (Lead/Reputation) |
| Retenção Mensal | permanência de ativos | ativos M∩M+1 ÷ ativos M | atividade multi-fonte | mensal | **> 70%** (Lead/Payment) |
| Ticket Médio | valor médio por pedido | receita ÷ pedidos pagos | `payment_orders.amount` | mensal | **R$ 50+** (Payment) |
| Conversão de Compra | profissionais que compram | compradores ÷ ativos | `payment_orders` ÷ ativos | mensal | **10%+** (Payment) |
| Penetração Premium | adesão à assinatura | assinantes ÷ profissionais | `subscriptions`/proxy ÷ `professional_profiles` | mensal | **5%** (Payment) |
| NPS | recomendação | %Promotores − %Detratores | pesquisa NPS (ver 8.7) | mensal/trimestral | **a definir** (citado em Reputation, sem alvo) |

## 8.6 Indicadores de Marketplace

### Liquidez do Marketplace
* **Definição**: capacidade do marketplace de "casar" oferta e demanda — proporção de leads que encontram um profissional disposto a comprar.
* **Fórmula**: `Leads vendidos ÷ Leads gerados × 100`
* **Fonte**: `lead_purchases.lead_id` distinct ÷ `leads.id`
* **Frequência**: diária
* **Segmentação**: por categoria, cidade, estado.

### Fill Rate de Leads
* **Definição**: percentual de leads atendíveis efetivamente preenchidos (comprados) antes de expirar/cancelar.
* **Fórmula**: `Leads com status 'purchased'/'closed' ÷ (Leads gerados − cancelados antes de compra) × 100`
* **Fonte**: `leads.status`, `leads.expires_at`, `lead_purchases.lead_id`
* **Frequência**: horária/diária

### Take Rate
* **Definição**: parcela do valor transacionado retida pela plataforma. No modelo FazTudo, **a plataforma é o vendedor dos créditos**, logo o take rate efetivo da venda de leads é **100% da receita de créditos** (não há repasse a terceiros). Métrica útil para comparação com marketplaces de comissão.
* **Fórmula**: `Receita da plataforma ÷ Valor bruto transacionado (GMV-proxy)` — no modelo atual ≈ 100%, pois GMV-proxy = receita de créditos.
* **Fonte**: `payment_orders.amount` (receita); GMV de serviços fechados **não é capturado** (não há valor do serviço no schema — ver Seção 10).
* **Frequência**: mensal
* **Observação**: take rate sobre o **valor do serviço contratado** é **bloqueado** (campo de valor de serviço inexistente).

### Razão Oferta/Demanda (por categoria/cidade)
* **Definição**: equilíbrio entre profissionais elegíveis (oferta) e leads gerados (demanda) em um recorte.
* **Fórmula**: `Profissionais ativos elegíveis ÷ Leads gerados` por (categoria × cidade)
* **Fonte**: oferta `professional_profiles` + `professional_categories` + `professional_profiles.city/state` + `availability_status='available'`; demanda `leads.category_id/city/state`
* **Frequência**: diária
* **Uso**: identificar categorias/cidades "frias" (excesso de demanda) ou "saturadas" (excesso de oferta) — insumo para a regra de 20% de leads a novos profissionais (Matching).

### GMV-Proxy (Volume Transacionado)
* **Definição**: proxy de volume econômico do marketplace baseado em créditos consumidos × preço médio.
* **Fórmula**: `Créditos consumidos × preço médio por crédito`
* **Fonte**: `credit_transactions (spend)`, `credit_packages.price/credits`
* **Frequência**: mensal

## 8.7 NPS (Net Promoter Score)

* **Definição**: índice de recomendação da plataforma (citado em Reputation Engine — "NPS da plataforma").
* **Fórmula**: `% Promotores (nota 9–10) − % Detratores (nota 0–6)`
* **Fonte**: **não há tabela de pesquisa NPS no schema** → requer `nps_surveys` (ver Seção 10). Diferencia-se das `reviews` (avaliação de serviço, escala 1–5), que medem satisfação por transação, não recomendação da plataforma.
* **Frequência**: mensal ou por temporada (90 dias)
* **Meta**: **a definir** (a fonte cita NPS, mas não fixa alvo numérico).

---

# 9. Roadmap

Alinhado aos roadmaps já existentes (Matching V1→V4, Reputation V1→V4, Gamification V1→V5, Payment V2→V5, Arquitetura V2→V4).

**V1 — Fundação Analytics (MVP)**
* Snapshots diários (`analytics_daily_snapshots`).
* Dashboards Executivo, Financeiro e Operacional baseados em SQL/views.
* KPIs com metas oficiais (Seção 8.5) e funis básicos.
* Indicadores de marketplace: liquidez, fill rate, razão oferta/demanda.

**V2 — Recorrência e Cohorts**
* Tabela `subscriptions` → MRR/ARR/penetração Premium reais.
* Cohorts mensais de profissionais e contratantes.
* Pesquisa e cálculo de NPS (`nps_surveys`).

**V3 — Eventos e Atribuição**
* Camada de eventos de produto (`analytics_events`) para funil cadastro→ativação→primeira compra com granularidade de etapa.
* Integração de gasto de marketing para CAC e LTV/CAC automatizados.
* Alinha-se ao "Matching por comportamento" (V2) e ML (V3).

**V4 — Inteligência e Predição**
* Previsão de churn, LTV preditivo, alertas automáticos de KPI fora da meta.
* Acompanha "Reputação/Matching preditivo" e "Gamificação com IA".

**V5 — Marketplace Corporativo / multi-tenant analytics**
* Segmentação por tenant corporativo (alinha Payment V5 — Marketplace Corporativo).

---

# 10. Conflitos e Observações

## 10.1 Dependência ausente
* **`anti-fraud-engine.md` DISPONÍVEL (docs/19).** Métricas que dependem de exclusão de fraude (auto contratação, múltiplas contas, avaliações falsas) e os casos especiais 6 e 7 dependiam desse documento, agora publicado em `docs/19-anti-fraud-engine/anti-fraud-engine.md`; a especificação dessas exclusões pode ser completada na implementação, consumindo as regras do docs/19. Lead/Reputation/Gamification já citavam anti-fraude, cujas regras detalhadas agora estão disponíveis.

## 10.2 Conflitos de schema entre documentos
> Em todos, prevalece o **schema oficial** (`docs/04-banco-de-dados/database-schema.md`).

1. **Campo de tipo em `credit_transactions`**: schema 04 usa `transaction_type` com valores `purchase/bonus/refund/spend`; arquitetura 03 usa `type` com `compra/bonus/consumo/estorno`. **Canônico: `transaction_type` + valores em inglês.**
2. **Reputação do contratante**: schema 04 `customer_profiles.reputation_score`; arquitetura 03 `customer_profiles.rating`. **Canônico: `reputation_score`.**
3. **Conteúdo de mensagem**: schema 04 `messages.message`; arquitetura 03 `messages.content`. **Canônico: `messages.message`.**
4. **Verificação**: schema 04 `verification_requests.document_front_url/document_back_url`; arquitetura 03 `document_url` único e `reviewed_by`/`reviewer_id`. **Canônico: schema 04.**
5. **Lead status/tipos idioma**: schema 04 em inglês (`open/purchased/closed/cancelled`, `one_time/temporary/permanent`); arquitetura 03 em português. **Canônico: inglês (schema 04).**

## 10.3 Conflitos/ambiguidades de métrica

1. **"Contratação" não tem campo explícito.** O ciclo do Lead Engine termina em "Contratação ocorre", mas o schema só tem `leads.status='closed'` e `reviews`. **Definição canônica adotada:** uma contratação = lead com `status='closed'` **ou** existência de `reviews.lead_id`. Recomenda-se um marcador explícito de contratação (ver 10.4).
2. **"Conversão de Compra 10%+"** aparece no Payment Engine como meta financeira (profissional→comprador) e o Matching Engine fala em "taxa de compra do lead" — **são métricas diferentes** com nomes parecidos. Mantidas separadas em 8.2 (taxa de compra do lead) e 8.3 (conversão de compra de créditos).
3. **Avaliação: escalas distintas.** `reviews.score` é 1–5 (avaliação de serviço); `reputation_score` é 0–1000 (Reputation Engine); NPS é −100 a +100. Não devem ser misturadas. Avaliação média usa 1–5; KPI de qualidade é > 4.5.
4. **NPS sem fonte e sem meta.** Citado em Reputation, mas não há tabela nem alvo. Marcado como dependente de `nps_surveys` e meta "a definir".
5. **Taxa de comparecimento (peso 10% no Reputation)** não tem campo de origem no schema → métrica bloqueada até criação de campo de comparecimento.
6. **Take rate sobre valor de serviço** é inviável: o schema não armazena o valor monetário do serviço contratado. Modelo atual é venda de créditos (take ≈ 100% da receita de créditos).
7. **MRR/ARR/Premium** dependem de assinatura recorrente, porém **não existe tabela de assinaturas** no schema; apenas `payment_orders` (pontual). Proxy temporário usado, mas impreciso para renovação/cancelamento.
8. **CAC** não possui fonte interna para o **gasto de aquisição** (marketing); requer entrada externa/manual.

## 10.4 Novas tabelas/campos recomendados (NÃO criar sem aprovação — Regra do schema)

Necessários para tornar métricas atualmente bloqueadas/aproximadas plenamente calculáveis:

* **`subscriptions`** (assinaturas Premium recorrentes) — habilita MRR, ARR, penetração Premium, churn de assinatura.
  Campos sugeridos: `id`, `user_id`, `plan` (`monthly/quarterly/annual`), `status` (`active/cancelled/expired/past_due`), `amount`, `current_period_start`, `current_period_end`, `gateway`, `external_reference`, `created_at`, `updated_at`, `cancelled_at`.
* **`analytics_daily_snapshots`** (séries temporais agregadas) — persiste KPIs diários para histórico e dashboards.
  Campos: `id`, `snapshot_date`, `metric_key`, `dimension` (categoria/cidade/estado/global), `value`, `created_at`.
* **`nps_surveys`** (pesquisas de NPS) — habilita NPS real, distinto de `reviews`.
  Campos: `id`, `user_id`, `role`, `score` (0–10), `comment`, `created_at`.
* **`analytics_events`** (eventos de produto, V3) — habilita funil cadastro→ativação→primeira compra com granularidade.
  Campos: `id`, `user_id`, `event_name`, `properties` (JSON), `session_id`, `created_at`.
* **Campo de comparecimento** (ex.: `lead_purchases.attended` boolean ou tabela `service_completions`) — habilita Taxa de Comparecimento (peso 10% do Reputation).
* **Campo/fonte de gasto de marketing** (ex.: `marketing_spend` por período/canal) — habilita CAC e LTV/CAC automáticos.
* **(Opcional) Marcador explícito de contratação** em `leads` (ex.: `hired_at`) — remove a ambiguidade de "contratação" da Seção 10.3 (1).

> Todas as propostas acima respeitam as convenções do schema (UUID, `created_at/updated_at`, soft delete onde crítico) e a regra de que nenhuma tabela é criada fora da especificação sem aprovação.
