# referral-engine.md

# Referral Engine — Motor de Indicações

Projeto: FazTudo

Versão: 1.0

Status: Documento Oficial

---

# 1. Objetivo

O Referral Engine é o motor responsável por organizar, executar e proteger o **Programa de Indicação** do FazTudo.

Seu papel é transformar usuários satisfeitos em um canal de aquisição de baixo custo, criando um ciclo de crescimento orgânico (viral) em que profissionais convidam outros profissionais para a plataforma.

Este documento é **complementar** ao Gamification Engine (08) e ao Lead Engine (02). Ele **não redefine** a regra de recompensa de XP da gamificação — essa permanece como fonte da verdade no documento 08. Aqui o foco é o **mecanismo de indicação**: como o convite é gerado, rastreado, validado, bonificado, limitado e protegido contra fraude.

Objetivos específicos:

* reduzir o Custo de Aquisição de Clientes (CAC) via canal de indicação;
* aumentar o fator de viralidade (fator-k) da plataforma;
* recompensar de forma justa e auditável quem traz novos profissionais qualificados;
* garantir que toda recompensa seja creditada apenas após validação real do indicado;
* impedir abuso (auto-indicação, contas falsas, fazendas de indicação);
* habilitar campanhas sazonais e multiplicadores temporários de forma configurável.

---

# 2. Escopo

## 2.1 Dentro do escopo

* Geração de **códigos** e **links de convite** por usuário.
* Definição de **quem pode indicar quem**.
* Rastreamento do vínculo indicador → indicado (atribuição).
* Regras de **validação** do que conta como "indicação aprovada".
* Creditação de **bônus** (créditos e XP) através dos motores existentes.
* **Limites** de indicações bonificadas por período.
* **Antifraude** específico de indicação, integrado ao Anti-Fraud Engine.
* **Campanhas** e multiplicadores temporários.
* **Métricas** de conversão, CAC por indicação e viralidade.

## 2.2 Fora do escopo (delegado a outros motores)

* **Concessão efetiva de créditos / carteira / histórico financeiro** → Payment Engine (05) via tabelas `CREDIT_WALLETS` e `CREDIT_TRANSACTIONS`.
* **Concessão e cálculo de XP / níveis** → Gamification Engine (08) via `XP_TRANSACTIONS`. O Referral Engine apenas **dispara** o evento; os valores são propriedade do doc 08.
* **Distribuição de leads** → Lead Engine (02) e Matching Engine (06).
* **Validação de identidade / verificação de documento** → Payment Engine (05) e fluxo de `VERIFICATION_REQUESTS`.
* **Regras gerais e motor central de detecção de fraude** → `anti-fraud-engine.md` (dependência **disponível** em docs/19; integração a detalhar na implementação — ver seção 6 e seção 10).

## 2.3 Atores

* **Indicador (referrer):** usuário que compartilha o convite. No MVP, **profissional**.
* **Indicado (referee):** novo usuário que se cadastra a partir do convite.
* **Administrador:** monitora, ajusta, reprocessa e bloqueia indicações suspeitas.
* **Sistema:** valida automaticamente e dispara recompensas.

---

# 3. Regras de Negócio

## 3.1 Quem pode indicar quem

* No MVP, **profissional indica profissional** (alinhado ao doc 08 — "Profissional indica profissional" — e ao doc 02 — "Profissional indica profissional").
* O indicador deve ter conta **ativa** (`users.status = active`).
* O indicado deve ser um **novo usuário** — e-mail e telefone **inéditos** na base (respeitando `email UNIQUE` e `phone UNIQUE` de `USERS`).
* Indicação de **contratante por profissional** (e vice-versa) fica fora do MVP e é tratada no Roadmap (seção 9).

## 3.2 Recompensa por indicação aprovada

A recompensa oficial por **indicação aprovada** segue o Gamification Engine (08), que é a fonte da verdade:

