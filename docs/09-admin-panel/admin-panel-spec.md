# admin-panel-spec.md

# Painel Administrativo (Admin Panel)

Projeto: FazTudo

Versão: 1.0

Status: Documento Oficial

---

> Documentos relacionados (fonte da verdade):
> `01-projeto/master-task.md`, `02-lead-engine/lead-engine.md`, `03-arquitetura/marketplace-architecture.md`, `04-banco-de-dados/database-schema.md`, `05-payment-engine/payment-engine.md`, `06-matching-engine/matching-engine.md`, `07-reputation-engine/reputation-engine.md`, `08-gamification-engine/gamification-engine.md`.
>
> Dependência externa disponível: `anti-fraud-engine.md` (docs/19-anti-fraud-engine/anti-fraud-engine.md) — integração a detalhar na implementação. Toda regra de detecção/scoring de fraude é de responsabilidade do Anti-Fraud Engine; este documento apenas consome seus sinais e descreve as ações administrativas correspondentes.
>
> Este documento **complementa** a seção "Painel Administrativo" de `03-arquitetura/marketplace-architecture.md` e o "Painel Financeiro Admin" de `05-payment-engine/payment-engine.md`. Não reescreve arquitetura nem schema. Extensões ao banco aparecem exclusivamente na subseção "Modelo de Dados (proposta complementar)".

---

# 1. Objetivo

O Painel Administrativo é a interface centralizada de operação, moderação, monetização e governança da plataforma FazTudo. Ele existe para que a equipe interna possa:

* operar e monitorar todo o marketplace (usuários, profissionais, contratantes, leads, créditos e finanças) a partir de um único ponto de controle;
* moderar conteúdo gerado por usuários (avaliações e denúncias) preservando confiança e qualidade;
* aprovar ou rejeitar verificações de identidade (KYC) que sustentam o produto "Perfil Verificado" descrito em `05-payment-engine/payment-engine.md`;
* executar intervenções financeiras controladas (reembolsos em créditos, ajustes manuais de saldo) com **rastreabilidade financeira total**, conforme `04-banco-de-dados/database-schema.md` (Regras de Integridade) e `05-payment-engine/payment-engine.md`;
* consumir sinais do Anti-Fraud Engine e aplicar ações administrativas (suspender, bloquear, congelar créditos) sem duplicar as regras de detecção;
* consultar a trilha de auditoria (`audit_logs` e `admin_actions`) e produzir métricas e relatórios executivos.

Princípio inegociável (alinhado a `04-banco-de-dados/database-schema.md`): **toda ação administrativa deve gerar auditoria**, **transações financeiras nunca podem ser apagadas**, **avaliações nunca podem ser alteradas diretamente** e **registros críticos usam soft delete** (`deleted_at`), nunca remoção física.

---

# 2. Escopo

## 2.1 Dentro do escopo

O Painel Administrativo corresponde ao **Módulo Administrativo** descrito em `03-arquitetura/marketplace-architecture.md` (backend `app/api/admin/`, frontend `src/modules/admin/`). Cobre:

| # | Área | Tabelas principais consumidas |
|---|------|-------------------------------|
| 1 | Dashboard executivo (KPIs) | agregações sobre `leads`, `lead_purchases`, `payment_orders`, `credit_transactions`, `reviews`, `users` |
| 2 | Gestão de usuários | `users`, `audit_logs`, `admin_actions` |
| 3 | Gestão de profissionais | `professional_profiles`, `professional_categories`, `credit_wallets` |
| 4 | Gestão de contratantes | `customer_profiles` |
| 5 | Gestão de leads | `leads`, `lead_purchases`, `conversations` |
| 6 | Gestão financeira | `payment_orders`, `credit_packages`, `credit_transactions` |
| 7 | Gestão de créditos (ajuste manual) | `credit_wallets`, `credit_transactions`, `admin_actions` |
| 8 | Moderação de avaliações | `reviews`, `admin_actions` |
| 9 | Moderação de denúncias | `reports`, `admin_actions` |
| 10 | Gestão de verificações (KYC) | `verification_requests`, `admin_actions` |
| 11 | Antifraude (painel + ações) | sinais do Anti-Fraud Engine, `users`, `credit_wallets`, `admin_actions` |
| 12 | Auditoria | `audit_logs`, `admin_actions` |
| 13 | Permissões administrativas (RBAC interno) | `users` (`role = admin`) + proposta complementar |
| 14 | Métricas | agregações multi-tabela |
| 15 | Relatórios / exportações | agregações multi-tabela |

## 2.2 Fora do escopo

* **Regras de detecção de fraude** (scoring, heurísticas, modelos) — pertencem a `anti-fraud-engine.md`.
* **Cálculo de reputação** — pertence a `07-reputation-engine/reputation-engine.md`. O admin apenas modera entradas (avaliações/denúncias) que alimentam o engine; nunca edita `reputation_score` à mão.
* **Cálculo de matching score / ranking** — pertence a `06-matching-engine/matching-engine.md`. O admin nunca altera score, ranking ou posição (proibição explícita do Matching Engine: "Toda pontuação deve ser calculada no backend").
* **Concessão manual de XP, níveis ou medalhas** — pertence a `08-gamification-engine/gamification-engine.md` ("Toda recompensa deve passar por validação backend").
* **Processamento de pagamento/gateway** — pertence a `05-payment-engine/payment-engine.md`; o admin apenas consulta `payment_orders` e dispara reembolso em créditos.

