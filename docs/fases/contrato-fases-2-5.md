# Contrato Técnico — Fases 2 a 5 (Auth, Perfis, Leads, Créditos + Matching + Compra)

> **Status:** CONTRATO OFICIAL E FONTE DA VERDADE para as Fases 2–5 do FazTudo.
> **Público-alvo:** ~10 agentes implementando em paralelo. Este documento existe para que cada agente seja **dono exclusivo** dos seus arquivos e siga **exatamente** os mesmos nomes, tipos, contratos de API e regras de negócio — sem colisões e sem divergências.
> **Precedência:** este contrato detalha e aplica o schema canônico `docs/04-banco-de-dados/database-schema.md` e as convenções da `docs/fases/fase-01-infraestrutura/foundation-conventions.md`. Em caso de dúvida sobre **nomes/tipos de tabela**, o canônico é o doc 04 + as decisões abaixo. Em caso de dúvida sobre **estrutura de pastas/stack**, a base é a Fase 1.
> **Regra de ouro:** não renomear, não re-discutir decisões já tomadas, não criar tabelas/campos/endpoints fora deste escopo. Se algo faltar, registrar e pedir OK — **não improvisar**.

---

## Índice

1. [Decisões de schema aplicadas](#1-decisões-de-schema-aplicadas)
2. [Modelo de dados](#2-modelo-de-dados)
3. [Convenções de módulos do backend](#3-convenções-de-módulos-do-backend)
4. [Endpoints por fase](#4-endpoints-por-fase)
5. [Regras de negócio chave (MVP)](#5-regras-de-negócio-chave-mvp)
6. [Convenções do frontend](#6-convenções-do-frontend)
7. [Simplificações assumidas no MVP](#7-simplificações-assumidas-no-mvp)

---

## 1. Decisões de schema aplicadas

Resolução da **seção 2 do `00-CHECKLIST-EXECUCAO.md`**, restrita ao que afeta as Fases 2–5. Cada item abaixo é uma decisão **fechada** — aplicar, não re-discutir.

### 1.1 Padronização de nomes (resolve seção 2.1)
- **Schema canônico = `04-database-schema.md`**, nomes de tabelas/colunas/enums em **inglês**, `snake_case`.
- `credit_transactions.transaction_type` (não `type`), enum **inglês**: `purchase | bonus | refund | spend | adjustment`.
  - `adjustment` adicionado ao enum do doc 04 (decisão da seção 2.3); `freeze`/`unfreeze` **NÃO** entram agora (são da Fase 6/antifraude).
- `customer_profiles.reputation_score` (não `rating`).
- Enums de lead em **inglês**:
  - `lead_type = one_time | temporary | permanent`
  - `urgency = immediate | today | this_week | flexible`
  - `status = open | purchased | closed | cancelled`
- `messages.message`, `verification_requests.*` → fora do escopo destas fases (não modelar agora).

### 1.2 RBAC base (resolve parte de 2.3 — permissões administrativas)
- `users.role` é um enum com **exatamente**: `customer | professional | admin`.
- **Sub-papéis de admin** (`super_admin`, `moderator`, `finance`, `support`) ficam para a **Fase 10 — NÃO criar agora**. Onde o contrato exige permissão administrativa (CRUD de categorias, conceder créditos), usar `role == admin`.

### 1.3 Tabela nova: `refresh_tokens` (resolve 2.3 — segurança)
- Criada nesta fase para **rotação e revogação** de refresh JWT (detecção de reuso via hash + `revoked_at`).
- Persistência em **tabela Postgres** (não Redis) no MVP.

### 1.4 `professional_profiles` — área de atuação (resolve 2.3 — distribuição/geo)
- Incluir `service_radius_km` (`int`, default `10`).
- **Geolocalização `latitude`/`longitude` fica para V2 — NÃO incluir agora.** O matching MVP usa apenas `city`/`state` (igualdade exata).
- Campos de gamificação/reputação do doc 04 (`xp`, `level`, `rating`, `total_reviews`, `verified`, `premium`) **são criados na tabela** (fazem parte do schema canônico), mas **não são manipulados** pelas Fases 2–5 além dos defaults. Ver §2.4.

### 1.5 Reembolso (resolve 2.2)
- Reembolso é **sempre em créditos** (`credit_transactions.transaction_type = refund`), **nunca em dinheiro**. `payment_orders` é Fase 6 e não é tocado aqui.

### 1.6 Lead Exclusivo MVP (já decidido)
- `lead_purchases.lead_id` é **UNIQUE** — o primeiro profissional que comprar leva o lead. Ao comprar, o lead vira `purchased` e o contato é liberado.

### 1.7 Convenções gerais (aplicam a todas as tabelas deste contrato)
- **PK = `id` UUID** (default gerado pela aplicação/DB — ver §3.7).
- `created_at` e `updated_at` (`timestamptz`) em **todas** as tabelas, exceto tabelas estritamente append-only que só têm `created_at` (ver cada tabela).
- **Soft delete (`deleted_at timestamptz NULL`)** nas entidades críticas: `users`, `customer_profiles`, `professional_profiles`, `leads`. Demais tabelas: hard delete não permitido em financeiras (`credit_transactions`, `lead_purchases` são append-only).
- Toda movimentação de crédito **gera registro** em `credit_transactions` (nunca alterar `balance` sem transação). Transações financeiras **nunca** são apagadas/editadas.

### 1.8 Itens da seção 2 explicitamente FORA do escopo destas fases
Gamificação (8 níveis, XP, medalhas), push notifications, teto de notificações, `subscriptions`, `frozen_balance`, `webhook_events`, `tenant_id`, índices full-text/`pg_trgm`, `notification_*`, chat, indicação, KYC, suporte, antifraude (`fraud_score`, device signals), marcador de contratação. Nenhum desses é modelado, migrado ou exposto agora.

---

## 2. Modelo de dados

> **Stack:** SQLAlchemy 2 (async, `DeclarativeBase` em `app/database/base.py`), Postgres 16, Alembic.
> **Tipos:** UUID → `sqlalchemy.dialects.postgresql.UUID(as_uuid=True)`; datas → `DateTime(timezone=True)` (Postgres `timestamptz`); enums → `sqlalchemy.Enum(PyEnum, name="<enum_name>")` (cria tipo `ENUM` nativo no Postgres — ver §3.8 para o padrão obrigatório).
> **Mixins recomendados (definidos pelo backbone, ver §3.7):** `TimestampMixin` (`created_at`, `updated_at`), `SoftDeleteMixin` (`deleted_at`), `UUIDPKMixin` (`id`).

### Visão geral das tabelas (11)

| Fase | Tabela | Dono (feature) |
|------|--------|----------------|
| 2 | `users` | auth |
| 2 | `refresh_tokens` | auth |
| 3 | `customer_profiles` | users |
| 3 | `professional_profiles` | users |
| 3 | `categories` | categories |
| 3 | `professional_categories` | users *(N:N com categories)* |
| 4 | `leads` | leads |
| 5 | `credit_wallets` | credits |
| 5 | `credit_transactions` | credits |
| 5 | `lead_purchases` | lead_purchases |

> Observação: `professional_categories` é da feature **users** (perfis), pois é populada ao gerenciar as categorias do profissional. `categories` (catálogo) é da feature **categories**.

---

### 2.1 `users` (Fase 2 — feature `auth`)

Autenticação e identidade. Entidade crítica (soft delete).

| Coluna | Tipo Postgres / SQLAlchemy | Constraints / Default |
|--------|----------------------------|------------------------|
| `id` | `UUID` / `UUID(as_uuid=True)` | PK, default `uuid4` |
| `name` | `varchar(120)` / `String(120)` | NOT NULL |
| `email` | `varchar(255)` / `String(255)` | NOT NULL, **UNIQUE**, indexado, armazenar lowercase |
| `phone` | `varchar(20)` / `String(20)` | **UNIQUE**, indexado, NULLABLE (ver nota) |
| `password_hash` | `varchar(255)` / `String(255)` | NOT NULL |
| `role` | `ENUM user_role` / `Enum(UserRole, name="user_role")` | NOT NULL, default `customer` |
| `status` | `ENUM user_status` / `Enum(UserStatus, name="user_status")` | NOT NULL, default `active` |
| `last_login_at` | `timestamptz` / `DateTime(timezone=True)` | NULLABLE |
| `created_at` | `timestamptz` | NOT NULL, default now |
| `updated_at` | `timestamptz` | NOT NULL, default now, onupdate now |
| `deleted_at` | `timestamptz` | NULLABLE (soft delete) |

**Enums:**
- `user_role`: `customer | professional | admin`
- `user_status`: `active | suspended | blocked`

**Índices:** `email` (unique), `phone` (unique), `role`, `status`.
**UNIQUE parcial recomendado:** a unicidade de `email`/`phone` deve considerar soft delete — usar índice único parcial `WHERE deleted_at IS NULL` (assim um email pode ser reutilizado após exclusão lógica). Implementar via `Index(..., unique=True, postgresql_where=text("deleted_at IS NULL"))`.

**Relacionamentos:**
- `customer_profile` → 1:1 `customer_profiles` (back_populates).
- `professional_profile` → 1:1 `professional_profiles` (back_populates).
- `refresh_tokens` → 1:N `refresh_tokens`.
- `leads` → 1:N `leads` (como customer; via `leads.customer_id`).

**Nota sobre `phone`:** o doc 04 marca `phone UNIQUE`. Tornar `phone` **obrigatório no register** (validação no schema) mas NULLABLE na coluna para não quebrar usuários admin seed; unicidade aplicada quando presente (índice único parcial `WHERE phone IS NOT NULL AND deleted_at IS NULL`).

---

### 2.2 `refresh_tokens` (Fase 2 — feature `auth`)

Rotação/revogação de refresh JWT. **Não** soft delete (usa `revoked_at`). Append-mostly.

| Coluna | Tipo | Constraints / Default |
|--------|------|------------------------|
| `id` | `UUID` | PK, default `uuid4` |
| `user_id` | `UUID` | NOT NULL, **FK → `users.id`** (ON DELETE CASCADE), indexado |
| `token_hash` | `varchar(255)` / `String(255)` | NOT NULL, **UNIQUE**, indexado (SHA-256 hex do refresh token; **nunca** armazenar o token cru) |
| `expires_at` | `timestamptz` | NOT NULL |
| `revoked_at` | `timestamptz` | NULLABLE (preenchido em logout/rotação) |
| `created_at` | `timestamptz` | NOT NULL, default now |

> **Sem `updated_at`** (registro imutável exceto pela revogação).

**Índices:** `user_id`, `token_hash` (unique), índice composto `(user_id, revoked_at)` para listar tokens ativos.

**Relacionamentos:** `user` → N:1 `users`.

**Regra de rotação:** a cada `/auth/refresh`, o token usado é validado (existe, não revogado, não expirado), **revogado** (`revoked_at = now`) e um novo par access+refresh é emitido (novo registro). Detecção de reuso: se um token já revogado for apresentado, **revogar todos** os refresh tokens ativos do usuário (defesa básica). Logout revoga o refresh token apresentado.

---

### 2.3 `customer_profiles` (Fase 3 — feature `users`)

Perfil do contratante. 1:1 com `users`. Entidade crítica (soft delete).

| Coluna | Tipo | Constraints / Default |
|--------|------|------------------------|
| `id` | `UUID` | PK, default `uuid4` |
| `user_id` | `UUID` | NOT NULL, **FK → `users.id`** (ON DELETE CASCADE), **UNIQUE** (1:1) |
| `city` | `varchar(120)` / `String(120)` | NULLABLE, indexado |
| `state` | `varchar(2)` / `String(2)` | NULLABLE, indexado (UF, 2 letras maiúsculas) |
| `reputation_score` | `numeric(3,2)` / `Numeric(3,2)` | NOT NULL, default `0.00` (faixa 0.00–5.00; manipulado em fases futuras) |
| `created_at` | `timestamptz` | NOT NULL, default now |
| `updated_at` | `timestamptz` | NOT NULL, default now, onupdate now |
| `deleted_at` | `timestamptz` | NULLABLE |

**Índices:** `user_id` (unique), `city`, `state`.
**Relacionamentos:** `user` → 1:1 `users` (back_populates `customer_profile`).

---

### 2.4 `professional_profiles` (Fase 3 — feature `users`)

Perfil do profissional. 1:1 com `users`. Entidade crítica (soft delete).

| Coluna | Tipo | Constraints / Default |
|--------|------|------------------------|
| `id` | `UUID` | PK, default `uuid4` |
| `user_id` | `UUID` | NOT NULL, **FK → `users.id`** (ON DELETE CASCADE), **UNIQUE** (1:1) |
| `headline` | `varchar(160)` / `String(160)` | NULLABLE |
| `bio` | `text` / `Text` | NULLABLE |
| `city` | `varchar(120)` / `String(120)` | NULLABLE, indexado |
| `state` | `varchar(2)` / `String(2)` | NULLABLE, indexado |
| `service_radius_km` | `integer` / `Integer` | NOT NULL, default `10` (raio de atuação; geo lat/long é V2) |
| `verified` | `boolean` / `Boolean` | NOT NULL, default `false` (gerenciado na Fase 15/KYC) |
| `premium` | `boolean` / `Boolean` | NOT NULL, default `false` (gerenciado na Fase 6) |
| `rating` | `numeric(3,2)` / `Numeric(3,2)` | NOT NULL, default `0.00` (reputação do profissional; Fase 7) |
| `total_reviews` | `integer` / `Integer` | NOT NULL, default `0` (Fase 7) |
| `xp` | `integer` / `Integer` | NOT NULL, default `0` (Fase 9) |
| `level` | `integer` / `Integer` | NOT NULL, default `1` (Fase 9) |
| `availability_status` | `ENUM availability_status` / `Enum(AvailabilityStatus, name="availability_status")` | NOT NULL, default `available` |
| `created_at` | `timestamptz` | NOT NULL, default now |
| `updated_at` | `timestamptz` | NOT NULL, default now, onupdate now |
| `deleted_at` | `timestamptz` | NULLABLE |

**Enum `availability_status`:** `available | busy | unavailable`.

> **Importante para os agentes das Fases 2–5:** as colunas `verified`, `premium`, `rating`, `total_reviews`, `xp`, `level` existem no schema canônico e **devem ser criadas** (migration única), porém **não há endpoint nem regra** nestas fases para alterá-las (apenas defaults). O matching MVP **não** as utiliza além de, opcionalmente, `availability_status` (ver §5.3).

**Índices:** `user_id` (unique), `city`, `state`, `availability_status`.
**Relacionamentos:**
- `user` → 1:1 `users` (back_populates `professional_profile`).
- `categories` → N:N via `professional_categories`.
- `wallet` → 1:1 `credit_wallets` (via `credit_wallets.professional_id`).

---

### 2.5 `categories` (Fase 3 — feature `categories`)

Catálogo de categorias de serviço. **Sem soft delete** (usa `active` para desativar).

| Coluna | Tipo | Constraints / Default |
|--------|------|------------------------|
| `id` | `UUID` | PK, default `uuid4` |
| `name` | `varchar(80)` / `String(80)` | NOT NULL |
| `slug` | `varchar(80)` / `String(80)` | NOT NULL, **UNIQUE**, indexado |
| `tier` | `ENUM category_tier` / `Enum(CategoryTier, name="category_tier")` | NOT NULL, default `medium` (define custo do lead — ver §5.1) |
| `active` | `boolean` / `Boolean` | NOT NULL, default `true`, indexado |
| `created_at` | `timestamptz` | NOT NULL, default now |
| `updated_at` | `timestamptz` | NOT NULL, default now, onupdate now |

**Enum `category_tier`:** `simple | medium | premium` → mapeia para custo `1 | 3 | 5` créditos.

> **Decisão tomada (além das passadas):** adicionei a coluna `tier` em `categories` (não existe no doc 04). É a forma **mais simples e configurável** de mapear categoria → custo do lead, conforme exigido na §5.1. Sem ela, o custo teria de ser hardcoded. `tier` é o default; o `lead_type` pode promover o custo (ver §5.1). Registrar como extensão aprovada do schema.

**Índices:** `slug` (unique), `active`.
**Relacionamentos:** `professionals` → N:N via `professional_categories`; `leads` → 1:N `leads`.
**Seed:** o agente de `categories` entrega seed inicial (migration de dados ou script) com ao menos: eletricista (medium), encanador (medium), pintor (medium), diarista (simple), jardinagem (simple), montagem (simple), reforma (premium), construção (premium), babá (premium/temporary), cuidador (premium), doméstica (premium). `slug` em kebab-case sem acento.

---

### 2.6 `professional_categories` (Fase 3 — feature `users`)

N:N entre profissionais e categorias. Tabela de junção. Append/delete simples (sem soft delete).

| Coluna | Tipo | Constraints / Default |
|--------|------|------------------------|
| `id` | `UUID` | PK, default `uuid4` |
| `professional_id` | `UUID` | NOT NULL, **FK → `professional_profiles.id`** (ON DELETE CASCADE), indexado |
| `category_id` | `UUID` | NOT NULL, **FK → `categories.id`** (ON DELETE CASCADE), indexado |
| `created_at` | `timestamptz` | NOT NULL, default now |

> **Sem `updated_at`/`deleted_at`** (vínculo é criado ou removido fisicamente).

**Constraints:** **UNIQUE (`professional_id`, `category_id`)** — sem duplicar vínculo.
**Índices:** os dois FKs + o unique composto.
**Relacionamentos:** N:1 para `professional_profiles` e `categories`.

---

### 2.7 `leads` (Fase 4 — feature `leads`)

Oportunidade publicada pelo contratante. Entidade crítica (soft delete).

| Coluna | Tipo | Constraints / Default |
|--------|------|------------------------|
| `id` | `UUID` | PK, default `uuid4` |
| `customer_id` | `UUID` | NOT NULL, **FK → `users.id`** (ON DELETE RESTRICT), indexado *(o autor é o usuário customer; ver nota)* |
| `category_id` | `UUID` | NOT NULL, **FK → `categories.id`** (ON DELETE RESTRICT), indexado |
| `title` | `varchar(140)` / `String(140)` | NOT NULL |
| `description` | `text` / `Text` | NOT NULL |
| `lead_type` | `ENUM lead_type` / `Enum(LeadType, name="lead_type")` | NOT NULL |
| `urgency` | `ENUM lead_urgency` / `Enum(LeadUrgency, name="lead_urgency")` | NOT NULL |
| `city` | `varchar(120)` / `String(120)` | NOT NULL, indexado |
| `state` | `varchar(2)` / `String(2)` | NOT NULL, indexado |
| `neighborhood` | `varchar(120)` / `String(120)` | NULLABLE |
| `status` | `ENUM lead_status` / `Enum(LeadStatus, name="lead_status")` | NOT NULL, default `open`, indexado |
| `credits_cost` | `integer` / `Integer` | NOT NULL (calculado na criação — §5.1; imutável após criação) |
| `expires_at` | `timestamptz` | NULLABLE (default = `created_at + 30 dias`, calculado no service) |
| `created_at` | `timestamptz` | NOT NULL, default now |
| `updated_at` | `timestamptz` | NOT NULL, default now, onupdate now |
| `deleted_at` | `timestamptz` | NULLABLE |

**Enums:**
- `lead_type`: `one_time | temporary | permanent`
- `lead_urgency`: `immediate | today | this_week | flexible`
- `lead_status`: `open | purchased | closed | cancelled`

> **Nota `customer_id`:** referencia `users.id` (o autor autenticado, `role == customer`), conforme o doc 04 lista `customer_id` em `leads` sem especificar perfil; isso evita exigir que o customer tenha `customer_profiles` criado para publicar. O service valida que `users.role == customer`.

**Índices:** `category_id`, `city`, `state`, `status`, `customer_id`, e composto **`(status, category_id, city, state)`** para o matching/listagem de elegíveis (ver §5.3).
**Relacionamentos:**
- `customer` → N:1 `users`.
- `category` → N:1 `categories`.
- `purchase` → 1:1 `lead_purchases` (via `lead_purchases.lead_id` UNIQUE).

---

### 2.8 `credit_wallets` (Fase 5 — feature `credits`)

Carteira de créditos do profissional. 1:1 com `professional_profiles`.

| Coluna | Tipo | Constraints / Default |
|--------|------|------------------------|
| `id` | `UUID` | PK, default `uuid4` |
| `professional_id` | `UUID` | NOT NULL, **FK → `professional_profiles.id`** (ON DELETE CASCADE), **UNIQUE** (1:1) |
| `balance` | `integer` / `Integer` | NOT NULL, default `0`, **CHECK `balance >= 0`** |
| `created_at` | `timestamptz` | NOT NULL, default now |
| `updated_at` | `timestamptz` | NOT NULL, default now, onupdate now |

> **Sem soft delete.** Saldo nunca negativo (CHECK + validação no service).

**Índices:** `professional_id` (unique).
**Relacionamentos:** `professional` → 1:1 `professional_profiles`; `transactions` → 1:N `credit_transactions`.
**Criação:** a wallet é criada **automaticamente** quando o perfil profissional é criado (Fase 3 — o service de `professional_profiles` chama o repositório de wallet) **ou** lazily no primeiro acesso a `/credits/balance`. **Decisão:** criar junto com o perfil profissional (transação única na Fase 3) — assim o profissional sempre tem wallet. O agente de `users` (perfis) chama `credit_wallet_repository.create_for_professional(...)`.

---

### 2.9 `credit_transactions` (Fase 5 — feature `credits`)

Histórico imutável (append-only) de toda movimentação de crédito.

| Coluna | Tipo | Constraints / Default |
|--------|------|------------------------|
| `id` | `UUID` | PK, default `uuid4` |
| `wallet_id` | `UUID` | NOT NULL, **FK → `credit_wallets.id`** (ON DELETE RESTRICT), indexado |
| `transaction_type` | `ENUM credit_transaction_type` / `Enum(CreditTransactionType, name="credit_transaction_type")` | NOT NULL |
| `amount` | `integer` / `Integer` | NOT NULL (positivo p/ entradas, negativo p/ saídas — ver convenção) |
| `balance_before` | `integer` / `Integer` | NOT NULL |
| `balance_after` | `integer` / `Integer` | NOT NULL |
| `description` | `varchar(255)` / `String(255)` | NULLABLE |
| `reference_id` | `UUID` | NULLABLE (ex.: `lead_purchases.id` no `spend`/`refund`; sem FK rígida para manter genérico) |
| `created_at` | `timestamptz` | NOT NULL, default now |

> **Sem `updated_at`/`deleted_at`** — registro **imutável**, nunca editado nem apagado.

**Enum `credit_transaction_type`:** `purchase | bonus | refund | spend | adjustment`.

**Convenção de sinal de `amount`:**
- `purchase`, `bonus`, `refund`, `adjustment` (entrada): `amount > 0`.
- `spend` (saída): `amount < 0`.
- `adjustment` pode ser negativo (correção para baixo). Sempre `balance_after = balance_before + amount`.

> **Decisão tomada (além das passadas):** adicionei `reference_id` (nullable, sem FK) para rastrear a origem da transação (qual compra gerou o `spend`/`refund`). É opcional e não conflita com o doc 04. Registrar como extensão.

**Índices:** `wallet_id`, `(wallet_id, created_at)` (paginação do histórico), `transaction_type`.
**Relacionamentos:** `wallet` → N:1 `credit_wallets`.

---

### 2.10 `lead_purchases` (Fase 5 — feature `lead_purchases`)

Compra de lead (Lead Exclusivo). Append-only. **`lead_id` UNIQUE** (primeiro que compra leva).

| Coluna | Tipo | Constraints / Default |
|--------|------|------------------------|
| `id` | `UUID` | PK, default `uuid4` |
| `lead_id` | `UUID` | NOT NULL, **FK → `leads.id`** (ON DELETE RESTRICT), **UNIQUE** (Lead Exclusivo) |
| `professional_id` | `UUID` | NOT NULL, **FK → `professional_profiles.id`** (ON DELETE RESTRICT), indexado |
| `credits_used` | `integer` / `Integer` | NOT NULL (= `leads.credits_cost` no momento da compra) |
| `purchased_at` | `timestamptz` | NOT NULL, default now |
| `created_at` | `timestamptz` | NOT NULL, default now |

> **`purchased_at`** é o timestamp canônico do doc 04; `created_at` mantido por convenção geral (mesmo valor). Sem `updated_at`/`deleted_at` (imutável).

**Constraints:** `lead_id` UNIQUE; índice composto `(professional_id, purchased_at)` para histórico do profissional.
**Relacionamentos:** `lead` → 1:1 `leads`; `professional` → N:1 `professional_profiles`.

---

### 2.11 Diagrama de relacionamentos (resumo)

```
users (1)───(1) customer_profiles
  │  └──(1)───(1) professional_profiles ──(1)──(1) credit_wallets ──(1..N)── credit_transactions
  │                      │                                                        ▲
  │                      └──(N:N via professional_categories)── categories        │ reference_id
  │                                                                  │            │
  └──(1..N)── refresh_tokens                                         │            │
  │                                                                  │            │
  └──(1..N as customer)── leads ──(N:1)── categories                 │            │
                            │                                                     │
                            └──(1)───(1) lead_purchases ──(N:1)── professional_profiles
                                              (gera spend/refund) ──────────────────┘
```

---

## 3. Convenções de módulos do backend (paralelização sem conflito)

> **Objetivo:** cada agente é **dono de um conjunto de arquivos**. Ninguém edita arquivo de outro agente, exceto os **arquivos agregadores do backbone**, que são escritos por **um único agente (backbone)** com todos os imports já previstos abaixo. Os agentes de feature **apenas preenchem** seus próprios arquivos.

### 3.1 Mapa de propriedade (quem edita o quê)

| Feature | Models (donos) | Schemas | Repositories | Services | Rotas |
|---------|----------------|---------|--------------|----------|-------|
| **backbone** | `models/__init__.py`, mixins em `models/base.py` | `core/security.py`, `core/deps.py`, `api/__init__.py`, `main.py` (wiring) | — | — | — |
| **auth** | `models/user.py`, `models/refresh_token.py` | `schemas/auth.py` | `repositories/auth.py` | `services/auth.py` | `api/auth/routes.py` |
| **users** (perfis) | `models/customer_profile.py`, `models/professional_profile.py`, `models/professional_category.py` | `schemas/users.py` | `repositories/users.py` | `services/users.py` | `api/users/routes.py` |
| **categories** | `models/category.py` | `schemas/categories.py` | `repositories/categories.py` | `services/categories.py` | `api/categories/routes.py` |
| **leads** | `models/lead.py` | `schemas/leads.py` | `repositories/leads.py` | `services/leads.py` | `api/leads/routes.py` |
| **credits** | `models/credit_wallet.py`, `models/credit_transaction.py` | `schemas/credits.py` | `repositories/credits.py` | `services/credits.py` | `api/credits/routes.py` |
| **lead_purchases** | `models/lead_purchase.py` | `schemas/lead_purchases.py` | `repositories/lead_purchases.py` | `services/lead_purchases.py` (inclui matching) | `api/lead_purchases/routes.py` |

> **Regra anti-colisão:** um arquivo = um dono. `models/__init__.py` e `api/__init__.py` têm dono único (backbone). Se uma feature precisa de outra (ex.: `lead_purchases` debita créditos), ela **importa o service/repository da outra feature** — não edita os arquivos dela.

### 3.2 Models — `app/models/<entidade>.py` (um arquivo por entidade)

- Um arquivo por **entidade** (tabela), nomeado no **singular**: `user.py`, `refresh_token.py`, `customer_profile.py`, `professional_profile.py`, `professional_category.py`, `category.py`, `lead.py`, `credit_wallet.py`, `credit_transaction.py`, `lead_purchase.py`.
- Cada model herda de `Base` (de `app.database.base`) + mixins de `app.models.base` (ver §3.7).
- Enums Python (`enum.Enum` de `str`) definidos **no mesmo arquivo do model principal** que os usa, e reexportados pelo `__init__`. Para enums compartilhados entre features, ver §3.8.
- `app/models/__init__.py` (**backbone**) **reexporta tudo** para que o Alembic autogenerate e os repositórios enxerguem todos os models:

```python
# app/models/__init__.py  (dono: backbone)
from app.models.base import Base, TimestampMixin, SoftDeleteMixin, UUIDPKMixin
from app.models.user import User, UserRole, UserStatus
from app.models.refresh_token import RefreshToken
from app.models.customer_profile import CustomerProfile
from app.models.professional_profile import ProfessionalProfile, AvailabilityStatus
from app.models.professional_category import ProfessionalCategory
from app.models.category import Category, CategoryTier
from app.models.lead import Lead, LeadType, LeadUrgency, LeadStatus
from app.models.credit_wallet import CreditWallet
from app.models.credit_transaction import CreditTransaction, CreditTransactionType
from app.models.lead_purchase import LeadPurchase

__all__ = [
    "Base", "TimestampMixin", "SoftDeleteMixin", "UUIDPKMixin",
    "User", "UserRole", "UserStatus", "RefreshToken",
    "CustomerProfile", "ProfessionalProfile", "AvailabilityStatus",
    "ProfessionalCategory", "Category", "CategoryTier",
    "Lead", "LeadType", "LeadUrgency", "LeadStatus",
    "CreditWallet", "CreditTransaction", "CreditTransactionType", "LeadPurchase",
]
```

> O Alembic `env.py` deve importar `from app.models import *` (ou `import app.models`) para registrar a metadata. O agente de backbone garante isso.

### 3.3 Schemas Pydantic — `app/schemas/<feature>.py`

- Um arquivo por **feature** (não por entidade): `auth.py`, `users.py`, `categories.py`, `leads.py`, `credits.py`, `lead_purchases.py`.
- Pydantic v2. Padrão de nomes: `<Entidade>Create`, `<Entidade>Update`, `<Entidade>Read` (resposta), `<Entidade>Public` (variante pública sem dados sensíveis), e DTOs específicos (`LoginRequest`, `TokenPair`, etc.).
- Schemas de leitura usam `model_config = ConfigDict(from_attributes=True)`.
- **Nunca** expor `password_hash`, `token_hash`.

### 3.4 Repositories — `app/repositories/<feature>.py`

- Um arquivo por feature. Apenas acesso a dados (queries SQLAlchemy async), sem regra de negócio.
- Recebem `AsyncSession` por parâmetro. Não fazem `commit` (quem commita é o service, para permitir transações compostas — ex.: compra de lead). Padrão: repository faz `add`/`flush`; service faz `commit`.
- Sempre filtrar `deleted_at IS NULL` nas entidades com soft delete (salvo consultas administrativas explícitas).

### 3.5 Services — `app/services/<feature>.py`

- Um arquivo por feature. Concentra regra de negócio, validações, orquestração de repositórios e **commits**.
- Lançam exceções de domínio (ver §3.9) que viram HTTP no `routes.py`.
- `services/lead_purchases.py` contém a **lógica de matching MVP** (§5.3) e a **transação de compra** (debita wallet + cria transaction `spend` + cria `lead_purchase` + muda lead para `purchased`) de forma **atômica** (single commit, com `SELECT ... FOR UPDATE` na wallet e tratamento do `UNIQUE(lead_id)`).

### 3.6 Rotas — `app/api/<feature>/routes.py`

- Cada feature expõe **`router = APIRouter()`** (sem prefixo próprio — o prefixo é aplicado pelo agregador, §3.10).
- Cada `<feature>/__init__.py` (já existe da Fase 1) deve reexportar: `from app.api.<feature>.routes import router`.
- Rotas chamam services, convertem exceções de domínio → `HTTPException`, e dependem de `get_db`, `get_current_user`, `require_roles(...)` (de `core/deps.py`).
- `tags=["<feature>"]` em cada router para a doc OpenAPI.

### 3.7 Core compartilhado — mixins de model (`app/models/base.py`, dono: backbone)

```python
# app/models/base.py  (dono: backbone)
import uuid
from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base  # DeclarativeBase já existe (Fase 1)

class UUIDPKMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

> `app.database.base.Base` e `get_db` **já existem** da Fase 1 — não recriar. `Base` é reexportado por `app/models/__init__.py` para conveniência.

### 3.8 Padrão obrigatório de enums Postgres

- Definir como `class XxxEnum(str, enum.Enum)` no arquivo do model que é o "dono" do enum (ver §3.2).
- Na coluna: `mapped_column(Enum(XxxEnum, name="<enum_name>", native_enum=True, validate_strings=True))`.
- Nome do tipo Postgres = o `name=` da tabela em §2 (ex.: `user_role`, `lead_status`).
- **Não** duplicar a mesma definição de enum em dois arquivos. Se uma feature precisa de um enum de outra, importa de `app.models.<arquivo>`.

### 3.9 Exceções de domínio (`app/core/exceptions.py`, dono: backbone)

Classes base que os services lançam e as rotas convertem:

| Exceção | HTTP | Uso |
|---------|------|-----|
| `NotFoundError` | 404 | recurso inexistente |
| `ConflictError` | 409 | unique violado (email/phone duplicado, lead já comprado) |
| `PermissionDeniedError` | 403 | ownership/role |
| `ValidationError` (domínio) | 422 | regra de negócio violada |
| `InsufficientCreditsError` | 402 | saldo insuficiente na compra |
| `AuthError` | 401 | credenciais/token inválidos |

> Um exception handler global em `main.py` (backbone) mapeia essas para JSON `{"detail": "..."}`. Alternativamente cada rota faz o try/except — **decisão: handler global** para padronizar.

### 3.10 Agregador `app/api/__init__.py` (dono: backbone) — conteúdo esperado

O backbone escreve isto; os agentes de feature **só** entregam o `router` em seus `routes.py`. Mantém o health da Fase 1.

```python
# app/api/__init__.py  (dono: backbone)
from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.auth.routes import router as auth_router
from app.api.users.routes import router as users_router
from app.api.categories.routes import router as categories_router
from app.api.leads.routes import router as leads_router
from app.api.credits.routes import router as credits_router
from app.api.lead_purchases.routes import router as lead_purchases_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health_router)                                  # /api/v1/health
api_router.include_router(auth_router,           prefix="/auth",            tags=["auth"])
api_router.include_router(users_router,          prefix="/users",           tags=["users"])
api_router.include_router(categories_router,     prefix="/categories",      tags=["categories"])
api_router.include_router(leads_router,          prefix="/leads",           tags=["leads"])
api_router.include_router(credits_router,        prefix="/credits",         tags=["credits"])
api_router.include_router(lead_purchases_router, prefix="/lead-purchases",  tags=["lead_purchases"])
```

**Prefixos sob `/api/v1`:** `/auth`, `/users`, `/categories`, `/leads`, `/credits`, `/lead-purchases`.

### 3.11 `core/security.py` (dono: backbone) — ampliar o esqueleto da Fase 1

Já existe (PyJWT, `create_access_token`, `create_refresh_token`, `decode_token`). **Adicionar** (sem quebrar assinaturas existentes):

```python
# app/core/security.py  (dono: backbone) — ADIÇÕES
from passlib.context import CryptContext
import hashlib

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str: ...        # passlib/bcrypt
def verify_password(plain: str, hashed: str) -> bool: ...
def hash_refresh_token(raw_token: str) -> str:   # SHA-256 hex, p/ armazenar em refresh_tokens.token_hash
    return hashlib.sha256(raw_token.encode()).hexdigest()
```

- `create_access_token` / `create_refresh_token` / `decode_token` permanecem como estão; refresh token deve incluir claim `type=refresh` (já incluso). Access carrega `sub=user_id` e claim extra `role` (para RBAC sem hit no banco).

### 3.12 `core/deps.py` (dono: backbone) — dependências de auth/RBAC

```python
# app/core/deps.py  (dono: backbone)
from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.models import User, UserRole

async def get_current_user(
    authorization: str = Header(...),       # "Bearer <access_token>"
    db: AsyncSession = Depends(get_db),
) -> User:
    """Valida o access token (type=access), carrega o User ativo, ou 401."""
    ...

def require_roles(*roles: UserRole):
    """Factory de dependency que exige que current_user.role ∈ roles, senão 403."""
    async def _dep(current_user: User = Depends(get_current_user)) -> User:
        ...
    return _dep
```

Uso nas rotas: `Depends(get_current_user)` e `Depends(require_roles(UserRole.admin))` / `require_roles(UserRole.customer)` / `require_roles(UserRole.professional)`.

### 3.13 Ordem de implementação e migrations

- **Migrations Alembic:** **uma migration por feature**, em ordem de dependência (FKs): (1) auth `users`+`refresh_tokens` → (2) categories `categories` → (3) users `customer_profiles`/`professional_profiles`/`professional_categories` → (4) leads `leads` → (5) credits `credit_wallets`/`credit_transactions` → (6) lead_purchases `lead_purchases`. Cada migration tem `down_revision` apontando para a anterior. **Coordenar a cadeia de revisões** (o backbone fixa a primeira; cada feature encadeia). Evitar autogenerate concorrente que gere revisões paralelas — **uma cadeia linear**.
- Tipos `ENUM` nativos: a migration que cria a tabela cria o tipo; em `downgrade` fazer `DROP TYPE`.

---

## 4. Endpoints por fase

> Base: `/api/v1`. Auth: "JWT access" = header `Authorization: Bearer <access>`. Papel = role exigida (RBAC). Erros padronizados via §3.9. Paginação: query `?page=1&page_size=20` (default 20, máx 100), resposta `{"items": [...], "page", "page_size", "total"}`.

### Fase 2 — Autenticação (`/auth`)

| Método | Caminho | Auth | Papel | Request (corpo) | Response |
|--------|---------|------|-------|-----------------|----------|
| POST | `/auth/register` | público | — | `{name, email, phone, password, role}` (`role` ∈ `customer|professional`; **admin nunca via register**) | `201 {user: UserRead, tokens: {access_token, refresh_token, token_type:"bearer"}}` |
| POST | `/auth/login` | público | — | `{email, password}` | `200 {user: UserRead, tokens: TokenPair}` (atualiza `last_login_at`) |
| POST | `/auth/refresh` | público (refresh token no corpo) | — | `{refresh_token}` | `200 {tokens: TokenPair}` (rotação: revoga o antigo, emite novo par) |
| POST | `/auth/logout` | JWT access | qualquer | `{refresh_token}` | `204` (revoga o refresh token; access expira sozinho) |
| GET | `/auth/me` | JWT access | qualquer | — | `200 UserRead` (+ flags `has_customer_profile`, `has_professional_profile`) |
| POST | `/auth/password-reset/request` | público | — | `{email}` | `200 {reset_token}` **(MVP: token devolvido na resposta, sem email — ver §7)** |
| POST | `/auth/password-reset/confirm` | público | — | `{reset_token, new_password}` | `204` (troca senha, revoga todos refresh tokens do usuário) |

> **`TokenPair`** = `{access_token, refresh_token, token_type:"bearer", expires_in}`.
> **`UserRead`** = `{id, name, email, phone, role, status, last_login_at, created_at}` (sem `password_hash`).
> **Reset token (MVP):** JWT curto (`type=password_reset`, exp 30min) assinado com o mesmo segredo, sem persistir tabela nova. Validação no confirm.

### Fase 3 — Perfis e Categorias (`/users`, `/categories`)

**Perfis** (feature `users`):

| Método | Caminho | Auth | Papel | Request | Response |
|--------|---------|------|-------|---------|----------|
| POST | `/users/me/customer-profile` | JWT | customer | `{city, state, reputation_score?(ignorado)}` | `201 CustomerProfileRead` (cria 1:1; 409 se já existe) |
| GET | `/users/me/customer-profile` | JWT | customer | — | `200 CustomerProfileRead` |
| PATCH | `/users/me/customer-profile` | JWT | customer | `{city?, state?}` | `200 CustomerProfileRead` |
| POST | `/users/me/professional-profile` | JWT | professional | `{headline?, bio?, city, state, service_radius_km?, availability_status?, category_ids?[]}` | `201 ProfessionalProfileRead` (cria 1:1 **+ wallet automática**; vincula categorias se enviadas) |
| GET | `/users/me/professional-profile` | JWT | professional | — | `200 ProfessionalProfileRead` (inclui `categories[]`) |
| PATCH | `/users/me/professional-profile` | JWT | professional | `{headline?, bio?, city?, state?, service_radius_km?, availability_status?}` | `200 ProfessionalProfileRead` |
| PUT | `/users/me/professional-profile/categories` | JWT | professional | `{category_ids: [uuid]}` | `200 {categories: [CategoryRead]}` (substitui o conjunto de vínculos) |
| GET | `/users/me/professional-profile/categories` | JWT | professional | — | `200 {categories: [CategoryRead]}` |
| GET | `/users/{user_id}/professional-profile` | JWT | qualquer | — | `200 ProfessionalProfilePublic` (perfil público; sem dados sensíveis) |

**Categorias** (feature `categories`):

| Método | Caminho | Auth | Papel | Request | Response |
|--------|---------|------|-------|---------|----------|
| GET | `/categories` | público | — | query `?active=true&q=` | `200 [CategoryRead]` (default só ativas) |
| GET | `/categories/{id}` | público | — | — | `200 CategoryRead` |
| POST | `/categories` | JWT | admin | `{name, slug, tier, active?}` | `201 CategoryRead` |
| PATCH | `/categories/{id}` | JWT | admin | `{name?, slug?, tier?, active?}` | `200 CategoryRead` |
| DELETE | `/categories/{id}` | JWT | admin | — | `204` (soft: setar `active=false`; sem hard delete se houver leads/vínculos) |

### Fase 4 — Leads (`/leads`)

| Método | Caminho | Auth | Papel | Request | Response |
|--------|---------|------|-------|---------|----------|
| POST | `/leads` | JWT | customer | `{category_id, title, description, lead_type, urgency, city, state, neighborhood?}` | `201 LeadRead` (`credits_cost` e `expires_at` calculados no backend — §5.1) |
| GET | `/leads` | JWT | customer **ou** professional | query: `?status=&category_id=&city=&state=&page=&page_size=` | `200` paginado. **Customer:** vê apenas os **próprios** leads. **Professional:** vê leads **elegíveis** (matching MVP §5.3, status `open`), **sem contato** do customer. |
| GET | `/leads/{id}` | JWT | customer dono **ou** professional elegível/comprador | — | `200 LeadRead` (customer dono vê tudo; professional vê detalhe **sem contato** se não comprou; **com contato** se comprou) |
| PATCH | `/leads/{id}` | JWT | customer (dono) | `{title?, description?, urgency?, neighborhood?}` | `200 LeadRead` (só se `status=open`; **não** permite trocar `category_id`/`lead_type` após criação pois mudaria `credits_cost`; ownership obrigatório) |
| DELETE | `/leads/{id}` | JWT | customer (dono) | — | `204` (cancela: `status=cancelled` + soft delete; só se ainda `open`) |

> **`LeadRead`** = todos os campos de `leads` + `category` (resumo) + `customer` (resumo, **sem telefone/email** para professional não-comprador) + `is_purchased` (bool). **`LeadContact`** (telefone/email do customer) só aparece para o **professional que comprou** ou para o **customer dono**.

### Fase 5 — Créditos (`/credits`) e Compra de Lead (`/lead-purchases`)

**Créditos** (feature `credits`):

| Método | Caminho | Auth | Papel | Request | Response |
|--------|---------|------|-------|---------|----------|
| GET | `/credits/balance` | JWT | professional | — | `200 {wallet_id, balance}` (cria wallet lazily se faltar) |
| GET | `/credits/history` | JWT | professional | query `?type=&page=&page_size=` | `200` paginado de `CreditTransactionRead` (próprio wallet) |
| POST | `/credits/grant` | JWT | **admin** | `{professional_id, amount, transaction_type, description?}` (`transaction_type` ∈ `bonus|adjustment`; `amount` pode ser negativo só em `adjustment`) | `201 CreditTransactionRead` **(endpoint ADMIN/DEV — substitui pagamentos da Fase 6; ver §7)** |

**Compra de Lead** (feature `lead_purchases`):

| Método | Caminho | Auth | Papel | Request | Response |
|--------|---------|------|-------|---------|----------|
| POST | `/lead-purchases` | JWT | professional | `{lead_id}` | `201 {purchase: LeadPurchaseRead, lead: LeadRead (com contato liberado), wallet: {balance}}`. Transação atômica: valida elegibilidade + saldo, debita (`spend`), cria purchase, lead→`purchased`. Erros: `402` saldo insuficiente, `409` lead já comprado, `403` não elegível, `404` lead inexistente. |
| GET | `/lead-purchases` | JWT | professional | query `?page=&page_size=` | `200` paginado das compras do profissional (com `lead` resumido + contato liberado) |
| GET | `/lead-purchases/{id}` | JWT | professional (dono da compra) | — | `200 LeadPurchaseRead` (com lead + contato) |

> **`CreditTransactionRead`** = `{id, transaction_type, amount, balance_before, balance_after, description, reference_id, created_at}`.
> **`LeadPurchaseRead`** = `{id, lead_id, professional_id, credits_used, purchased_at, lead: LeadRead, contact: LeadContact}`.

---

## 5. Regras de negócio chave (MVP)

### 5.1 Classificação de lead → custo em créditos
- Mapa base por **tier da categoria** (`categories.tier`): `simple → 1`, `medium → 3`, `premium → 5`.
- **Promoção por `lead_type`** (contratações de maior valor custam mais): se `lead_type ∈ {temporary, permanent}`, o custo é **elevado ao mínimo de 5** (premium). Justificativa: o lead-engine lista "contratação fixa / cuidador mensal / doméstica fixa" como premium.
- **Fórmula MVP (configurável em um único lugar — `services/leads.py`, dict `LEAD_COST`):**
  ```
  base = TIER_COST[category.tier]            # 1 | 3 | 5
  if lead_type in (temporary, permanent):
      cost = max(base, 5)
  else:
      cost = base
  credits_cost = cost
  ```
- `credits_cost` é **gravado na criação** do lead e **imutável** depois (por isso PATCH não troca categoria/tipo). Constantes ficam em um único módulo (`app/services/leads.py` ou `app/core/pricing.py`) para serem "configuráveis" sem espalhar mágica.
- `expires_at` MVP = `created_at + 30 dias` (constante configurável). Lead expirado não aparece como elegível (filtro `expires_at IS NULL OR expires_at > now()`).

### 5.2 Validação de ownership e papéis
- **Customer só edita/cancela o próprio lead** (`leads.customer_id == current_user.id`), senão `403`.
- **Customer** não compra leads; **professional** não cria leads (enforçado por `require_roles`).
- Perfil: cada usuário gerencia **apenas o próprio** perfil (`/users/me/...`). `GET /users/{user_id}/professional-profile` é leitura pública.
- Admin: apenas `role == admin` acessa CRUD de categorias e `POST /credits/grant`.
- Proteção IDOR: nunca confiar em IDs do corpo para identificar o ator — usar sempre `current_user`. Mass assignment: schemas `*Create/*Update` listam apenas campos permitidos (ex.: `reputation_score`, `rating`, `xp`, `verified`, `premium`, `credits_cost`, `balance` **nunca** vêm do cliente).

### 5.3 Matching MVP (elegibilidade) — usado em `GET /leads` (professional) e na compra
Um **professional é elegível** para um lead se **TODOS**:
1. `users.status == active` e `users.deleted_at IS NULL` (não suspenso/bloqueado).
2. Possui `professional_profiles` (perfil criado) e não soft-deleted.
3. **Mesma categoria:** existe vínculo em `professional_categories` com `lead.category_id`.
4. **Mesma cidade e estado:** `professional_profiles.city == lead.city` **e** `professional_profiles.state == lead.state` (igualdade exata, case-insensitive; geo/raio é V2 — `service_radius_km` existe mas não é aplicado no MVP além de ser exibido).
5. **Lead disponível:** `lead.status == open`, não expirado, não soft-deleted.
6. **Saldo suficiente:** `credit_wallets.balance >= lead.credits_cost` (validado **no momento da compra**; na **listagem** o lead aparece mesmo sem saldo, com flag `affordable: bool`, para incentivar recarga).
7. *(Opcional, recomendado)* `availability_status != unavailable`. **Decisão MVP:** **não** filtrar por disponibilidade na listagem (apenas exibir), para não esconder oportunidades; revisitar na Fase 9.

> O score/ranking ponderado do `matching-engine.md` (distância, reputação, tempo de resposta, nível, top-20, 20% para novos) **NÃO entra no MVP** — apenas o filtro de elegibilidade acima. Ordenação da listagem: `created_at DESC` (mais novos primeiro).

### 5.4 Lead Exclusivo — compra (transação atômica)
Ordem no `services/lead_purchases.purchase(...)` (um único `commit`):
1. Carregar lead `FOR UPDATE` (ou ao menos revalidar status); verificar `status == open`, não expirado → senão `409 ConflictError("lead indisponível")`.
2. Verificar elegibilidade (§5.3 itens 1–5) → senão `403`.
3. Carregar wallet `SELECT ... FOR UPDATE`; verificar `balance >= lead.credits_cost` → senão `402 InsufficientCreditsError`.
4. Debitar: criar `credit_transactions` (`transaction_type=spend`, `amount = -credits_cost`, `balance_before`, `balance_after`, `reference_id = purchase.id`), atualizar `wallet.balance`.
5. Criar `lead_purchases` (`credits_used = lead.credits_cost`). O **`UNIQUE(lead_id)`** garante atomicidade real: se dois profissionais competirem, a segunda inserção viola o unique → capturar `IntegrityError` → `409` + rollback (sem debitar). **Ordem segura:** inserir o `lead_purchase` (flush) **antes** de confirmar o débito, ou capturar o `IntegrityError` e reverter; o importante é que um conflito de unique **nunca** deixe o crédito debitado.
6. Atualizar `lead.status = purchased`.
7. Commit. Resposta libera **contato** (`LeadContact`: telefone/email do customer).

### 5.5 Reembolso (créditos)
- **MVP:** reembolso é manual via admin (não há endpoint dedicado de refund nestas fases além do `grant` com `adjustment`? — **Decisão:** o reembolso de uma compra inválida é feito por **`POST /credits/grant`** com `transaction_type=refund` **ou** `adjustment`. Para manter simples e dentro do escrito, `grant` aceita `bonus|adjustment`; **refund** é tratado na Fase 6/10 (cancelamento de lead pelo admin). **Não** implementar refund automático agora.
- Reembolso **nunca** em dinheiro. Quando implementado, gera `credit_transactions(type=refund, amount>0)`.

### 5.6 O que NÃO entra agora (reforço)
Pagamentos/pacotes/PIX (Fase 6), reviews/reputação real (Fase 7 — `rating`/`reputation_score`/`total_reviews` ficam em default), chat/contato em tempo real e `conversations`/`messages` (Fase 8 — o "contato liberado" no MVP é apenas exibir telefone/email do customer no payload da compra), gamificação/XP/níveis/medalhas (Fase 9), notificações/push/email (a recuperação de senha **não envia email** — §7), verificação/KYC, antifraude, matching ponderado/ranking/escassez, lead compartilhado/leilão, WebSocket.

---

## 6. Convenções do frontend

> Next.js 14 (App Router), TypeScript, Tailwind, Shadcn UI, React Query, Zustand, React Hook Form, Zod. Base já criada na Fase 1 (`src/services/api.ts`, `src/store/`, módulos placeholder).

### 6.1 Organização (mesma lógica de "um dono por arquivo")
- **Módulos por feature:** `src/modules/<feature>/` com `components/`, `hooks/` (React Query queries/mutations), `api.ts` (chamadas tipadas), `schemas.ts` (Zod), `types.ts`. Features: `auth`, `profile` (perfis customer+professional), `categories`, `leads`, `credits`.
- **Rotas (App Router) em `src/app/...`:** páginas finas que compõem os módulos.
- **Store de auth (Zustand):** `src/store/auth.ts` — guarda `{user, accessToken, refreshToken}`, ações `setSession`, `clear`, e seletores de papel (`isCustomer`, `isProfessional`, `isAdmin`). Persistir tokens (localStorage) com cuidado.
- **Cliente API:** `src/services/api.ts` (já existe) — **injetar `Authorization: Bearer <access>`** automaticamente e implementar **refresh automático**: em `401`, tentar `POST /auth/refresh` uma vez (com o refresh token do store), atualizar a sessão e repetir a request; se o refresh falhar, `clear()` + redirect para `/login`. Um único interceptor/wrapper.
- **Tipos compartilhados** em `src/types/` espelham os `*Read` do backend.

### 6.2 Telas por fase
- **Fase 2 (auth):** `/register` (cadastro: nome, email, telefone, senha, escolha de papel customer/professional), `/login`, `/forgot-password` (solicita reset → no MVP exibe/usa o `reset_token` retornado), `/reset-password` (define nova senha). Guarda de rota (redirect se não autenticado).
- **Fase 3 (perfis + categorias):** `/onboarding` ou `/profile` — formulário de perfil **customer** (cidade/estado) ou **professional** (headline, bio, cidade, estado, raio, disponibilidade, seleção de categorias multi-select consumindo `GET /categories`). Tela de perfil público do profissional `/professionals/[userId]`.
- **Fase 4 (leads — customer):** `/leads/new` (criar solicitação: categoria, título, descrição, tipo, urgência, cidade/estado/bairro; mostrar `credits_cost` estimado), `/leads` (listar **meus** leads com status), `/leads/[id]` (detalhe + editar/cancelar se `open`).
- **Fase 5 (marketplace + carteira — professional):** `/marketplace` (leads **elegíveis**: cards com categoria, cidade, urgência, custo em créditos, flag "saldo suficiente"; **sem contato**), `/marketplace/[leadId]` (detalhe + botão **Comprar lead**), `/credits` (saldo + histórico de transações), modal/tela de "créditos insuficientes" guiando à recarga (no MVP, recarga é via admin/dev), `/purchases` (leads comprados com **contato liberado**).
- **Admin (mínimo, sem painel completo — Fase 10):** telas simples protegidas por `role=admin` para CRUD de `/categories` e para `POST /credits/grant` (conceder créditos a um profissional) — suficientes para operar o MVP.

### 6.3 Princípios
- Validação client-side com Zod **espelhando** as regras do backend (mas o backend é a fonte da verdade — nunca confiar no client).
- React Query para cache/estado de servidor; mutations invalidam as queries afetadas (ex.: comprar lead invalida `balance`, `history`, `marketplace`, `purchases`).
- Nunca renderizar contato do customer em telas de marketplace antes da compra.

---

## 7. Simplificações assumidas no MVP

1. **Recuperação de senha sem email:** `POST /auth/password-reset/request` **retorna o `reset_token` na própria resposta** (não envia email). O envio por email é da fase de notificações. O front usa o token retornado direto na tela de redefinição. Documentar como dev-only.
2. **Créditos concedidos por endpoint admin/dev:** como pagamentos são a Fase 6, a única forma de creditar saldo no MVP é `POST /credits/grant` (admin), gerando `credit_transactions` `bonus`/`adjustment`. Pacotes/PIX/cartão/webhooks não existem aqui.
3. **Matching por regras simples:** apenas filtro de elegibilidade (categoria + cidade/estado + ativo + lead aberto; saldo checado na compra). Sem score ponderado, ranking, top-20, reserva para novos, escassez ou notificações.
4. **Geolocalização ausente:** `service_radius_km` é armazenado e exibido, mas **não** usado no filtro (cidade/estado exatos). Lat/long e raio real são V2.
5. **"Contato liberado" = payload, não chat:** ao comprar, o profissional recebe telefone/email do customer no JSON da compra. Não há `conversations`/`messages`/WebSocket (Fase 8).
6. **Reputação/gamificação/verificação em default:** colunas existem no schema (`rating`, `reputation_score`, `total_reviews`, `xp`, `level`, `verified`, `premium`), porém sem endpoints/regras nestas fases — permanecem nos defaults.
7. **Reembolso não-automático:** reembolso real (com `transaction_type=refund`) e cancelamento administrativo de lead com estorno entram na Fase 6/10. No MVP, ajustes manuais via `grant`/`adjustment`.
8. **Sub-papéis de admin inexistentes:** um único `admin` faz todas as ações administrativas do escopo (categorias, grant). Granularidade (`moderator`/`finance`/`support`) é Fase 10.
9. **Refresh tokens em Postgres (não Redis):** rotação/revogação via tabela `refresh_tokens`. Detecção de reuso básica (revogar todos ao detectar token revogado reapresentado).
10. **Rate limiting / auditoria / logs de segurança:** previstos na arquitetura, **não** implementados nestas fases (entram com segurança/Fase 10). Apenas as proteções já citadas (ownership, RBAC, mass assignment, IDOR) são obrigatórias agora.

---

### Decisões adicionais tomadas neste contrato (registro para aprovação)
1. **`categories.tier` (`simple|medium|premium`)** — coluna nova não presente no doc 04, necessária para mapear categoria → custo do lead de forma configurável (§5.1).
2. **`credit_transactions.reference_id` (UUID nullable, sem FK)** — rastreabilidade da origem da transação (qual compra), extensão opcional.
3. **`leads.customer_id` referencia `users.id`** (não `customer_profiles.id`) — permite publicar lead sem exigir perfil customer criado; service valida `role==customer`.
4. **Custo de lead promovido a premium (5) para `temporary`/`permanent`** — interpretação do lead-engine (contratações fixas = alto valor).
5. **Índices únicos parciais (`WHERE deleted_at IS NULL`)** para `users.email`/`users.phone` — permite reuso após soft delete.
6. **Wallet criada junto com o perfil profissional** (transação da Fase 3), com fallback lazy em `/credits/balance`.
7. **Exception handler global + exceções de domínio** (`app/core/exceptions.py`) — padroniza respostas de erro entre as features.
