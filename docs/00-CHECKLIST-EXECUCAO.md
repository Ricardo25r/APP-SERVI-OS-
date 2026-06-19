# ✅ Checklist de Execução — FazTudo

> **Este é o nosso mapa.** Serve para nós dois (cliente + Claude) não nos perdermos.
> Atualize os checkboxes conforme avançamos.
>
> - Projeto: **FazTudo** — Marketplace Inteligente de Prestadores de Serviços Locais
> - Repositório: https://github.com/Ricardo25r/APP-SERVI-OS-
> - Pasta local: `C:\TrampoJa`
> - Última atualização: **2026-06-18**
> - Fase atual: **✅ Fases 1–6 CONCLUÍDAS e validadas** (ciclo econômico E2E no Postgres: comprar créditos → comprar lead; 55 testes; frontend builda). Próximo: Fase 7 — Avaliações + Reputação.

---

## 🌙 Status da noite — 2026-06-19 (build das Fases 2-5 interrompido por LIMITE DE SESSÃO)

> O build autônomo das Fases 2-5 começou, mas a sessão **bateu no limite (reset 00:20)** no meio da fan-out do backend. **Nada está quebrado** (`py_compile` do backend = OK; o app ainda sobe). O trabalho em andamento está no branch **`feat/fases-2-5-wip`** (não no `main`, que segue na Fase 1 validada e funcionando).

**Contrato:** `docs/fases/contrato-fases-2-5.md` (modelo de dados das 11 tabelas + endpoints + convenções). ✅

**O que JÁ está pronto (no branch wip):**
- ✅ **Backbone backend:** todos os models (`app/models/*.py`), enums, mixins, `core/deps.py` (get_current_user, require_roles), `core/security.py` (hash de senha + JWT access/refresh + reset), agregador de rotas resiliente, `seeds.py` (categorias). Compila e importa limpo.
- ✅ **Feature Leads (Fase 4):** `api/leads/routes.py` + `schemas/leads.py` + `services/leads.py` + `repositories/leads.py` + `tests/test_leads.py` (11 testes passando, via SQLite em memória).

**O que está PARCIAL:**
- 🟡 **Auth (Fase 2):** existem `schemas/auth.py`, `services/auth.py`, `repositories/auth.py` — **falta criar `app/api/auth/routes.py`** (register/login/refresh/logout/me/password-reset).
- 🟡 **Categorias (Fase 3):** existem `schemas/categories.py`, `services/categories.py`, `repositories/categories.py` — **falta `app/api/categories/routes.py`**.

**O que FALTA por completo:**
- ❌ **Perfis/users (Fase 3):** criar `schemas/users.py`, `services/users.py`, `repositories/users.py`, `app/api/users/routes.py` (customer/professional profile + categorias do profissional + criação da wallet).
- ❌ **Créditos + Compra/Matching (Fase 5):** criar `schemas/credits.py`, `schemas/lead_purchases.py`, `services/credits.py`, `services/lead_purchases.py`, `repositories/credits.py`, `repositories/lead_purchases.py`, `app/api/credits/routes.py`, `app/api/lead_purchases/routes.py`.
- ❌ **Frontend das Fases 2-5** (telas de cadastro/login/perfil/leads/marketplace/créditos) — nem começou.
- ❌ **Migration Alembic** das tabelas 2-5.

**PLANO DE RETOMADA (após reset 00:20) — em ordem:**
1. `git checkout feat/fases-2-5-wip` (continuar de onde parou).
2. Completar backend: `auth/routes.py`, `categories/routes.py`, feature `users` (perfis) e feature `credits`+`lead_purchases` (1 agente por feature faltante).
3. Pequenos consertos pendentes:
   - adicionar `aiosqlite` às dev-deps (o `test_leads.py` usa SQLite em memória).
   - `bcrypt` foi pinado para 4.x no `requirements.txt`/`pyproject.toml` → **rebuild da imagem backend** (`docker compose --profile full build backend`) para alinhar (container atual tem bcrypt 5).
4. Gerar e aplicar migration **DENTRO do container** (host→5432 é bloqueado):
   `docker exec trampoja-backend alembic revision --autogenerate -m "fases 2-5"` e depois `... alembic upgrade head`. Rodar `python -m app.seeds` para popular categorias.