## 2.3 Stack (referência, não reescrita)

Frontend Next.js + TypeScript + TailwindCSS + Shadcn UI + React Query + Zustand + React Hook Form + Zod. Backend FastAPI + Python + Pydantic + SQLAlchemy + Alembic + JWT. PostgreSQL + Redis + S3 Compatible (MinIO em dev, Cloudflare R2 em produção). Conforme `03-arquitetura/marketplace-architecture.md`.

---

# 3. Regras de Negócio

## 3.1 Regras transversais (toda ação administrativa)

1. **RN-ADM-01 — Auditoria obrigatória.** Toda ação administrativa que altera estado gera **dois** registros: um em `audit_logs` (rastro técnico genérico: `user_id`, `action`, `entity`, `entity_id`, `ip_address`, `user_agent`) e um em `admin_actions` (rastro de negócio: `admin_id`, `action`, `target_entity`, `target_id`, `reason`). O campo `reason` é **obrigatório** para ações de moderação, financeiras e de bloqueio.
2. **RN-ADM-02 — Soft delete.** Nenhum registro crítico é apagado fisicamente; usa-se `deleted_at`. Aplica-se a `users`, `leads`, `reviews` e demais entidades críticas.
3. **RN-ADM-03 — Imutabilidade financeira.** `credit_transactions` e `payment_orders` nunca são editados ou apagados. Correções são feitas por **novos lançamentos compensatórios** (ex.: ajuste, estorno), nunca por update.
4. **RN-ADM-04 — Imutabilidade de avaliações.** O admin não edita o conteúdo de uma `review`. Pode ocultar/remover via soft delete (proposta complementar) com motivo registrado, mantendo o histórico.
5. **RN-ADM-05 — Ownership e RBAC.** Todo endpoint admin valida `role = admin` (em `users.role`) e o sub-papel administrativo (ver seção "Permissões administrativas"). Proteção IDOR: nenhum identificador de alvo é confiado sem verificação de permissão do sub-papel.
6. **RN-ADM-06 — Rate limit.** Endpoints administrativos sensíveis (ajuste de crédito, bloqueio, exportação) possuem rate limit dedicado por admin, conforme padrão de segurança de `03-arquitetura/marketplace-architecture.md`.
7. **RN-ADM-07 — Segregação de funções.** Quem aprova KYC não precisa ter poder financeiro; quem ajusta crédito não precisa moderar conteúdo. A matriz de permissões (seção 13) garante o menor privilégio.
8. **RN-ADM-08 — Não duplicar engines.** O painel nunca recalcula reputação, matching score, XP ou fraude; ele consome resultados e modera as entradas.

## 3.2 Regras por área

### Gestão de usuários (`users`)
* **RN-USR-01** — Estados válidos de `users.status`: `active`, `suspended`, `blocked` (conforme schema). O admin transita entre esses estados; não inventa novos status.
* **RN-USR-02** — `suspend` é reversível (volta a `active`); `block` é a medida mais severa e tipicamente associada a fraude/chargeback. Ambos exigem `reason`.
* **RN-USR-03** — Soft delete de conta (`deleted_at`) preserva integridade de leads, transações e avaliações vinculados.
* **RN-USR-04** — Admin **não** vê/edita `password_hash`. Reset de senha apenas dispara o fluxo de recuperação (Módulo de Autenticação), nunca define senha manualmente.

### Gestão de profissionais (`professional_profiles`)
* **RN-PRO-01** — Campos `verified` e `premium` são **derivados** de processos (KYC e assinatura). O admin altera `verified` apenas via aprovação de `verification_requests`; altera `premium` apenas como exceção corretiva auditada (ver Conflitos, item sobre `subscriptions`).
* **RN-PRO-02** — Admin **não** edita `rating`, `total_reviews`, `xp`, `level`, `reputation_score` manualmente (pertencem a Reputation/Gamification engines).
* **RN-PRO-03** — Admin pode editar dados cadastrais factuais (`headline`, `bio`, `city`, `state`, vínculos em `professional_categories`) apenas para correção/moderação, sempre auditado.
* **RN-PRO-04** — `availability_status` (`available`, `busy`, `unavailable`) é controlado pelo profissional; o admin só altera em casos de moderação (ex.: forçar `unavailable` durante investigação), com motivo.

### Gestão de contratantes (`customer_profiles`)
* **RN-CON-01** — Contratante "não paga" (`master-task.md`); a gestão foca em moderação, reputação recebida e prevenção de maus contratantes (alinhado a Reputation Engine).
* **RN-CON-02** — Admin não edita `reputation_score` do contratante.