| Recompensa | Valor | Beneficiário | Motor responsável |
|------------|-------|--------------|-------------------|
| Créditos   | **+5 créditos** | Indicador | Payment Engine (05) — `CREDIT_TRANSACTIONS.type = bonus` |
| XP         | **+100 XP** | Indicador | Gamification Engine (08) — `XP_TRANSACTIONS.source = referral` |

Observações:

* O Referral Engine **não recalcula** nem **redefine** esses valores; ele os **referencia** e dispara os eventos. Qualquer alteração de valor é feita no doc 08.
* No MVP, a bonificação é concedida **ao indicador**. Um bônus de boas-vindas ao **indicado** é proposto no Roadmap (seção 9) e deve ser definido pelo doc 08 antes de ser ativado.
* Multiplicadores de campanha (seção 3.7) podem ampliar temporariamente esses valores, sempre como multiplicador sobre a base definida no doc 08.

## 3.3 Quando a recompensa é creditada

A recompensa **só** é creditada **após cadastro completo e validação** do indicado. Não há crédito no momento do clique nem no simples cadastro inicial.

Sequência:

1. Indicado clica no link / informa o código.
2. Indicado conclui o **cadastro completo** (perfil profissional preenchido).
3. O indicado atinge o **critério de validação** definido na seção 3.5 ("indicação aprovada").
4. O antifraude (seção 6) aprova o vínculo.
5. **Somente então** o sistema credita +5 créditos (carteira) e +100 XP (gamificação) ao indicador.

Isto é coerente com o doc 02 ("Indicado conclui cadastro → Indicação validada → Indicação bonificada") e com o princípio do doc 08 ("Toda recompensa deve passar por validação backend").

## 3.4 Estados de uma indicação

| Estado | Significado |
|--------|-------------|
| `pending` | Convite emitido/clicado; indicado ainda não concluiu validação. |
| `registered` | Indicado concluiu cadastro completo, mas ainda não atingiu o critério de aprovação. |
| `approved` | Critério de aprovação atingido e antifraude aprovado → recompensa creditada. |
| `rejected` | Reprovado pela validação ou pelo antifraude → sem recompensa. |
| `flagged` | Sob revisão antifraude (recompensa retida até decisão). |
| `reversed` | Recompensa estornada após fraude detectada posteriormente (ver seção 5.4). |

## 3.5 O que conta como "indicação aprovada" (validações)

Uma indicação é considerada **aprovada** quando **todas** as condições abaixo são satisfeitas:

1. **Vínculo válido:** existe atribuição correta indicador → indicado (código/link rastreado).
2. **Novo usuário real:** e-mail e telefone inéditos e validados; não é conta duplicada do próprio indicador.
3. **Cadastro completo:** perfil profissional do indicado preenchido (equivalente ao marco "Cadastro completo" do doc 08).
4. **Marco de ativação atingido:** para evitar bonificar cadastros vazios, o indicado deve cumprir **pelo menos um** marco de ativação real. Critério padrão do MVP:
   * **telefone validado** (consistente com o "telefone validado" do Perfil Verificado, doc 05); **e**
   * **primeira ação econômica/engajamento:** primeira compra de crédito **ou** primeira compra de lead (`LEAD_PURCHASES`).
5. **Aprovação antifraude:** nenhum sinal de fraude bloqueante (seção 6).

> Observação de configurabilidade: o "marco de ativação" (item 4) é **parametrizável** por campanha. Campanhas mais agressivas de aquisição podem aprovar já no telefone validado; campanhas focadas em qualidade podem exigir a primeira compra. O valor padrão do MVP é o descrito acima. (Ponto de configuração — ver seção 10.)

## 3.6 Limites de indicações bonificadas por período

Para conter abuso e controlar custo, aplicam-se limites de **indicações bonificadas** (não de convites enviados):

