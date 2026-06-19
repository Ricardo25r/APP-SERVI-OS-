# database-schema.md

# Database Schema

Projeto: FazTudo

Versão: 1.0

Status: Fonte Oficial de Modelagem

---

# Objetivo

Definir a estrutura oficial do banco de dados.

Todas as migrations devem seguir este documento.

Nenhuma tabela deve ser criada fora desta especificação sem aprovação.

---

# Convenções

## Chaves Primárias

Todos os registros utilizam:

id UUID

---

## Datas

Todos os registros possuem:

created_at

updated_at

---

## Soft Delete

Entidades críticas possuem:

deleted_at

---

# USERS

Responsável pela autenticação.

Campos:

* id
* name
* email
* phone
* password_hash
* role
* status
* last_login_at
* created_at
* updated_at

Constraints:

* email UNIQUE
* phone UNIQUE

Roles:

* customer
* professional
* admin

Status:

* active
* suspended
* blocked

---

# CUSTOMER_PROFILES

Campos:

* id
* user_id
* city
* state
* reputation_score
* created_at
* updated_at

Relacionamentos:

user_id → users.id

---

# PROFESSIONAL_PROFILES

Campos:

* id
* user_id
* headline
* bio
* city
* state
* verified
* premium
* rating
* total_reviews
* xp
* level
* availability_status
* created_at
* updated_at

Relacionamentos:

user_id → users.id

Availability:

* available
* busy
* unavailable

---

# PROFESSIONAL_CATEGORIES

Tabela N:N

Campos:

* id
* professional_id
* category_id

---

# CATEGORIES

Campos:

* id
* name
* slug
* active

---

# LEADS

Campos:

* id
* customer_id
* category_id
* title
* description
* lead_type
* urgency
* city
* state
* neighborhood
* status
* credits_cost
* expires_at
* created_at
* updated_at

Lead Types:

* one_time
* temporary
* permanent

Urgency:

* immediate
* today
* this_week
* flexible

Status:

* open
* purchased
* closed
* cancelled

Índices:

* category_id
* city
* state
* status

---

# LEAD_PURCHASES

Campos:

* id
* lead_id
* professional_id
* credits_used
* purchased_at

Constraints:

lead_id UNIQUE

(MVP = Lead Exclusivo)

---

# CREDIT_WALLETS

Campos:

* id
* professional_id
* balance
* created_at
* updated_at

---

# CREDIT_TRANSACTIONS

Campos:

* id
* wallet_id
* transaction_type
* amount
* balance_before
* balance_after
* description
* created_at

Tipos:

* purchase
* bonus
* refund
* spend

---

# CREDIT_PACKAGES

Campos:

* id
* name
* credits
* price
* active

---

# PAYMENT_ORDERS

Campos:

* id
* user_id
* package_id
* gateway
* amount
* status
* external_reference
* paid_at
* created_at

Status:

* pending
* paid
* failed
* refunded

---

# CONVERSATIONS

Campos:

* id
* lead_id
* customer_id
* professional_id
* status
* created_at

Status:

* active
* archived

---

# MESSAGES

Campos:

* id
* conversation_id
* sender_id
* message
* created_at

Índices:

* conversation_id
* sender_id

---

# REVIEWS

Campos:

* id
* author_id
* target_id
* lead_id
* score
* comment
* created_at

Constraints:

Uma avaliação por contratação.

---

# ACHIEVEMENTS

Campos:

* id
* slug
* name
* description
* xp_reward

---

# USER_ACHIEVEMENTS

Campos:

* id
* user_id
* achievement_id
* earned_at

---

# XP_TRANSACTIONS

Campos:

* id
* user_id
* amount
* source
* description
* created_at

---

# VERIFICATION_REQUESTS

Campos:

* id
* user_id
* document_front_url
* document_back_url
* selfie_url
* status
* reviewer_id
* reviewed_at
* created_at

Status:

* pending
* approved
* rejected

---

# REPORTS

Denúncias.

Campos:

* id
* reporter_id
* target_user_id
* reason
* description
* status
* created_at

Status:

* open
* investigating
* resolved

---

# NOTIFICATIONS

Campos:

* id
* user_id
* type
* title
* message
* read_at
* created_at

---

# AUDIT_LOGS

Campos:

* id
* user_id
* action
* entity
* entity_id
* ip_address
* user_agent
* created_at

---

# ADMIN_ACTIONS

Campos:

* id
* admin_id
* action
* target_entity
* target_id
* reason
* created_at

---

# SISTEMA DE ÍNDICES

Criar índices para:

* email
* phone
* city
* state
* category_id
* lead status
* rating
* xp
* created_at

---

# REGRAS DE INTEGRIDADE

Nunca remover registros críticos fisicamente.

Utilizar Soft Delete.

---

Transações financeiras nunca podem ser apagadas.

---

Avaliações nunca podem ser alteradas diretamente.

---

Toda movimentação de crédito deve gerar histórico.

---

Toda ação administrativa deve gerar auditoria.

---

# DEFINIÇÃO DE SUCESSO

O banco deve suportar:

* milhões de usuários
* milhões de leads
* auditoria completa
* rastreabilidade financeira
* reputação permanente
* futura expansão para aplicativo móvel