### Gestão de leads (`leads`, `lead_purchases`)
* **RN-LED-01** — Status válidos de `leads.status`: `open`, `purchased`, `closed`, `cancelled`. `lead_type`: `one_time`, `temporary`, `permanent`. `urgency`: `immediate`, `today`, `this_week`, `flexible` (todos conforme schema).
* **RN-LED-02** — Cancelar lead pelo admin (`status = cancelled`) deve, quando já houver compra, disparar avaliação de reembolso em créditos (ver RN-CRD).
* **RN-LED-03** — `lead_purchases.lead_id` é UNIQUE (MVP = Lead Exclusivo, conforme schema e Matching Engine). O admin não cria compras manualmente.
* **RN-LED-04** — `credits_cost` segue a classificação do Lead Engine (Simples = 1, Médio = 3, Premium = 5). O admin não precifica leads individuais à mão; pode reclassificar categoria/tipo somente para correção auditada.

### Gestão financeira (`payment_orders`, `credit_packages`)
* **RN-FIN-01** — Status de `payment_orders`: `pending`, `paid`, `failed`, `refunded`. O admin **não** marca um pedido como `paid` manualmente (isso é responsabilidade do webhook do gateway, `05-payment-engine/payment-engine.md`); pode iniciar `refunded` conforme política.
* **RN-FIN-02** — A política oficial de reembolso é **devolver créditos, nunca dinheiro** (`05-payment-engine/payment-engine.md`). O status `refunded` de `payment_orders` representa exceções legais/chargeback, não o fluxo padrão de reembolso de lead.
* **RN-FIN-03** — Gestão de `credit_packages` (criar/ativar/desativar, ajustar `name`/`credits`/`price`) é privativa do papel Financeiro/Super Admin. Pacotes oficiais iniciais conforme `05-payment-engine/payment-engine.md` (Starter, Profissional, Avançado, Elite, Empresarial).

### Gestão de créditos / ajuste manual (`credit_wallets`, `credit_transactions`)
* **RN-CRD-01** — Todo ajuste manual gera uma `credit_transactions` com `transaction_type` em {`bonus`, `refund`} para crédito positivo ou um tipo de ajuste (ver proposta complementar) para débito corretivo, sempre com `balance_before` e `balance_after` corretos e `description` preenchida.
* **RN-CRD-02** — Reembolso de lead devolve **a mesma quantidade de créditos** consumida (`05-payment-engine/payment-engine.md`: lead de 3 créditos → 3 créditos retornam). Usa `transaction_type = refund`.
* **RN-CRD-03** — Ajuste manual exige `reason` em `admin_actions` e nunca edita transações anteriores (RN-ADM-03).
* **RN-CRD-04** — Em chargeback, os créditos adquiridos devem ser **bloqueados** e a conta suspensa (`05-payment-engine/payment-engine.md`). O bloqueio de créditos é uma ação administrativa específica (ver proposta complementar para campo de saldo bloqueado).

### Moderação de avaliações (`reviews`)
* **RN-REV-01** — Avaliação só existe após contato/compra/conversa (regra do Reputation Engine); o admin não cria avaliações.
* **RN-REV-02** — Avaliações marcadas como suspeitas pelo Anti-Fraud/Reputation engine entram na fila de moderação e **não contabilizam** até validação (Reputation Engine: "Não contabilizar até validação").
* **RN-REV-03** — O admin pode **aprovar** (contabiliza), **rejeitar/ocultar** (soft delete, não contabiliza) ou **escalar** uma avaliação. Nunca edita o texto/score.

### Moderação de denúncias (`reports`)
* **RN-DEN-01** — Status de `reports`: `open`, `investigating`, `resolved` (conforme schema). O admin transita entre eles.
* **RN-DEN-02** — Denúncia **válida** gera impacto imediato de reputação (responsabilidade do Reputation Engine) e pode disparar suspensão/bloqueio/remoção. Denúncia **falsa** não gera impacto. A classificação válida/falsa é decisão administrativa registrada.
* **RN-DEN-03** — Reclamações graves (golpe, assédio, ameaça, discriminação) têm tratamento prioritário e podem levar a bloqueio imediato (Reputation Engine).

### Gestão de verificações / KYC (`verification_requests`)
* **RN-KYC-01** — Status de `verification_requests`: `pending`, `approved`, `rejected` (conforme schema). Aprovar grava `reviewer_id` (= admin_id) e `reviewed_at`.
* **RN-KYC-02** — Aprovação do KYC libera o selo verificado: define `professional_profiles.verified = true`. Esta é a **única** via legítima de marcar `verified`.
* **RN-KYC-03** — Documentos (`document_front_url`, `document_back_url`, `selfie_url`) ficam em S3 com acesso restrito; o admin acessa via URL assinada temporária, com cada visualização auditada.
* **RN-KYC-04** — Rejeição exige `reason` (motivo retornado ao usuário) e mantém o pedido para reenvio.

### Antifraude (consumo de sinais)
* **RN-FRD-01** — O painel **não define** regras de fraude (ver `anti-fraud-engine.md`). Exibe sinais/score de risco e casos abertos pelo engine.
* **RN-FRD-02** — Ações administrativas disponíveis a partir de um caso: suspender, bloquear, congelar/desbloquear créditos, marcar avaliação como suspeita, escalar. Todas auditadas.
* **RN-FRD-03** — Exclusões de matching (bloqueados, suspensos, inadimplentes, contas suspeitas — `06-matching-engine/matching-engine.md`) são efeito automático dos estados que o admin aplica; o admin não edita a fila de matching diretamente.

---

# 4. Fluxos