| Limite | Valor padrão (MVP) | Observação |
|--------|--------------------|------------|
| Indicações bonificadas por indicador / mês | **10** | Excedentes registram a indicação mas **não** geram bônus (`rejected` com motivo `limit_reached`). |
| Indicações bonificadas por indicador / total no MVP | **50** | Teto de segurança configurável. |
| Convites pendentes simultâneos | **100** | Anti-spam de geração de links. |
| Janela de atribuição (clique → cadastro) | **30 dias** | Após esse prazo o vínculo expira. |

Todos os limites são **configuráveis** por administrador e podem ser sobrescritos por campanha. (Ponto de configuração — ver seção 10.)

## 3.7 Campanhas e multiplicadores

O Referral Engine suporta **campanhas sazonais configuráveis** com **multiplicadores temporários**, no mesmo espírito dos "Desafios" e "Temporadas" do doc 08.

* **Multiplicador de recompensa:** ex.: campanha "Indique e Ganhe — Junho" com multiplicador **2x** → 10 créditos e 200 XP por indicação aprovada (sempre derivados da base do doc 08).
* **Vigência:** `starts_at` / `ends_at`. Fora da vigência, vale a recompensa base.
* **Segmentação:** por categoria, cidade/estado (alinhado à modelagem geográfica de `LEADS` e perfis) ou nível do indicador.
* **Limite específico de campanha:** uma campanha pode definir seu próprio teto de indicações bonificadas e/ou orçamento total de créditos.
* **Prioridade:** havendo múltiplas campanhas ativas, aplica-se a de maior prioridade (sem empilhar multiplicadores), evitando explosão de custo.

As campanhas são propostas via tabela `referral_campaigns` (seção, "Modelo de Dados — proposta complementar").

## 3.8 Princípios invioláveis

* Recompensa **somente** após validação backend (doc 08).
* Toda movimentação de crédito **gera histórico** e **nunca** é apagada (doc 04 / doc 05).
* Indicações e recompensas são **auditáveis** (doc 04 — `AUDIT_LOGS`).
* O Referral Engine **não** cria créditos diretamente: ele solicita ao Payment Engine um lançamento `bonus`.

---

# 4. Fluxos

## 4.1 Geração do convite

```text
Profissional acessa "Indique e Ganhe"
        ↓
Sistema gera (ou recupera) referral_code único do usuário
        ↓
Sistema monta link: https://trampoja.com/r/{referral_code}
        ↓
Profissional compartilha (WhatsApp, redes, etc.)
```

* O `referral_code` é **estável** por usuário (um código por indicador), facilitando reuso e métricas.
* O link pode opcionalmente carregar `?camp={campaign}` para atribuição de campanha.

## 4.2 Atribuição e cadastro do indicado

```text
Indicado clica no link / informa o código no cadastro
        ↓
Sistema registra referral (status = pending) com IP, user_agent, device
        ↓
Indicado conclui cadastro completo (profile)
        ↓
status = registered
        ↓
Indicado valida telefone + realiza 1ª compra (crédito ou lead)
        ↓
Critério de aprovação (3.5) atingido
```

## 4.3 Validação, antifraude e bonificação

```text
Critério de aprovação atingido
        ↓
Anti-Fraud Engine avalia o vínculo (IP/device/padrão/contas)
        ↓
   ├── Suspeito → status = flagged → revisão admin
   └── Limpo →
            ↓
   Verifica limites do período (3.6)
            ↓
   Verifica campanha ativa e multiplicador (3.7)
            ↓
   Payment Engine: +5 créditos (×mult)  → CREDIT_TRANSACTIONS (bonus)
   Gamification Engine: +100 XP (×mult)  → XP_TRANSACTIONS (referral)
            ↓
   status = approved
            ↓
   Notificação ao indicador (NOTIFICATIONS)
            ↓
   AUDIT_LOGS registra a operação
```

## 4.4 Fluxo de revisão administrativa (flagged)