5. Verificar: restart backend, smoke test dos endpoints (register→login→criar perfil→criar lead→conceder créditos→comprar lead), `pytest`, `ruff`.
6. Frontend: fan-out das telas (auth, perfil, leads, marketplace/créditos), `npm run build`.
7. Commit por fase, abrir PR do branch para `main` (ou merge) quando 2-5 estiverem verdes; marcar as fases no checklist.

---

## 🧭 Como trabalhamos (regras combinadas)

- [x] Documentação organizada em `docs/` antes de qualquer código.
- [ ] **Uma fase de implementação por vez.** Não pular etapas.
- [ ] Não criar funcionalidade fora do escopo.
- [ ] Ao final de **cada fase**, entregar: **código + migrations + testes + documentação + checklist de validação**.
- [ ] Só iniciar a próxima fase após concluir e validar a anterior.

---

## 1) Documentação — Status

### Fonte da verdade (enviada pelo cliente)
- [x] 01 — `master-task.md`
- [x] 02 — `lead-engine.md`
- [x] 03 — `marketplace-architecture.md`
- [x] 04 — `database-schema.md`
- [x] 05 — `payment-engine.md`
- [x] 06 — `matching-engine.md`
- [x] 07 — `reputation-engine.md`
- [x] 08 — `gamification-engine.md`
- [x] 19 — `anti-fraud-engine.md` *(chegou por último; pasta 19)*

### Specs complementares (gerados)
- [x] 09 — `admin-panel-spec.md`
- [x] 10 — `notification-engine.md`
- [x] 11 — `chat-engine.md`
- [x] 12 — `search-engine.md`
- [x] 13 — `analytics-spec.md`
- [x] 14 — `referral-engine.md`
- [x] 15 — `verification-engine.md`
- [x] 16 — `support-center-spec.md`
- [x] 17 — `security-spec.md`
- [x] 18 — `future-ai-engine.md`

### Documento que faltava — ✅ RESOLVIDO
- [x] ✅ **`anti-fraud-engine.md`** — recebido e salvo em `docs/19-anti-fraud-engine/anti-fraud-engine.md`. As notas de "dependência ausente" nos specs 09–18 foram atualizadas para "disponível (docs/19)".

---

## 2) ⚠️ Decisões pendentes antes de codar (conflitos e gaps encontrados)

Os agentes que escreveram os specs encontraram pontos onde a fonte da verdade **se contradiz** ou **não cobre** algo necessário. Nada foi alterado no schema oficial — só registrado aqui. **Cada item precisa do seu OK.**

### 2.1 Padronização (conflitos entre `03-arquitetura` e `04-banco-de-dados`)
> Recomendação geral: **`04-database-schema.md` é o canônico** (nomes em inglês). Confirmar:
- [ ] `messages.message` (schema) vs `messages.content` (arquitetura) → usar **`message`**.
- [ ] `credit_transactions.transaction_type` em inglês (purchase/bonus/refund/spend) vs `type` em português → usar **inglês**.
- [ ] `customer_profiles.reputation_score` (schema) vs `rating` (arquitetura) → usar **`reputation_score`**.
- [ ] `verification_requests`: `document_front_url`/`document_back_url`/`reviewer_id` (schema) vs `document_url`/`reviewed_by` (arquitetura) → usar **schema**.
- [ ] Enums de lead (status/tipo/urgência) em inglês (schema) vs português (arquitetura) → usar **inglês**.

### 2.2 Inconsistências de regra de negócio
- [ ] **Níveis de gamificação:** 6 níveis (lead-engine/arquitetura, até *Elite*/12000 XP) vs **8 níveis** (gamification, até *Lenda*/50000 XP) → recomendado **adotar os 8 níveis do doc 08**.
- [ ] **Push notifications:** arquitetura coloca push em V2, mas matching cita push no MVP → recomendado **MVP = in-app + email; push em V2**.
- [ ] **Teto de 20 notificações/dia:** aplicar só a canais interruptivos (push/sms/whatsapp); in-app e email transacional essencial não contam → confirmar.
- [ ] **Reembolso:** sempre em **créditos**, nunca em dinheiro (status `payment_orders.refunded` reservado a chargeback/jurídico) → confirmar.

### 2.3 Tabelas/campos que faltam no schema oficial (propostos pelos specs)
> São **extensões** ao `04-database-schema.md`. Viram migrations Alembic depois de aprovadas.