Notação: cada fluxo descreve telas/menus, ação, papel mínimo e estados. As telas vivem sob `src/modules/admin/` e consomem endpoints sob `/admin/*` (FastAPI `app/api/admin/`).

## 4.1 Estrutura de navegação (menu lateral)

```text
Painel Administrativo
├── Dashboard Executivo
├── Usuários
│    ├── Todos os usuários
│    ├── Profissionais
│    └── Contratantes
├── Leads
├── Financeiro
│    ├── Receita & Pedidos
│    ├── Pacotes de Créditos
│    └── Ajustes de Crédito
├── Moderação
│    ├── Avaliações
│    └── Denúncias
├── Verificações (KYC)
├── Antifraude
├── Auditoria
├── Métricas
├── Relatórios
└── Administradores & Permissões   (somente Super Admin)
```

## 4.2 Fluxo — Login e sessão administrativa

```text
Admin acessa /admin
   ↓
Autenticação JWT (login do Módulo de Auth)
   ↓
Verifica users.role = admin  → falha ⇒ 403 + audit_log (acesso negado)
   ↓
Carrega sub-papel administrativo (admin_role)
   ↓
Renderiza menu conforme matriz de permissões (itens sem permissão ficam ocultos)
   ↓
Toda navegação sensível registra audit_log
```

## 4.3 Fluxo — Suspender/Bloquear usuário

```text
Tela: Usuários › detalhe do usuário
Ação: "Suspender" ou "Bloquear"
Papel mínimo: Moderador (suspender) / Super Admin (bloquear)
   ↓
Modal exige motivo (reason)  → vazio ⇒ ação bloqueada
   ↓
PATCH /admin/users/{id}/status  { status: suspended|blocked, reason }
   ↓
users.status atualizado (active → suspended → blocked)
   ↓
Efeitos: exclusão automática do matching (Matching Engine), sessões invalidadas
   ↓
Grava admin_actions (action=user_suspend/user_block) + audit_logs
   ↓
Notifica usuário (Sistema de Notificações)
```
Estados de saída: `active` ↔ `suspended` → `blocked`. Reversão de `blocked` apenas por Super Admin.

## 4.4 Fluxo — Aprovar/Rejeitar verificação (KYC)

```text
Tela: Verificações (KYC) › fila "pending"
Ação: abrir caso → visualizar documento + selfie (URL S3 assinada, auditada)
Papel mínimo: Suporte (analisar) / Moderador (decidir)
   ↓
Decisão:
   ├── Aprovar:  POST /admin/verifications/{id}/approve { reason? }
   │      ↓ status pending → approved; reviewer_id=admin; reviewed_at=now
   │      ↓ professional_profiles.verified = true  (RN-KYC-02)
   │      ↓ Payment Engine: selo liberado (Fluxo de Perfil Verificado)
   │      ↓ admin_actions + audit_logs + notificação
   └── Rejeitar: POST /admin/verifications/{id}/reject { reason }  (reason obrigatório)
          ↓ status pending → rejected; reviewer_id; reviewed_at
          ↓ usuário pode reenviar; admin_actions + audit_logs + notificação
```

## 4.5 Fluxo — Reembolso de lead em créditos

```text
Tela: Leads › detalhe do lead (com lead_purchases) OU Denúncias/Antifraude
Ação: "Reembolsar crédito"
Papel mínimo: Financeiro (ou Moderador, se ligado a moderação) — ver matriz
   ↓
Verifica elegibilidade (lead inválido / contato inexistente / fraude / erro plataforma — Payment Engine)
   ↓
Modal: confirma quantidade (= credits_used da lead_purchase) + motivo
   ↓
POST /admin/credits/refund { lead_purchase_id, reason }
   ↓
Cria credit_transactions { transaction_type=refund, amount=+credits_used,
                            balance_before, balance_after, description }
   ↓
credit_wallets.balance atualizado (nunca edita transação antiga — RN-ADM-03)
   ↓
(Opcional) leads.status → cancelled/closed conforme caso
   ↓
admin_actions (action=credit_refund) + audit_logs + notificação
```

## 4.6 Fluxo — Ajuste manual de créditos (bônus/correção)

```text
Tela: Financeiro › Ajustes de Crédito  (ou detalhe do profissional)
Ação: "Ajustar saldo"
Papel mínimo: Financeiro / Super Admin
   ↓
Modal: tipo (crédito + / débito corretivo −), quantidade, motivo (obrigatório)
   ↓
POST /admin/credits/adjust { professional_id, direction, amount, reason }
   ↓
Crédito (+): credit_transactions.transaction_type = bonus
Débito corretivo (−): transaction_type = adjustment (proposta complementar)
   ↓
balance_before / balance_after gravados; balance da wallet atualizado
   ↓
admin_actions (action=credit_adjust) + audit_logs + notificação
```
Estado: o saldo nunca pode ficar negativo; débito corretivo é validado contra `balance`.

## 4.7 Fluxo — Moderação de avaliação suspeita