```text
status = flagged
        ↓
Admin analisa sinais e evidências
        ↓
   ├── Legítima → libera → approved → recompensa creditada
   └── Fraude   → rejected → sem recompensa → ADMIN_ACTIONS registra motivo
```

---

# 5. Casos Especiais

## 5.1 Indicado já existente

Se o e-mail/telefone do indicado já existir na base (`email/phone UNIQUE`), a indicação é `rejected` com motivo `already_exists`. Não há bônus.

## 5.2 Múltiplos indicadores para o mesmo indicado

Vale a regra de **primeira atribuição** (first-touch): o primeiro `referral_code` registrado dentro da janela de atribuição (3.6) é o vinculado. Convites posteriores para o mesmo indicado são `rejected` (`already_attributed`).

## 5.3 Indicado nunca ativa

Se o indicado não atingir o critério de aprovação dentro da janela de atribuição (30 dias), a indicação expira em `rejected` (`expired`). Sem bônus.

## 5.4 Fraude detectada após a recompensa

Se a fraude for confirmada **depois** de creditado o bônus:

* status → `reversed`;
* Payment Engine lança um **estorno de bônus** (`CREDIT_TRANSACTIONS.type = refund`/ajuste negativo, conforme política do doc 05 — nunca apagar o histórico original);
* Gamification Engine aplica o ajuste de XP correspondente (e, em fraude grave, a penalidade de `Fraude -1000 XP` do doc 08 pode incidir sobre o infrator);
* a conta pode ser suspensa/bloqueada conforme `users.status`.

## 5.5 Limite do período atingido

A indicação real e válida é registrada como `rejected` com motivo `limit_reached` (a indicação aconteceu, mas **não** é bonificada). Isso preserva a métrica de aquisição sem gerar custo de bônus.

## 5.6 Campanha encerrada entre cadastro e aprovação

Aplica-se o multiplicador **vigente no momento da aprovação** (não no clique). Se a campanha já encerrou, vale a recompensa base. (Regra de simplicidade e previsibilidade de custo — ver seção 10.)

## 5.7 Indicador suspenso/bloqueado

Se o indicador estiver `suspended`/`blocked` no momento da aprovação, a recompensa fica retida (`flagged`) até decisão administrativa.

---

# 6. Segurança (Antifraude)

> **Dependência:** o motor central de detecção de fraude está especificado em `anti-fraud-engine.md`, documento **disponível** em `docs/19-anti-fraud-engine/anti-fraud-engine.md`. O Referral Engine **consome** esse motor e **não duplica** suas regras; a integração será detalhada na implementação. As regras gerais de detecção (sinais, scoring, bloqueios) são propriedade desse documento; abaixo descrevem-se apenas os **gatilhos e políticas específicos de indicação**.

## 6.1 Vetores de abuso tratados

* **Auto-indicação:** indicador e indicado são a mesma pessoa/conta.
* **Contas falsas / fazenda de indicações:** criação de muitas contas só para coletar bônus.
* **Mesmo IP / mesmo dispositivo:** indicador e indicado compartilham IP/`device_fingerprint`.
* **Manipulação de campanha:** picos artificiais durante multiplicadores.

## 6.2 Sinais de detecção (integração)

O Referral Engine envia ao Anti-Fraud Engine o contexto da indicação e consome o veredito. Sinais relevantes (alinhados aos já citados em outros docs):

* **IP repetido** e **dispositivo repetido** entre indicador e indicado — sinais explicitamente listados no Reputation Engine (07, "Detecção de Fraude") e no anti-fraude do Lead Engine (02).
* **Múltiplas contas** associadas ao mesmo titular (doc 02 / doc 07).
* Telefone/CPF inconsistentes ou recém-criados em massa.
* Padrão temporal anormal (várias indicações em segundos).
* Correlação com dados de verificação (`VERIFICATION_REQUESTS`, doc 05).

## 6.3 Políticas específicas de indicação