**Financeiro / créditos**
- [ ] `subscriptions` (Premium recorrente: mensal/trimestral/anual) — hoje só existe o booleano `professional_profiles.premium`. *(necessário p/ Premium, MRR, ARR)*
- [ ] `credit_wallets.frozen_balance` (saldo bloqueado por chargeback/investigação).
- [ ] `credit_transactions.transaction_type`: adicionar `adjustment`, `freeze`, `unfreeze`.

**Segurança**
- [ ] `refresh_tokens` (ou Redis) — rotação/revogação/detecção de reuso de token.
- [ ] `webhook_events` (ou Redis) — idempotência de webhooks de pagamento.
- [ ] `tenant_id` nas tabelas de domínio — **apenas se/quando** "multi-tenant" for ativado (hoje é só "ready").

**Permissões administrativas**
- [ ] `admin_roles` (ou enum estendido) — sub-papéis: `super_admin`, `moderator`, `finance`, `support` (hoje `role` só tem customer/professional/admin).

**Distribuição / busca / geo**
- [ ] `professional_profiles`: `service_radius_km`, `latitude`, `longitude` — raio de atuação é usado por matching/lead, mas não existe no schema.
- [ ] Índices full-text (GIN/trigram, extensões `pg_trgm`/`unaccent`) para a busca textual.
- [ ] `search_ranking_weights` — pesos de relevância configuráveis.

**Notificações**
- [ ] `notification_preferences`, `notification_templates`, `notification_deliveries`, `device_tokens` (push) + campos extras em `notifications` (`category`, `priority`, `event_key`, `data`, `deleted_at`).

**Chat**
- [ ] `message_attachments`, `conversation_blocks`, `message_moderations`; extensões em `conversations` (`UNIQUE(lead_id)`, `last_message_at`) e `messages` (`message_type`, `read_at`, `deleted_at`).

**Indicação**
- [ ] `referrals`, `referral_campaigns`; `referral_code` em users/profiles; valor `referral` em `xp_transactions.source`.

**Verificação / KYC**
- [ ] `verification_requests`: `document_type`, `kyc_level`, `rejection_reason`, `rejection_notes`, `expires_at` (retenção LGPD).

**Suporte**
- [ ] `tickets`, `ticket_messages`, `ticket_attachments`, `ticket_events`, `support_agents`, `kb_categories`, `kb_articles`.

**Moderação / denúncias**
- [ ] `reports`: `assigned_admin_id`, `resolution`, `resolved_at`.

**Métricas / contratação**
- [ ] Marcador de **comparecimento/contratação** (`lead_purchases.attended` ou tabela `service_completions`; opcional `leads.hired_at`) — exigido pela reputação (peso "comparecimento") e pelo analytics.
- [ ] Fonte de **gasto de marketing** (`marketing_spend`) — para calcular CAC.

**Antifraude** *(novos — exigidos pelo doc 19, anti-fraud-engine)*
- [ ] `users.fraud_score` (0–100) + faixas de risco (baixo/médio/alto/crítico).
- [ ] Sinais de dispositivo/rede: `device_fingerprint`, `device_id`, `browser_id`, `ip_address` (detectar múltiplas contas / auto-contratação / VPN-proxy).
- [ ] Níveis de bloqueio antifraude (1 alerta → 2 limitação → 3 suspensão → 4 bloqueio → 5 banimento) — mapear para `users.status` + flags.
- [ ] ⚠️ Conflito de nome: doc 19 usa `fraud_score`; doc 18 (future-ai) propôs `fraud_risk_score` — padronizar um único nome.

**IA (futuro — V3+)**
- [ ] Tabelas `ai_inferences`, `ai_models`, `ai_audit_logs`, `fraud_signals` etc. e campos de score — **não bloqueiam o MVP**.

---

## 3) Decisões técnicas de setup (antes da Fase 1)

- [ ] Confirmar **estrutura do repositório**: monorepo com `backend/` (FastAPI) + `frontend/` (Next.js) + `docs/` — recomendado.
- [ ] **Python não está instalado** nesta máquina (necessário para o backend). Instalar (sugestão: Python 3.12).
- [ ] **`gh` (GitHub CLI) não está instalado** — opcional; dá para usar Git puro.
- [ ] Escolher **um** gateway de pagamento para começar (Mercado Pago / Asaas / Pagar.me / Stripe).
- [ ] Definir ambiente de dev: Docker Compose (PostgreSQL + Redis + MinIO) — recomendado.
- [ ] Definir provedor de email/SMS/push para as notificações.