```text
Tela: Moderação › Avaliações › filtro "suspeitas/em revisão"
Ação por item:
   ├── Aprovar  → avaliação passa a contabilizar (Reputation Engine recalcula)
   ├── Rejeitar → soft delete (deleted_at) + não contabiliza
   └── Escalar  → encaminha para Antifraude
Papel mínimo: Moderador
   ↓
POST /admin/reviews/{id}/moderate { decision, reason }
   ↓
Nunca altera score/comment (RN-ADM-04 / RN-REV-03)
   ↓
admin_actions (action=review_moderate) + audit_logs
```

## 4.8 Fluxo — Tratamento de denúncia

```text
Tela: Moderação › Denúncias › fila "open"
   ↓ Admin assume caso → status open → investigating  (admin_actions)
   ↓ Investiga (perfis, conversas, leads vinculados, sinais antifraude)
   ↓ Decisão:
       ├── Válida  → aplica ação (suspender/bloquear/remover conteúdo)
       │            Reputation Engine aplica impacto; status → resolved
       └── Falsa   → sem impacto de reputação; status → resolved
   ↓ reason obrigatório em admin_actions + audit_logs + notificação ao denunciante
```

## 4.9 Fluxo — Antifraude (caso de risco)

```text
Tela: Antifraude › lista de casos/score de risco (originados do Anti-Fraud Engine)
   ↓ Abrir caso (sinais: IP repetido, dispositivo, múltiplas contas, padrão anormal — fonte: anti-fraud-engine)
   ↓ Ações administrativas:
       ├── Suspender / Bloquear conta
       ├── Congelar créditos (chargeback) / Descongelar
       ├── Marcar avaliações vinculadas como suspeitas
       └── Escalar para Super Admin
   ↓ Cada ação grava admin_actions + audit_logs
   ↓ Resolver caso (resolução registrada; engine atualiza estado do caso)
```

## 4.10 Fluxo — Exportação de relatório

```text
Tela: Relatórios
   ↓ Seleciona tipo + período + filtros (cidade/categoria/status)
   ↓ POST /admin/reports/export { type, period, filters, format(csv|xlsx|pdf) }
   ↓ Geração assíncrona (worker) → arquivo em S3 (URL assinada, expira)
   ↓ admin_actions (action=report_export) + audit_logs (rastreia exportação de dados)
   ↓ Download disponibilizado ao admin; expira após período definido
```

---

# 5. Casos Especiais

| Caso | Tratamento |
|------|-----------|
| **Chargeback recebido** | Bloquear créditos adquiridos (saldo bloqueado), suspender conta, abrir caso antifraude (`05-payment-engine`). Nenhuma `credit_transactions` é apagada; cria-se lançamento de bloqueio. |
| **Reembolso quando saldo já consumido** | Reembolso devolve créditos à carteira independentemente do saldo atual (entra como `refund`); não reverte consumos passados. |
| **Lead cancelado pelo admin após compra** | `leads.status = cancelled` + reembolso em créditos ao(s) comprador(es); avaliações vinculadas, se existirem, vão para revisão. |
| **KYC aprovado mas pagamento do Perfil Verificado não confirmado** | Selo só é liberado com pagamento aprovado (Payment Engine, Fluxo de Perfil Verificado). Se KYC aprovado e pagamento pendente, manter `verified=false` até confirmação; registrar pendência. |
| **Avaliação suspeita em conta sob investigação** | Não contabilizar (RN-REV-02); congelar impacto até resolução do caso antifraude. |
| **Auto-ação do admin sobre a própria conta** | Proibido: admin não pode suspender/bloquear/ajustar a própria conta nem a de outro Super Admin (exceto pelo dono do sistema). Bloqueio reforçado por validação de ownership. |
| **Conta com leads abertos sendo bloqueada** | Bloqueio remove o profissional do matching; leads abertos permanecem para outros profissionais elegíveis; compras já efetuadas são preservadas. |
| **Soft delete de usuário com transações financeiras** | `deleted_at` no usuário; `credit_transactions`/`payment_orders` preservados integralmente (rastreabilidade financeira permanente). |
| **Denúncia grave (golpe/assédio/ameaça/discriminação)** | Fila prioritária; permite bloqueio imediato antes da conclusão da investigação, com reabertura possível (`07-reputation-engine`). |
| **Documento KYC ilegível/expirado** | Rejeitar com motivo padronizado; permitir reenvio; não bloquear a conta automaticamente. |
| **Exportação de dados pessoais (LGPD)** | Exportações que contêm dados pessoais exigem papel Super Admin/Financeiro e são integralmente auditadas (quem, quando, escopo). |
| **Pacote de créditos em uso sendo desativado** | Desativar (`active=false`) não afeta compras já realizadas; apenas remove o pacote da vitrine. |
| **Tentativa de marcar `payment_order` como `paid` manualmente** | Bloqueada por RN-FIN-01; status `paid` só via webhook do gateway. |

---

# 6. Segurança

Aplica integralmente os padrões obrigatórios de `03-arquitetura/marketplace-architecture.md` (JWT, Refresh Token, RBAC, Soft Delete, Rate Limiting, Auditoria, Ownership Validation, Proteção IDOR, Proteção Mass Assignment, Logs de Segurança).