* Auto-indicação detectada → bloqueio imediato (`rejected`/`flagged`), sem bônus.
* Coincidência de IP/dispositivo → indicação `flagged` para revisão; não credita automaticamente.
* Recompensa **sempre** retida até veredito antifraude (a creditação é o último passo do fluxo 4.3).
* Reincidência → encaminhamento ao Anti-Fraud Engine para penalidade de conta (suspensão/bloqueio) e, em fraude grave, penalidade de XP do doc 08.

## 6.4 Segurança técnica

* `referral_code` não sequencial e não adivinhável.
* Rate limiting na geração de links e no registro de indicações (doc 03 — "Rate Limiting").
* Webhooks/eventos internos idempotentes para evitar dupla creditação (doc 05 — "Idempotência").
* Validação de propriedade (ownership) e proteção IDOR ao consultar indicações (doc 03).
* Toda decisão sensível registrada em `AUDIT_LOGS` e ações de admin em `ADMIN_ACTIONS`.

---

# 7. Auditoria

Coerente com as regras de integridade do doc 04 e da auditoria do doc 05:

* **Nada é apagado:** registros de indicação e de bônus são imutáveis; correções entram como novos lançamentos (estorno/ajuste).
* **Toda creditação de bônus** gera `CREDIT_TRANSACTIONS` (`type = bonus`) com `balance_before`/`balance_after`.
* **Toda concessão de XP** gera `XP_TRANSACTIONS` (`source = referral`).
* **Toda operação de indicação** (aprovação, rejeição, flag, estorno) gera `AUDIT_LOGS` com `user_id`, `action`, `entity = referral`, `entity_id`, `ip_address`, `user_agent`.
* **Ações administrativas** (liberar flagged, estornar, bloquear) geram `ADMIN_ACTIONS` com `reason`.
* **Rastreabilidade ponta a ponta:** dado um bônus, é possível chegar à indicação de origem e ao indicado; dada uma indicação, é possível chegar à transação de bônus e XP.

Campos de auditoria propostos diretamente na tabela `referrals` (seção de Modelo de Dados): `ip_address`, `user_agent`, `device_fingerprint`, `approved_at`, `rejected_reason`.

---

# 8. Métricas

Métricas próprias do Referral Engine, complementando o doc 02 (CAC, LTV) e o doc 08 (retenção/engajamento):

| Métrica | Definição |
|---------|-----------|
| **Convites emitidos** | nº de links/códigos efetivamente compartilhados (cliques únicos). |
| **Taxa de conversão de convites** | indicações `approved` ÷ convites/cliques rastreados. |
| **Taxa de ativação do indicado** | indicados que atingiram o marco de ativação (3.5) ÷ indicados cadastrados. |
| **CAC por indicação** | custo total em créditos bonificados (× valor monetário do crédito, doc 05) ÷ indicados aprovados. |
| **Fator-k (viralidade)** | (convites enviados por usuário) × (taxa de conversão de convites). k > 1 indica crescimento viral. |
| **Tempo médio até aprovação** | clique → `approved`. |
| **Taxa de fraude de indicação** | indicações `rejected`/`reversed` por fraude ÷ total de indicações. |
| **LTV do indicado vs. CAC** | reuso do LTV do doc 02/05 para medir ROI do canal. |
| **Indicações por campanha** | volume e custo por campanha (avaliação de ROI sazonal). |

Essas métricas alimentam o Painel Financeiro Admin (doc 05) e o painel de métricas do negócio (doc 03).

---

# 9. Roadmap

