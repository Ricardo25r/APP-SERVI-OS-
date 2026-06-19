# ✅ Checklist de Execução — TrampoJá

> **Este é o nosso mapa.** Serve para nós dois (cliente + Claude) não nos perdermos.
> Atualize os checkboxes conforme avançamos.
>
> - Projeto: **TrampoJá** — Marketplace Inteligente de Prestadores de Serviços Locais
> - Repositório: https://github.com/Ricardo25r/APP-SERVI-OS-
> - Pasta local: `C:\TrampoJa`
> - Última atualização: **2026-06-18**
> - Fase atual: **📄 Documentação concluída — aguardando decisões antes de codar**

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

### Pendência de documento
- [ ] ⛔ **`anti-fraud-engine.md`** — citado como fonte da verdade em vários documentos, mas **nunca foi enviado**. Decidir:
  - [ ] (a) Você envia o documento original, **ou**
  - [ ] (b) Eu gero um `anti-fraud-engine.md` completo a partir das regras antifraude já espalhadas (lead/reputation/payment/referral/security).

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

- [ ] **Fase 1 — Infraestrutura**
  Setup monorepo, Docker (Postgres/Redis/MinIO), FastAPI base, Next.js base, Alembic, CI básico, padrões de projeto/segurança base.
- [ ] **Fase 2 — Autenticação**
  Cadastro, login, recuperação de senha, JWT + refresh token, sessões, RBAC base.
- [ ] **Fase 3 — Perfis**
  Contratante, Profissional, Administrador; categorias; áreas de atuação.
- [ ] **Fase 4 — Solicitações (Leads)**
  Criar / visualizar / editar / cancelar oportunidade; classificação de lead.
- [ ] **Fase 5 — Sistema de Leads (créditos + matching + compra)**
  Carteira, compra de lead, desbloqueio de contato, distribuição (matching), histórico.
- [ ] **Fase 6 — Pagamentos**
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

- [x] Documentação 100% organizada em `docs/` (18 documentos + este checklist).
- [x] Conflitos e gaps mapeados (seção 2).
- [ ] **Subir tudo para o GitHub** (commit + push).
- [ ] Você decidir sobre o `anti-fraud-engine.md` ausente (seção 1).
- [ ] Você revisar as **decisões pendentes** da seção 2 (principalmente 2.1 e 2.2).
- [ ] Resolver setup da seção 3 (Python, gateway, Docker).
- [ ] **Então** começamos a **Fase 1 — Infraestrutura** (eu monto o plano técnico detalhado da fase antes de codar).

---

### 📌 Legenda
- [x] feito · [ ] pendente · ⛔ bloqueador · 🟡 em andamento · ✅ concluído