* **Autenticação**: JWT + refresh token; sessão administrativa pode ter expiração mais curta e exigir reautenticação para ações críticas (ajuste de crédito, bloqueio, exportação).
* **RBAC em duas camadas**: (1) `users.role = admin` libera o módulo; (2) sub-papel administrativo (`admin_role` — proposta complementar) controla cada ação via matriz da seção 13. Endpoints validam ambos no backend.
* **Ownership / IDOR**: nenhuma operação confia em `target_id` vindo do cliente sem verificar permissão do sub-papel e existência do recurso. Identificadores são UUID (não sequenciais), reduzindo enumeração.
* **Mass Assignment**: schemas Pydantic de entrada restringem explicitamente os campos editáveis por ação; campos derivados (`rating`, `xp`, `level`, `reputation_score`, `verified`, `balance`) **não** são aceitos em payloads de update genéricos.
* **Rate limiting** dedicado por admin para ajuste de crédito, bloqueio em massa e exportação, via Redis.
* **Acesso a documentos KYC**: somente URLs assinadas com expiração curta; cada acesso gera `audit_logs`. Buckets S3 sem leitura pública.
* **Imutabilidade**: writes em `credit_transactions`/`payment_orders` são apenas insert; updates/deletes bloqueados em nível de aplicação e idealmente por constraint/trigger.
* **Logs de segurança**: tentativas de acesso negado (403), reautenticações falhas e ações sensíveis registradas.
* **Antifraude**: integração com o Anti-Fraud Engine para sinalizar contas suspeitas; o painel não implementa as heurísticas.
* **Segregação de funções** (RN-ADM-07): menor privilégio por sub-papel; ações de altíssimo impacto (gerir administradores, alterar pacotes, descongelar créditos) restritas a Super Admin.

---

# 7. Auditoria

A auditoria do painel apoia-se nas tabelas oficiais `audit_logs` e `admin_actions` (`04-banco-de-dados/database-schema.md`).

## 7.1 audit_logs (rastro técnico)
Campos: `id`, `user_id`, `action`, `entity`, `entity_id`, `ip_address`, `user_agent`, `created_at`.
Gerado para: navegação sensível, acesso a documentos KYC, leitura de dados pessoais, exportações, e toda mutação administrativa.

## 7.2 admin_actions (rastro de negócio)
Campos: `id`, `admin_id`, `action`, `target_entity`, `target_id`, `reason`, `created_at`.
Gerado para toda ação que altera estado. `reason` obrigatório em moderação, finanças e bloqueio.

## 7.3 Catálogo de ações (`admin_actions.action`)

| action | target_entity | reason obrigatório |
|--------|---------------|--------------------|
| `user_suspend` / `user_unsuspend` | `users` | Sim |
| `user_block` / `user_unblock` | `users` | Sim |
| `user_soft_delete` | `users` | Sim |
| `professional_edit` | `professional_profiles` | Sim |
| `professional_force_unavailable` | `professional_profiles` | Sim |
| `lead_cancel` / `lead_close` | `leads` | Sim |
| `credit_refund` | `credit_wallets` | Sim |
| `credit_adjust` | `credit_wallets` | Sim |
| `credit_freeze` / `credit_unfreeze` | `credit_wallets` | Sim |
| `package_create` / `package_update` / `package_toggle` | `credit_packages` | Não (recomendado) |
| `payment_refund` | `payment_orders` | Sim |
| `review_moderate` | `reviews` | Sim |
| `report_status_change` / `report_resolve` | `reports` | Sim |
| `kyc_approve` / `kyc_reject` | `verification_requests` | Aprovar: não; Rejeitar: sim |
| `fraud_action` | `users`/`credit_wallets` | Sim |
| `report_export` | (relatório) | Não |
| `admin_role_assign` / `admin_role_revoke` | `users` | Sim |

## 7.4 Tela de Auditoria
Consulta combinada de `audit_logs` + `admin_actions` com filtros por admin, ação, entidade, intervalo de datas e `target_id`. Apenas leitura. Registros de auditoria são **imutáveis** (insert-only) e nunca sofrem soft delete. Exportável (seção 15) por Super Admin.

---

# 8. Métricas

> O painel **exibe** métricas; o cálculo financeiro detalhado pertence a `05-payment-engine` e o de matching/reputação aos respectivos engines. Não há duplicação de fórmulas.

## 8.1 Dashboard executivo (KPIs)
* Leads criados / comprados / em aberto (período) — origem `leads`, `lead_purchases`.
* Taxa de conversão Lead → Compra e Contato → Contratação (Lead Engine KPIs: >60% e >25%).
* Receita diária / mensal, créditos vendidos, créditos consumidos (Payment Engine — Painel Financeiro Admin).
* Assinaturas premium ativas, perfis verificados (Payment Engine).
* Reembolsos e chargebacks (Payment Engine).
* Avaliação média da plataforma e NPS (Reputation Engine).
* Usuários ativos, retenção (>70% meta — Lead/Payment Engine).

## 8.2 Métricas operacionais do painel
* Fila de KYC pendente / tempo médio de análise.
* Denúncias abertas / em investigação / tempo médio de resolução.
* Avaliações em revisão / taxa de rejeição.
* Casos de antifraude abertos / resolvidos.
* Volume de ações administrativas por admin e por tipo (governança).