| Versão | Entrega |
|--------|---------|
| **V1 (MVP)** | Código/link por profissional; aprovação após cadastro completo + ativação; +5 créditos e +100 XP ao indicador (doc 08); limites mensais; antifraude básico (auto-indicação, IP/dispositivo); auditoria. |
| **V2** | Campanhas sazonais e multiplicadores temporários configuráveis (`referral_campaigns`); bônus de boas-vindas ao **indicado** (valores a definir no doc 08); dashboard de indicações para o profissional. |
| **V3** | Indicação cruzada (profissional ↔ contratante); recompensas por marcos do indicado (ex.: bônus extra quando o indicado conclui o 1º serviço); níveis de indicador (embaixadores). |
| **V4** | Integração plena e em tempo real com o Anti-Fraud Engine (scoring preditivo); detecção de fazendas de indicação por grafo de relacionamento. |
| **V5** | Atribuição multi-touch e otimização de campanhas por IA; personalização de recompensa por propensão de conversão. |

---

# 10. Conflitos e Observações

## 10.1 Conflitos identificados entre documentos

1. **Apresentação da recompensa de indicação (créditos + XP):**
   * **Gamification Engine (08)** define, de forma consolidada, **indicação aprovada → +100 XP e +5 créditos**.
   * **Lead Engine (02)** apresenta a recompensa **fragmentada**: na seção "Sistema de XP" lista "Indicação aprovada +100 XP", mas na seção "Programa de Indicação" descreve apenas "Recompensa: 5 créditos", **sem repetir o XP**.
   * **Não há conflito de valor** (ambos batem em 100 XP e 5 créditos), mas há **conflito de completude/apresentação**: lendo apenas o "Programa de Indicação" do doc 02 isoladamente, parece que só há recompensa em créditos.
   * **Resolução adotada:** este documento trata o doc 08 como fonte da verdade e consolida **+100 XP e +5 créditos** como a recompensa única e completa. **Recomendação:** alinhar o doc 02 para citar ambas as recompensas (ou referenciar o doc 08) e evitar leitura parcial.

2. **Recompensa de "Indicar 1 profissional" como missão (doc 08):**
   * O doc 08 também lista, em **Missões Semanais**, "Indicar 1 profissional → 150 XP".
   * Isso **não conflita** com a recompensa de indicação aprovada (100 XP + 5 créditos): são eventos distintos (missão semanal de engajamento vs. indicação efetivamente aprovada). Porém, há **risco de dupla contagem de XP** se os dois forem disparados pela mesma ação sem regra clara.
   * **Recomendação:** o Gamification Engine deve definir explicitamente se a conclusão da missão "Indicar 1 profissional" (150 XP) é **adicional** à indicação aprovada (100 XP) ou mutuamente exclusiva. Este motor apenas dispara o evento de "indicação aprovada"; a missão é responsabilidade do doc 08.

3. **Terminologia "indicação validada" vs. "indicação aprovada":**
   * Doc 02 usa "Indicação validada / bonificada"; doc 08 usa "Indicação aprovada".
   * Tratados aqui como **sinônimos** (estado `approved`). Recomenda-se padronizar o termo "aprovada".

## 10.2 Dependências e ausências

* **`anti-fraud-engine.md` disponível (docs/19):** este motor depende dele para o scoring central de fraude, agora documentado em `docs/19-anti-fraud-engine/anti-fraud-engine.md`. O Referral Engine aplica as **políticas locais** da seção 6 (auto-indicação, IP/dispositivo, limites) e marca como `flagged` o que exigir análise, encaminhando ao motor central; a integração será detalhada na implementação. As regras gerais **não** foram duplicadas aqui — vivem no documento próprio (docs/19).
* **README desatualizado:** o índice (`docs/README.md`) lista apenas 01–08, mas o repositório já contém `10-notification-engine` e `11-chat-engine` (e agora `14-referral-engine`). Recomenda-se atualizar o índice. (Observação de organização — não afeta as regras deste motor.)
* **Numeração:** este documento foi criado como **14** conforme solicitado, embora não haja docs 09, 12 e 13 visíveis. Sem impacto funcional.

## 10.3 Pontos de configuração (parametrizáveis, não fixados como regra rígida)