---

## 4) Fases de Implementação (uma por vez)

> Cada fase só é marcada como concluída quando entregar **código + migrations + testes + documentação + checklist de validação** e for validada.

- [x] **Fase 1 — Infraestrutura** — ✅ *validada em 2026-06-19: infra Docker healthy, `GET /api/v1/health` → 200, `alembic upgrade head` ok, pytest/ruff/build verdes (roda via `docker compose --profile full up`)*
  Setup monorepo, Docker (Postgres/Redis/MinIO), FastAPI base, Next.js base, Alembic, CI básico, padrões de projeto/segurança base.
- [x] **Fase 2 — Autenticação** — ✅ *register/login/refresh/logout/me + password-reset; JWT com rotação; RBAC. Smoke E2E ok.*
  Cadastro, login, recuperação de senha, JWT + refresh token, sessões, RBAC base.
- [x] **Fase 3 — Perfis** — ✅ *customer/professional + categorias (N:N) + wallet criada; CRUD admin de categorias.*
  Contratante, Profissional, Administrador; categorias; áreas de atuação.
- [x] **Fase 4 — Solicitações (Leads)** — ✅ *criar/listar/editar/cancelar + classificação de custo + matching de elegibilidade.*
  Criar / visualizar / editar / cancelar oportunidade; classificação de lead.
- [x] **Fase 5 — Sistema de Leads (créditos + matching + compra)** — ✅ *carteira, grant (admin), compra atômica (Lead Exclusivo, 409), débito + contato liberado, histórico.*
  Carteira, compra de lead, desbloqueio de contato, distribuição (matching), histórico.
- [x] **Fase 6 — Pagamentos** — ✅ *compra de créditos (5 pacotes) com provedor DEV/sandbox; webhook HMAC idempotente; crédito atômico só no `paid`; reembolso em créditos. Gateway real (PIX/cartão) = plugar adaptador Mercado Pago/Stripe com as chaves.*
  Pacotes de créditos, PIX, cartão, webhooks assinados, idempotência, reembolso em créditos.
- [ ] **Fase 7 — Avaliações + Reputação**
  Avaliação mútua (1–5 + comentário), reputation score, selos.
- [ ] **Fase 8 — Chat**
  Conversa por lead, abertura automática, anexos, moderação, denúncias.
- [ ] **Fase 9 — Gamificação**
  XP, níveis, medalhas, missões, ranking, recompensas (estrutura preparada).
- [ ] **Fase 10 — Administração**
  Painel admin completo, moderação, financeiro, métricas, auditoria.

> Módulos transversais (notificações, busca, verificação/KYC, indicação, suporte, segurança, analytics) entram **dentro das fases** em que fazem sentido — o detalhamento será feito no plano de cada fase.

---

## 5) Onde estamos agora / Próximos passos

- [x] Documentação 100% organizada em `docs/` (19 documentos + este checklist).
- [x] Conflitos e gaps mapeados (seção 2).
- [x] **Subir tudo para o GitHub** (commit + push) — feito (commit inicial + este).
- [x] `anti-fraud-engine.md` recebido e integrado (doc 19) — lacuna resolvida.
- [ ] Você revisar as **decisões pendentes** da seção 2 (principalmente 2.1 e 2.2).
- [ ] Resolver setup da seção 3 (Python, gateway, Docker).
- [x] **Fase 1 — Infraestrutura: scaffold criado** (backend FastAPI + frontend Next.js + infra Docker + CI) e verificado (compila/builda). Ver `docs/fases/fase-01-infraestrutura/`.
- [x] **Fase 1 validada localmente** (Docker): infra healthy + health 200 + alembic ok + pytest/ruff/build verdes. Detalhes em `docs/fases/fase-01-infraestrutura/checklist-validacao.md`.
- [ ] Depois: **Fase 2 — Autenticação** (resolver antes as decisões de schema da seção 2 que afetam auth/users).

---

### 📌 Legenda
- [x] feito · [ ] pendente · ⛔ bloqueador · 🟡 em andamento · ✅ concluído