## 8.3 Métricas de negócio (referência cruzada)
* Ticket médio, LTV, MRR, ARR, CAC (Payment/Lead Engine).
* Receita por dia/cidade/categoria/profissional (Payment Engine — Relatórios).
* Top categorias, top cidades, profissionais mais ativos, conversão por categoria (Matching Engine — Dashboard Admin).

---

# 9. Roadmap

| Versão | Entregas do Painel Administrativo |
|--------|-----------------------------------|
| **V1 (MVP — Fase 10 do master-task)** | Dashboard executivo básico; gestão de usuários/profissionais/contratantes; gestão de leads; painel financeiro (visualização) e gestão de pacotes; ajuste manual de créditos e reembolso em créditos; moderação de avaliações e denúncias; KYC aprovar/rejeitar; auditoria (`audit_logs`/`admin_actions`); RBAC interno (Super Admin, Moderador, Financeiro, Suporte); relatórios CSV. |
| **V2** | Painel antifraude integrado ao `anti-fraud-engine.md` (casos/score em tempo real); exportações XLSX/PDF; dashboards de matching/reputação embutidos; alertas operacionais (filas estourando, picos de chargeback). |
| **V3** | Automações de moderação assistida (sugestão de decisão), insights por IA; gestão de assinaturas premium dedicada (tabela `subscriptions` — ver Conflitos); relatórios agendados por e-mail. |
| **V4** | Suporte a Lead Compartilhado/Leilão na operação admin (alinhado ao roadmap de Lead/Matching Engine); painel multirregião/multi-tenant avançado. |

O roadmap respeita as fases de `01-projeto/master-task.md` (Administração = Fase 10) e os roadmaps dos engines (matching/reputação/pagamento V2–V4).

---

# 10. Conflitos e Observações

Itens onde a fonte da verdade é ambígua, incompleta ou conflitante. **Nenhuma alteração de schema/arquitetura foi feita**; abaixo registram-se apontamentos e sugestões. As tabelas/campos novos propostos estão consolidados na subseção "Modelo de Dados (proposta complementar)".

1. **Ausência de sub-papéis de admin.** `users.role` tem apenas `customer`, `professional`, `admin`, e o Sistema de Permissões de `03-arquitetura/marketplace-architecture.md` define "Admin → pode tudo". O conteúdo obrigatório deste documento exige Super Admin/Moderador/Financeiro/Suporte. **Sugestão:** adicionar `admin_role` (ver proposta complementar) sem alterar o enum `role` — `role=admin` continua sendo o gate, e `admin_role` refina permissões. Conflito de granularidade, não de modelo.

2. **Reembolso: créditos vs. dinheiro.** O Payment Engine determina "Devolver créditos, nunca dinheiro", mas `payment_orders.status` inclui `refunded`. **Observação:** `refunded` deve ser reservado a chargeback/obrigação legal; o fluxo operacional padrão é `credit_transactions.transaction_type=refund`. Documentado em RN-FIN-02/RN-CRD-02; sem conflito de schema.

3. **Falta tabela de assinaturas (Premium recorrente).** Payment Engine descreve Assinatura Premium (mensal/trimestral/anual) e `professional_profiles.premium` é booleano, mas não há tabela `subscriptions` no schema. Hoje o admin só consegue ler "premium sim/não" sem ciclo/vencimento. **Sugestão:** propor tabela `subscriptions` (proposta complementar) para gestão financeira completa. Enquanto não existir, a gestão de premium no painel fica limitada à correção pontual do booleano (RN-PRO-01).

4. **Saldo bloqueado (chargeback) não modelado.** Payment Engine manda "bloquear créditos adquiridos" em chargeback, e a Carteira menciona "saldo bônus/total/consumido", mas `credit_wallets` no schema só tem `balance`. **Sugestão:** campo `frozen_balance` (proposta complementar) e `transaction_type` adicionais. Conflito: a carteira descrita no Payment Engine é mais rica que a do schema.

5. **`transaction_type` insuficiente para ajuste administrativo.** O schema lista `purchase`, `bonus`, `refund`, `spend`, mas o Payment Engine exige registrar "ajuste administrativo". **Sugestão:** adicionar `adjustment` (e `freeze`/`unfreeze`) ao enum. Sem isso, débitos corretivos não têm tipo próprio.

6. **Raio de atuação do profissional não está no schema.** Matching/Lead engines usam "raio de atuação (15/30/50 km)", porém `professional_profiles` só tem `city`/`state`. Não afeta diretamente o admin (que não edita matching), mas a "Gestão de profissionais" não consegue exibir/editar a área de atendimento. **Observação:** apontar para correção no schema/engine; não proposto aqui por estar fora do escopo do painel.

7. **`reports` sem campo de resolução/responsável.** A tabela `reports` tem `status` mas não `assigned_admin_id`, `resolution` nem `resolved_at`. A trilha fica apenas em `admin_actions`. **Sugestão (opcional):** enriquecer `reports` para SLA de moderação; registrado como proposta complementar opcional.

8. **`verification_requests` sem motivo de rejeição persistido.** Há `status` e `reviewer_id`, mas não há campo para o motivo retornado ao usuário na rejeição (RN-KYC-04). Hoje o motivo só vive em `admin_actions.reason`. **Sugestão (opcional):** campo `review_notes` em `verification_requests`.