* Marco de ativação do indicado (telefone validado; 1ª compra de crédito ou lead) — seção 3.5.
* Limites por período (10/mês, 50 total, janela de 30 dias) — seção 3.6.
* Multiplicadores, vigência e teto de campanha — seção 3.7.
* Política de "multiplicador no momento da aprovação" — seção 5.6.

---

# Modelo de Dados (proposta complementar)

> As tabelas abaixo são **extensões propostas** ao schema oficial (doc 04). Seguem as convenções do doc 04 (PK `id UUID`, `created_at`/`updated_at`, soft delete em entidades críticas). **Não substituem** nem alteram tabelas existentes; reaproveitam `USERS`, `CREDIT_TRANSACTIONS`, `XP_TRANSACTIONS`, `AUDIT_LOGS`, `NOTIFICATIONS`.

## Tabela proposta: `referrals`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK. |
| `referrer_user_id` | UUID | FK → `users.id` (indicador). |
| `referee_user_id` | UUID (nullable) | FK → `users.id` (indicado; preenchido após cadastro). |
| `referral_code` | string | Código usado na atribuição. |
| `campaign_id` | UUID (nullable) | FK → `referral_campaigns.id` (se houver campanha). |
| `status` | enum | `pending` / `registered` / `approved` / `rejected` / `flagged` / `reversed`. |
| `rejected_reason` | string (nullable) | Ex.: `already_exists`, `already_attributed`, `expired`, `limit_reached`, `fraud`. |
| `credits_awarded` | int | Créditos efetivamente concedidos (após multiplicador). |
| `xp_awarded` | int | XP efetivamente concedido (após multiplicador). |
| `ip_address` | string | Auditoria/antifraude. |
| `user_agent` | string | Auditoria/antifraude. |
| `device_fingerprint` | string (nullable) | Antifraude (IP/dispositivo repetido). |
| `attributed_at` | timestamp | Momento do clique/atribuição. |
| `approved_at` | timestamp (nullable) | Momento da aprovação. |
| `created_at` | timestamp | Convenção doc 04. |
| `updated_at` | timestamp | Convenção doc 04. |
| `deleted_at` | timestamp (nullable) | Soft delete. |

**Constraints sugeridas:** `UNIQUE(referee_user_id)` (um indicado é atribuído a um único indicador — first-touch); índice em `referrer_user_id`, `status`, `campaign_id`, `referral_code`.

## Tabela proposta: `referral_campaigns`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK. |
| `name` | string | Nome da campanha (ex.: "Indique e Ganhe — Junho"). |
| `slug` | string | Identificador legível. |
| `credit_multiplier` | decimal | Multiplicador sobre os 5 créditos base (doc 08). |
| `xp_multiplier` | decimal | Multiplicador sobre os 100 XP base (doc 08). |
| `max_bonused_referrals` | int (nullable) | Teto de indicações bonificadas da campanha. |
| `activation_rule` | enum/json | Marco de ativação aceito (telefone / 1ª compra). |
| `target_filters` | json (nullable) | Segmentação (categoria, cidade, estado, nível). |
| `priority` | int | Desempate entre campanhas ativas. |
| `starts_at` | timestamp | Início da vigência. |
| `ends_at` | timestamp | Fim da vigência. |
| `active` | boolean | Liga/desliga. |
| `created_at` | timestamp | Convenção doc 04. |
| `updated_at` | timestamp | Convenção doc 04. |

## Extensões propostas a tabelas existentes (sem quebrar o schema)

* `PROFESSIONAL_PROFILES` (ou `USERS`): campo opcional **`referral_code`** (string, único) — código estável de convite do usuário.
* `XP_TRANSACTIONS.source`: passar a aceitar o valor **`referral`** (o campo `source` já existe; apenas formaliza-se o valor).
* `CREDIT_TRANSACTIONS.transaction_type`: o tipo **`bonus`** já existe no doc 04 e é reaproveitado para a indicação (nenhum novo tipo necessário).

---

_Fim do documento — referral-engine.md (v1.0)._
