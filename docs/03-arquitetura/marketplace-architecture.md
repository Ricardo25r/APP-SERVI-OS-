# marketplace-architecture.md

# Marketplace Architecture

Projeto: FazTudo

Versão: 1.0

Status: Arquitetura Oficial

---

# Visão Geral

O sistema será uma plataforma web responsiva preparada para evolução futura para Android e iOS.

Arquitetura baseada em:

Frontend
↓
API Gateway
↓
Serviços de Negócio
↓
PostgreSQL
↓
Redis
↓
Storage

---

# Stack Tecnológica

## Frontend

Next.js

TypeScript

TailwindCSS

Shadcn UI

React Query

Zustand

React Hook Form

Zod

---

## Backend

FastAPI

Python

Pydantic

SQLAlchemy

Alembic

JWT

---

## Banco de Dados

PostgreSQL

---

## Cache

Redis

---

## Arquivos

S3 Compatible

MinIO (desenvolvimento)

Cloudflare R2 (produção)

---

# Módulos do Sistema

## Módulo de Autenticação

Responsável por:

* login
* cadastro
* recuperação de senha
* refresh token
* sessão

---

## Módulo de Usuários

Responsável por:

* contratantes
* profissionais
* administradores

---

## Módulo de Leads

Responsável por:

* criação
* distribuição
* compra
* histórico

---

## Módulo de Créditos

Responsável por:

* compra
* saldo
* movimentação

---

## Módulo de Pagamentos

Responsável por:

* PIX
* cartão
* assinatura premium

---

## Módulo de Chat

Responsável por:

* mensagens
* anexos
* notificações

---

## Módulo de Avaliações

Responsável por:

* reputação
* comentários
* notas

---

## Módulo de Gamificação

Responsável por:

* XP
* medalhas
* níveis
* ranking

---

## Módulo Administrativo

Responsável por:

* gestão da plataforma
* validações
* métricas

---

# Estrutura de Banco

## users

```sql
id
uuid
name
email
phone
password_hash
role
status
created_at
updated_at
```

Roles:

* customer
* professional
* admin

---

## professional_profiles

```sql
id
user_id
headline
bio
city
state
verified
premium
xp
level
rating
total_reviews
created_at
```

---

## customer_profiles

```sql
id
user_id
city
state
rating
created_at
```

---

## categories

```sql
id
name
slug
active
```

Exemplos:

* eletricista
* babá
* doméstica
* cuidador
* encanador
* pintor

---

## leads

```sql
id
customer_id
category_id
title
description
lead_type
urgency
city
state
status
credits_cost
created_at
```

---

Lead Types

* pontual
* temporario
* permanente

---

Status

* aberto
* comprado
* encerrado
* cancelado

---

## lead_purchases

```sql
id
lead_id
professional_id
credits_used
created_at
```

---

## credit_wallets

```sql
id
professional_id
balance
created_at
```

---

## credit_transactions

```sql
id
wallet_id
type
amount
description
created_at
```

---

Tipos

* compra
* bonus
* consumo
* estorno

---

## reviews

```sql
id
author_id
target_id
score
comment
created_at
```

---

## messages

```sql
id
conversation_id
sender_id
content
created_at
```

---

## conversations

```sql
id
lead_id
customer_id
professional_id
status
created_at
```

---

## achievements

```sql
id
name
slug
description
xp_reward
```

---

## user_achievements

```sql
id
user_id
achievement_id
earned_at
```

---

## verification_requests

```sql
id
user_id
document_url
selfie_url
status
reviewed_by
reviewed_at
```

---

Status

* pendente
* aprovado
* rejeitado

---

# Sistema de Permissões

## Customer

Pode:

* criar leads
* editar leads próprios
* avaliar profissionais
* conversar

---

## Professional

Pode:

* comprar leads
* responder leads
* conversar
* receber avaliações

---

## Admin

Pode:

* tudo

---

# Estrutura Backend

```text
backend/

app/

api/

auth/

users/

leads/

credits/

payments/

chat/

reviews/

gamification/

admin/

core/

database/

services/

repositories/

schemas/

models/

middlewares/

tests/
```

---

# Estrutura Frontend

```text
frontend/

src/

app/

components/

modules/

auth/

dashboard/

leads/

credits/

chat/

reviews/

profile/

admin/

hooks/

services/

store/

types/
```

---

# APIs Principais

## Auth

POST /auth/register

POST /auth/login

POST /auth/refresh

POST /auth/logout

---

## Leads

GET /leads

POST /leads

GET /leads/{id}

PATCH /leads/{id}

DELETE /leads/{id}

---

## Créditos

GET /credits/balance

GET /credits/history

POST /credits/purchase

---

## Compras

POST /lead-purchases

GET /lead-purchases

---

## Avaliações

POST /reviews

GET /reviews/{userId}

---

## Chat

GET /conversations

POST /messages

GET /messages

---

# Sistema de Notificações

Notificar:

* novo lead
* lead comprado
* mensagem recebida
* avaliação recebida
* conquista desbloqueada
* créditos adicionados

---

# Dashboard do Profissional

Mostrar:

* saldo de créditos
* leads comprados
* avaliações
* nível
* XP
* ranking
* medalhas

---

# Dashboard do Contratante

Mostrar:

* solicitações abertas
* profissionais interessados
* histórico
* avaliações realizadas

---

# Painel Administrativo

## Usuários

* listar
* bloquear
* suspender

---

## Leads

* monitorar
* cancelar
* reembolsar

---

## Financeiro

* receita
* créditos vendidos
* assinaturas

---

## Moderação

* denúncias
* avaliações
* documentos

---

# Segurança Obrigatória

Implementar:

* JWT
* Refresh Token
* RBAC
* Soft Delete
* Rate Limiting
* Auditoria
* Ownership Validation
* Proteção IDOR
* Proteção Mass Assignment
* Logs de Segurança

---

# Métricas do Negócio

* Leads criados
* Leads comprados
* Receita por lead
* Receita por profissional
* Taxa de conversão
* Avaliação média
* Retenção
* LTV
* CAC

---

# Roadmap Futuro

V2

* Aplicativo Android
* Aplicativo iOS
* Push Notifications
* Geolocalização em tempo real

---

V3

* IA para criação automática de solicitações
* IA para recomendação de profissionais
* IA para ranking inteligente
* IA para precificação de leads

---

V4

* Leilão de Leads
* Match inteligente
* Contratação assistida por IA

---

# Objetivo Final

Construir a maior plataforma de contratação local do Brasil, conectando pessoas que precisam de serviços com profissionais qualificados, através de um sistema de reputação, gamificação e geração de oportunidades que beneficie ambos os lados do marketplace.