9. **Divergência menor de níveis entre documentos.** `lead-engine.md` e `marketplace-architecture.md` listam 6 níveis (até Elite); `gamification-engine.md` lista 8 (até Lenda). Não impacta o painel (o admin não concede níveis), mas registra-se a inconsistência para alinhamento futuro pela equipe de gamificação.

---

## Modelo de Dados (proposta complementar)

> **Extensões ao schema oficial.** Nada aqui substitui `04-banco-de-dados/database-schema.md`. São propostas para viabilizar o painel; requerem aprovação e migration Alembic. Todas mantêm UUID como PK, `created_at`/`updated_at`, soft delete onde aplicável e imutabilidade financeira.

### admin_roles (novo) — RBAC interno
Define o sub-papel administrativo, complementando (não substituindo) `users.role=admin`.

| Campo | Descrição |
|-------|-----------|
| `id` (UUID) | PK |
| `user_id` (FK → users.id) | admin a quem o papel se aplica |
| `admin_role` (enum) | `super_admin`, `moderator`, `finance`, `support` |
| `granted_by` (FK → users.id) | quem concedeu (auditável) |
| `created_at`, `updated_at`, `deleted_at` | |

Alternativa de menor footprint: um único campo `admin_role` (enum) em `users`, populado só quando `role=admin`. A tabela dedicada é preferível por permitir histórico/revogação auditável.

### subscriptions (novo) — assinatura premium recorrente
Suporta a gestão financeira de Premium (atualmente só refletida no booleano `professional_profiles.premium`).

| Campo | Descrição |
|-------|-----------|
| `id` (UUID) | PK |
| `user_id` (FK → users.id) | profissional assinante |
| `plan` (enum) | `monthly`, `quarterly`, `annual` (valores do Payment Engine) |
| `status` (enum) | `active`, `past_due`, `cancelled`, `expired` |
| `gateway` | gateway de cobrança |
| `external_reference` | id da assinatura no gateway (idempotência) |
| `current_period_end` | vencimento do ciclo |
| `created_at`, `updated_at` | |

### Extensão de credit_wallets
Adicionar `frozen_balance` (saldo bloqueado por chargeback/investigação) — RN-CRD-04 e Caso "Chargeback". `balance` permanece como saldo disponível.

### Extensão do enum credit_transactions.transaction_type
Adicionar: `adjustment` (ajuste administrativo de débito/crédito corretivo), `freeze` e `unfreeze` (bloqueio/desbloqueio de créditos). Mantém os existentes (`purchase`, `bonus`, `refund`, `spend`).

### Extensão (opcional) de reports
`assigned_admin_id` (FK → users.id), `resolution` (texto), `resolved_at` — para SLA e responsabilização de moderação (Observação 7).

### Extensão (opcional) de verification_requests
`review_notes` (texto) — motivo de rejeição persistido e retornável ao usuário (Observação 8).

### Permissões administrativas (matriz RBAC)

Papéis propostos: **Super Admin** (governança total), **Moderador** (conteúdo, contas, KYC), **Financeiro** (créditos, pacotes, reembolsos, relatórios financeiros), **Suporte** (leitura ampla + análise de KYC, sem decisões de alto impacto).

| Ação / Recurso | Super Admin | Moderador | Financeiro | Suporte |
|----------------|:-----------:|:---------:|:----------:|:-------:|
| Dashboard executivo (ver) | ✔ | ✔ | ✔ | ✔ |
| Listar usuários / profissionais / contratantes | ✔ | ✔ | ✔ | ✔ |
| Suspender usuário | ✔ | ✔ | – | – |
| Bloquear / desbloquear usuário | ✔ | – | – | – |
| Editar dados cadastrais do profissional | ✔ | ✔ | – | – |
| Soft delete de usuário | ✔ | – | – | – |
| Gerir leads (cancelar/encerrar) | ✔ | ✔ | – | – |
| Ver financeiro / pedidos | ✔ | – | ✔ | ✔ (leitura) |
| Gerir pacotes de créditos | ✔ | – | ✔ | – |
| Reembolso em créditos | ✔ | ✔ (ligado à moderação) | ✔ | – |
| Ajuste manual de créditos | ✔ | – | ✔ | – |
| Congelar / descongelar créditos | ✔ | – | ✔ | – |
| Moderar avaliações | ✔ | ✔ | – | – |
| Moderar denúncias | ✔ | ✔ | – | – |
| Analisar KYC (ver documentos) | ✔ | ✔ | – | ✔ |
| Decidir KYC (aprovar/rejeitar) | ✔ | ✔ | – | – |
| Antifraude — ações | ✔ | ✔ (limitado) | ✔ (créditos) | – |
| Auditoria — consultar | ✔ | ✔ | ✔ | ✔ |
| Métricas | ✔ | ✔ | ✔ | ✔ |
| Relatórios — exportar | ✔ | – | ✔ | – |
| Gerir administradores / papéis | ✔ | – | – | – |

Legenda: ✔ permitido · – negado. Toda célula ✔ que altera estado gera `admin_actions` + `audit_logs`. O backend valida o `admin_role` em cada endpoint (RBAC, RN-ADM-05); o frontend oculta itens sem permissão, mas a autorização é sempre confirmada no servidor.
