# notification-engine.md

# Notification Engine — Motor de Notificações e Comunicação

Projeto: TrampoJá

Versão: 1.0

Status: Documento Oficial

---

# 1. Objetivo

O Notification Engine é o módulo responsável por **entregar a comunicação certa, no canal certo, no momento certo**, conectando os eventos gerados pelos demais motores da plataforma (Lead Engine, Matching Engine, Payment Engine, Reputation Engine, Gamification Engine) aos usuários (contratantes, profissionais e administradores).

Este documento **complementa** e **não substitui**:

* `03-arquitetura/marketplace-architecture.md` — seção "Sistema de Notificações" (lista os eventos básicos: novo lead, lead comprado, mensagem recebida, avaliação recebida, conquista desbloqueada, créditos adicionados).
* `04-banco-de-dados/database-schema.md` — tabela oficial `NOTIFICATIONS` e `AUDIT_LOGS`.
* `06-matching-engine/matching-engine.md` — seção "Notificações" (canais Push, Email, Notificação interna) e seção "Frequência" (teto de 20 notificações por dia).
* `05-payment-engine/payment-engine.md` — fluxos que terminam em "Notificação enviada".
* `08-gamification-engine/gamification-engine.md` — conquistas desbloqueadas, marcos de XP, missões.

Os objetivos centrais do motor são:

* centralizar **toda** a comunicação transacional e de engajamento da plataforma em um único ponto de orquestração;
* suportar múltiplos canais: **in-app (interna)**, **email**, **push**, **sms** e **whatsapp (futuro)**;
* respeitar **preferências do usuário** (opt-in/opt-out por canal e por evento);
* respeitar **limites antiflood**, em especial o teto de **20 notificações por dia** definido no Matching Engine;
* garantir **entrega confiável** via filas assíncronas, política de **retry** com backoff e **dead-letter queue**;
* prover **auditoria** completa de envios e entregas;
* aumentar **conversão, retenção e engajamento**, sem gerar spam.

> O Notification Engine é um serviço de **suporte transversal**: ele nunca decide *o que* aconteceu (isso é dos motores de negócio), apenas decide *como, por onde e quando* comunicar.

---

# 2. Escopo

## 2.1 Dentro do escopo

* Orquestração de eventos de negócio em notificações.
* Catálogo de **eventos** que disparam notificação.
* Catálogo de **templates** por evento, com variáveis.
* Canais de entrega: **in-app**, **email**, **push**, **sms**, **whatsapp (V-futuro)**.
* Resolução de **canais elegíveis** por evento, combinando regras de negócio + preferências do usuário.
* **Limites e antiflood** (teto diário, agrupamento/digest, deduplicação, cooldown).
* **Preferências do usuário** por canal e por categoria de evento.
* **Filas assíncronas** em Redis e workers de processamento.
* **Retry**, backoff exponencial e **dead-letter**.
* **Auditoria** de envio e entrega (status por canal/provedor).
* Webhooks de **status de entrega** dos provedores externos (email/sms/push/whatsapp).

## 2.2 Fora do escopo

* Cálculo de score, ranking, reputação, XP — pertencem a Matching, Reputation e Gamification Engines.
* Processamento de pagamento e webhooks financeiros — pertencem ao Payment Engine (este motor apenas recebe o evento já processado e notifica).
* Chat em tempo real e persistência de mensagens — pertence ao Módulo de Chat (`messages`/`conversations`). O Notification Engine apenas notifica que **uma mensagem foi recebida**.
* Decisão de **antifraude** — pertence ao `anti-fraud-engine.md` (ver seção 10, dependência ainda ausente). O Notification Engine **consome** sinais de antifraude (ex.: não notificar contas suspeitas) mas não os calcula.

## 2.3 Posição na arquitetura

Seguindo a stack oficial (`03-arquitetura`):

```text
Motores de Negócio (Lead / Matching / Payment / Reputation / Gamification)
        ↓  (emitem evento de domínio)
Notification Service (FastAPI / Python)
        ↓  enfileira job
Redis (filas por canal)
        ↓  consome
Notification Workers (async)
        ↓  entrega via adapters
Provedores externos (Email / Push / SMS / WhatsApp)  +  In-App (PostgreSQL)
        ↓  webhook de status
Notification Service → Auditoria (audit_logs + delivery log)
```

* **Backend:** FastAPI, Python, Pydantic, SQLAlchemy, Alembic.
* **Banco:** PostgreSQL (persistência de `notifications`, preferências, templates, log de entrega).
* **Cache/Fila:** Redis (filas, deduplicação, contadores de rate limit, locks de idempotência).
* **Storage:** S3 Compatible (MinIO em dev, Cloudflare R2 em produção) para anexos/imagens de templates ricos, quando aplicável.
* **Segurança:** JWT, RBAC, Rate Limiting, Auditoria, Ownership Validation — herdados da arquitetura oficial.

---

# 3. Regras de Negócio

## 3.1 Princípios

1. **Notificação sempre nasce de um evento.** Nenhum canal é acionado sem um evento de domínio correspondente do catálogo (seção 3.4).
2. **In-app é o canal soberano.** Toda notificação relevante gera **sempre** um registro `notifications` (in-app), mesmo que canais externos estejam desligados pelo usuário. O registro in-app **não conta** para o teto diário de notificações *push/externas* (ver 3.6), pois é passivo (o usuário só vê ao abrir o app).
3. **Canais externos respeitam preferências.** Email, push, sms e whatsapp só são enviados se houver **opt-in efetivo** para aquele canal e aquele evento (seção 3.5).
4. **Backend é a fonte da verdade.** O usuário nunca dispara notificações arbitrárias; toda emissão passa pelo serviço, com validação de ownership e RBAC.
5. **Idempotência obrigatória.** Cada evento possui uma `event_key` única; reprocessamentos não geram notificações duplicadas (seção 3.7).
6. **Sem spam.** Limites antiflood, deduplicação e digest são obrigatórios (seção 3.6).
7. **Auditável e imutável.** Todo envio e toda mudança de status de entrega geram registro que **nunca é apagado nem editado** (alinhado às "Regras de Integridade" do schema oficial).

## 3.2 Classificação das notificações

| Classe | Descrição | Conta no teto diário? | Pode ser silenciada pelo usuário? |
| --- | --- | --- | --- |
| `transactional` | Confirma uma ação financeira/segurança do próprio usuário (pagamento aprovado, créditos adicionados, verificação aprovada/rejeitada, chargeback). | Não | Não para in-app/email essencial; push/sms sim |
| `operational` | Operação do marketplace que exige atenção (lead comprado, mensagem recebida, avaliação recebida). | Push: sim | Sim, por canal |
| `engagement` | Oportunidades e estímulos (novo lead disponível, conquista desbloqueada, missão, marco de XP, lembrete). | Push: sim | Sim, por canal e por evento |
| `system` | Comunicados administrativos e de segurança da plataforma. | Não | Não (in-app/email essencial) |

> Notificações `transactional` e `system` essenciais **não podem** ter o canal in-app/email totalmente desligado, por exigência de auditoria e segurança. O usuário pode desligar apenas push/sms nesses casos.

## 3.3 Prioridade de entrega

Cada notificação carrega uma prioridade que define a fila e a urgência:

| Prioridade | Exemplos | Comportamento |
| --- | --- | --- |
| `high` | Pagamento aprovado/falho, verificação aprovada/rejeitada, chargeback, novo lead urgente (`urgency = immediate`) | Fila prioritária; entrega imediata; ignora janela de digest |
| `normal` | Lead comprado, mensagem recebida, avaliação recebida, créditos adicionados | Fila padrão; respeita janelas e antiflood |
| `low` | Conquista desbloqueada, missão concluída, marco de XP, lembretes de engajamento | Elegível a agrupamento/digest; primeiro a ser cortado quando perto do teto |

## 3.4 Catálogo Consolidado de Eventos

Esta é a **fonte oficial consolidada** dos eventos que disparam notificação. Cada evento possui um `event_type` canônico (em `snake_case`, alinhado às convenções de enums do schema). Os canais marcados como **padrão** são o sugerido por defeito; o canal efetivo sempre depende das preferências do usuário (3.5) e das regras antiflood (3.6).

| event_type | Origem (motor) | Destinatário | Classe | Prioridade | Canais padrão |
| --- | --- | --- | --- | --- | --- |
| `new_lead_available` | Matching Engine | Profissional elegível | engagement | normal/high* | in-app, push, email |
| `lead_purchased` | Lead Engine | Profissional (comprador) | operational | normal | in-app, push |
| `lead_purchased_owner` | Lead Engine | Contratante (dono do lead) | operational | normal | in-app, push, email |
| `lead_expiring_soon` | Lead Engine | Profissional elegível | engagement | low | in-app, push |
| `lead_cancelled` | Lead Engine | Profissional que comprou | operational | normal | in-app, email |
| `message_received` | Chat | Destinatário da conversa | operational | normal | in-app, push |
| `review_received` | Reputation Engine | Avaliado (profissional/contratante) | operational | normal | in-app, push, email |
| `achievement_unlocked` | Gamification Engine | Usuário | engagement | low | in-app, push |
| `level_up` | Gamification Engine | Profissional | engagement | low | in-app, push |
| `xp_milestone_reward` | Gamification Engine | Profissional | engagement | low | in-app |
| `mission_completed` | Gamification Engine | Profissional | engagement | low | in-app |
| `credits_added` | Payment Engine | Profissional | transactional | normal | in-app, email |
| `credits_refunded` | Payment Engine | Profissional | transactional | normal | in-app, push, email |
| `credits_bonus_granted` | Gamification/Payment | Profissional | engagement | low | in-app, push |
| `payment_approved` | Payment Engine | Usuário | transactional | high | in-app, email, push |
| `payment_failed` | Payment Engine | Usuário | transactional | high | in-app, email |
| `subscription_activated` | Payment Engine | Profissional | transactional | high | in-app, email |
| `subscription_renewed` | Payment Engine | Profissional | transactional | normal | in-app, email |
| `subscription_payment_failed` | Payment Engine | Profissional | transactional | high | in-app, email, sms |
| `subscription_cancelled` | Payment Engine | Profissional | transactional | normal | in-app, email |
| `chargeback_received` | Payment Engine | Profissional + Admin | system | high | in-app, email |
| `verification_approved` | Payment/Admin | Usuário | transactional | high | in-app, push, email |
| `verification_rejected` | Payment/Admin | Usuário | transactional | high | in-app, email |
| `account_suspended` | Admin/Anti-Fraud | Usuário | system | high | in-app, email |
| `account_blocked` | Admin/Anti-Fraud | Usuário | system | high | in-app, email |
| `report_resolved` | Admin/Reputation | Denunciante | system | normal | in-app |
| `password_reset_requested` | Auth | Usuário | system | high | email |
| `welcome_onboarding` | Auth/Users | Novo usuário | engagement | normal | in-app, email |
| `daily_digest` | Notification Engine | Usuário (agrupamento) | engagement | low | email, push |

\* `new_lead_available` é `high` quando o lead possui `urgency = immediate` (enum oficial de `leads.urgency`); caso contrário `normal`.

> Observação de consistência: os seis eventos listados em `03-arquitetura` (novo lead, lead comprado, mensagem recebida, avaliação recebida, conquista desbloqueada, créditos adicionados) estão **todos** contemplados acima e são tratados como o **núcleo MVP**. Os demais eventos expandem o catálogo conforme os motores Payment, Reputation, Gamification e Admin já documentados.

## 3.5 Preferências do Usuário (opt-in / opt-out)

Cada usuário possui um conjunto de preferências granulares:

* **Por canal:** in-app, email, push, sms, whatsapp (futuro). Cada canal pode estar `enabled` ou `disabled`.
* **Por evento × canal:** o usuário pode, por exemplo, manter `new_lead_available` por push mas desligar por email.
* **Por categoria de classe:** atalho para silenciar toda a classe `engagement` em push.

Regras:

1. **Defaults sensatos:** ao criar a conta, aplicam-se os "Canais padrão" da seção 3.4 com opt-in.
2. **Eventos essenciais:** classes `transactional` e `system` **não permitem** opt-out total de in-app/email essencial (ver 3.2). A UI deve esconder/travar esses toggles.
3. **Resolução de canal efetivo:**
   ```text
   canal_efetivo = canais_padrão(evento)
                   ∩ canais_habilitados(usuário)
                   − canais_silenciados(evento, usuário)
                   − canais_indisponíveis(plataforma)  // ex.: whatsapp não habilitado ainda
   ```
4. **Quiet hours (silêncio noturno):** o usuário pode definir uma janela (ex.: 22h–7h) em que **push/sms** não são entregues; notificações dessa janela são **adiadas** para o início do período ativo OU agrupadas no `daily_digest`. Notificações `high`/`transactional` ignoram quiet hours.
5. **Verificação de canal:** push exige `device_token` válido; sms/whatsapp exigem `phone` validado (campo `users.phone`, com `UNIQUE` no schema). Se o pré-requisito do canal não estiver satisfeito, o canal é descartado silenciosamente e registrado como `skipped` na auditoria.

## 3.6 Limites e Antiflood

Alinhado à seção "Frequência" do Matching Engine (**máximo 20 notificações por dia**):

1. **Teto diário (push/externos):** no máximo **20 notificações push** por usuário por dia (janela de 24h). O contador é mantido em Redis (`notif:ratelimit:{user_id}:{YYYYMMDD}`).
2. **Escopo do teto:** o teto se aplica a notificações **push** e demais canais "ativos/interruptivos" (sms, whatsapp). **In-app não conta** (passivo). **Email transacional essencial** (`payment_*`, `verification_*`, `chargeback_*`, `subscription_payment_failed`, `password_reset_requested`) **não conta** e nunca é bloqueado pelo teto.
3. **Ordem de corte:** ao se aproximar do teto, cortam-se primeiro as notificações `low` (engagement), depois `normal`; `high`/`transactional` nunca são cortadas.
4. **Agrupamento / Digest:** quando há excesso de eventos `engagement` (ex.: muitos `new_lead_available` no mesmo período), o motor agrupa em um único `daily_digest` ("Você tem N novos leads disponíveis na sua região"). O digest conta como **1** notificação para o teto.
5. **Deduplicação:** dois eventos idênticos para o mesmo usuário dentro de uma janela curta (ex.: `message_received` em rajada na mesma conversa) são **coalescidos** em uma notificação ("Você tem N novas mensagens de Fulano").
6. **Cooldown por evento:** cada `event_type` pode ter um intervalo mínimo entre envios push do mesmo tipo (ex.: `new_lead_available` push a cada 10 min no máximo; novos leads no intervalo entram no digest).
7. **Throttling por canal/provedor:** respeitar limites de taxa do provedor externo (rate limit de saída), com fila dedicada por canal.

> Quando uma notificação é suprimida por teto/cooldown, o evento **não se perde**: ele é registrado como `in-app` e, conforme configuração, agregado ao próximo digest. A supressão é auditada com `status = throttled`.

## 3.7 Idempotência

* Cada evento de domínio carrega uma `event_key` única (ex.: `payment_approved:{payment_order_id}`, `lead_purchased:{lead_purchase_id}`, `achievement_unlocked:{user_achievement_id}`).
* Antes de enfileirar, o serviço grava um lock idempotente em Redis (`SET event_key NX EX`). Reprocessamentos com a mesma `event_key` são ignorados.
* Webhooks de status de provedores também são idempotentes por `provider_message_id`.

## 3.8 Exclusões de envio

Alinhado à seção "Exclusões" do Matching Engine. **Não enviar** notificações de **engajamento/operacionais externas** para contas:

* `blocked`
* `suspended`
* inadimplentes (chargeback em aberto)
* contas marcadas como suspeitas pelo Anti-Fraud Engine (dependência — seção 10)

Exceção: notificações `system`/`security` (ex.: `account_suspended`, `account_blocked`, `password_reset_requested`) **podem e devem** ser enviadas a essas contas pelos canais essenciais.

---

# 4. Fluxos

## 4.1 Fluxo geral de notificação

```text
Motor de negócio conclui ação
        ↓
Emite evento de domínio (event_type, event_key, payload, recipient)
        ↓
Notification Service recebe
        ↓
Idempotência (event_key) → já processado? → descarta
        ↓
Resolve destinatário + carrega preferências
        ↓
Resolve canais efetivos (3.5)
        ↓
Aplica antiflood / cooldown / dedupe (3.6)
        ↓
Persiste registro in-app (notifications)
        ↓
Renderiza template por canal (variáveis)
        ↓
Enfileira jobs por canal no Redis
        ↓
Workers consomem e entregam via adapters
        ↓
Registra delivery log (sent/failed)
        ↓
Webhook do provedor → atualiza status (delivered/opened/bounced)
        ↓
Auditoria
```

## 4.2 Fluxo: novo lead disponível (Matching → Profissional)

```text
Matching Engine seleciona Top 20 profissionais elegíveis
        ↓
Para cada profissional: emite new_lead_available (event_key = new_lead:{lead_id}:{professional_id})
        ↓
Notification Service verifica exclusões (suspenso/bloqueado/sem crédito? — alinhado ao matching)
        ↓
Verifica cooldown e teto diário do profissional
        ↓
Dentro do teto → push + in-app + email (conforme preferências)
Acima do teto/cooldown → agrega ao daily_digest, mantém in-app
        ↓
Template "Novo Lead Disponível — {categoria} — {distancia} — {urgencia}"
        ↓
Entrega + auditoria
```

## 4.3 Fluxo: pagamento aprovado e créditos adicionados (Payment → Profissional)

Encaixa-se no "Fluxo de Compra de Créditos" do Payment Engine, no passo final "Notificação enviada":

```text
Payment Engine: webhook do gateway confirma pagamento (idempotente)
        ↓
Saldo atualizado (credit_wallets) + histórico (credit_transactions: type = purchase)
        ↓
Emite payment_approved (event_key = payment_approved:{payment_order_id})
Emite credits_added (event_key = credits_added:{credit_transaction_id})
        ↓
Notification Service: transactional, high → ignora teto e quiet hours
        ↓
in-app + email (recibo) + push
        ↓
Auditoria financeira cruzada (Payment) + delivery log (Notification)
```

## 4.4 Fluxo: conquista desbloqueada (Gamification → Profissional)

```text
Gamification Engine valida conquista no backend (anti-abuso)
        ↓
Grava user_achievements + xp_transactions
        ↓
Emite achievement_unlocked (event_key = achievement_unlocked:{user_achievement_id})
        ↓
Notification Service: engagement, low → elegível a digest
        ↓
in-app sempre + push se dentro do teto
        ↓
Template "Conquista desbloqueada: {achievement_name} (+{xp_reward} XP)"
```

## 4.5 Fluxo: verificação aprovada/rejeitada (Admin/Payment → Usuário)

```text
Admin analisa verification_requests → aprova/rejeita (reviewer_id, reviewed_at)
        ↓
status = approved → emite verification_approved
status = rejected → emite verification_rejected (com motivo)
        ↓
Notification Service: transactional, high
        ↓
in-app + email (+ push se aprovado)
        ↓
Auditoria (admin_actions registra a decisão; notification registra a comunicação)
```

## 4.6 Fluxo: digest diário (agrupamento)

```text
Scheduler (worker periódico) dispara por usuário no horário ativo / fim de quiet hours
        ↓
Coleta notificações low pendentes/agrupadas do período
        ↓
Há itens? Não → não envia
        ↓
Renderiza daily_digest ("N novos leads, M conquistas, ...")
        ↓
Envia por email/push (conta como 1 no teto)
        ↓
Marca itens agregados como entregues via digest
```

## 4.7 Fluxo de entrega assíncrona (worker + retry)

```text
Worker consome job da fila do canal
        ↓
Chama adapter do provedor
        ↓
Sucesso? Sim → delivery log = sent → aguarda webhook (delivered/bounced)
        ↓
Não (erro transitório) → reagenda com backoff exponencial (3.x: ver retry)
        ↓
Esgotou tentativas → move para Dead-Letter Queue + delivery log = failed + auditoria
```

---

# 5. Casos Especiais

1. **Usuário sem nenhum canal externo habilitado:** entrega apenas in-app; nunca falha. O sistema não "força" canais.
2. **Push sem device_token / sms sem phone validado:** canal descartado como `skipped`; tenta próximo canal elegível; sempre mantém in-app.
3. **WhatsApp (futuro):** o `event_type` e o template podem já existir, mas o canal está `unavailable` na plataforma até liberação. Roteamento o remove silenciosamente (ver seção 9 — Roadmap).
4. **Rajada de mensagens na mesma conversa:** coalescência em "N novas mensagens" (dedupe, 3.6).
5. **Excesso de novos leads na região:** agrupamento em `daily_digest`; in-app preserva cada lead individualmente para a tela de oportunidades.
6. **Quiet hours x notificação high:** `payment_failed`, `verification_*`, `account_*`, `chargeback_received` ignoram quiet hours e teto.
7. **Conta suspensa/bloqueada/suspeita:** apenas notificações `system`/`security` essenciais são entregues (3.8).
8. **Reembolso de créditos (lead inválido):** `credits_refunded` informa o profissional que os créditos retornaram à carteira (consistente com a política de reembolso do Payment/Lead Engine: devolve créditos, não dinheiro).
9. **Chargeback:** notifica o profissional (`chargeback_received`) e o Admin; alinhado às consequências do Payment Engine (bloqueio de créditos, suspensão, análise).
10. **Falha definitiva de entrega externa:** após esgotar retries, vai para Dead-Letter; o usuário ainda tem o registro in-app, garantindo que a informação não se perca.
11. **Reset de temporada (Gamification, 90 dias):** se gerar comunicado, é `system`/`engagement` low e elegível a digest, jamais individual por push para cada usuário.
12. **Multi-dispositivo:** push é enviado a todos os `device_tokens` ativos do usuário; tokens inválidos retornados pelo provedor são marcados como expirados e removidos.

---

# 6. Segurança

Herdando a "Segurança Obrigatória" da arquitetura oficial (JWT, RBAC, Rate Limiting, Auditoria, Ownership Validation, IDOR, Mass Assignment, Logs de Segurança):

1. **Autenticação/Autorização:** endpoints de notificação exigem **JWT**; leitura/escrita de notificações e preferências respeitam **ownership** — um usuário só acessa as **suas** notificações (`notifications.user_id == sub do JWT`). Proteção contra **IDOR**.
2. **RBAC:**
   * Usuário comum: ler/marcar como lida suas notificações; editar suas preferências.
   * Admin: disparar comunicados `system`, consultar logs de entrega, reenviar notificações falhas. Toda ação admin gera `admin_actions`.
   * Nenhum usuário (não-admin) pode **disparar** notificações para terceiros (apenas os motores de negócio, internamente, emitem eventos).
3. **Emissão interna confiável:** a emissão de eventos é **server-side** (entre serviços do backend). Não há endpoint público que permita injetar notificações arbitrárias.
4. **Validação de payload (Pydantic):** todo evento e template é validado por schema; **mass assignment** bloqueado (apenas campos permitidos do template são preenchidos).
5. **Anti-IDOR em links:** deep links em notificações (ex.: abrir um lead, uma conversa) carregam apenas IDs; a autorização é reavaliada no acesso, nunca confiando no link.
6. **Webhooks de provedores assinados:** webhooks de status de entrega (email/sms/push/whatsapp) devem ser **verificados por assinatura** (HMAC/secret), de forma análoga à exigência de "Webhooks assinados" do Payment Engine. Idempotência por `provider_message_id`.
7. **Rate limiting:** endpoints de preferências e de marcação de leitura possuem **rate limit**; a emissão respeita os limites antiflood (seção 3.6) que também atuam como defesa contra abuso/bombing.
8. **Privacidade de conteúdo (PII):** templates não devem expor dados sensíveis em canais inseguros. Conteúdo de SMS/push é minimizado (ex.: "Você tem uma nova mensagem", sem o conteúdo da mensagem). Telefone/email não são expostos a terceiros via notificação.
9. **Proteção de tokens:** `device_token` e segredos de provedor são tratados como credenciais (criptografia em repouso quando aplicável; nunca logados em texto claro).
10. **Soft Delete:** notificações não são removidas fisicamente quando arquivadas; seguem a política de Soft Delete da plataforma (ver proposta de campo `deleted_at` na seção 8).
11. **Logs de segurança:** tentativas de acesso negado, falhas de assinatura de webhook e bloqueios por rate limit são registrados em `audit_logs`/logs de segurança.

---

# 7. Auditoria

Alinhado às "Regras de Integridade" do schema (**nunca apagar, nunca editar** registros de auditoria) e à seção "Auditoria" do Payment Engine.

## 7.1 O que é auditado

* **Emissão:** evento recebido, `event_type`, `event_key`, destinatário, canais resolvidos, decisão antiflood (enviado / agrupado / suprimido).
* **Envio por canal:** cada tentativa por canal/provedor, com timestamp, resultado e `provider_message_id`.
* **Entrega:** atualizações via webhook (delivered, opened, bounced, failed).
* **Leitura:** marcação `read_at` da notificação in-app.
* **Ações administrativas:** comunicados `system`, reenvios manuais, mudança de templates → `admin_actions`.

## 7.2 Onde é auditado

* **Trilha geral:** tabela oficial `AUDIT_LOGS` (`user_id`, `action`, `entity`, `entity_id`, `ip_address`, `user_agent`, `created_at`) — para ações expostas a usuário/admin.
* **Trilha técnica de entrega:** nova tabela **`notification_deliveries`** (proposta complementar, seção 8) — registro por canal/provedor com status detalhado, contadores de retry e motivo de falha. Imutável (apenas append/atualização de status; nunca delete).

## 7.3 Conteúdo mínimo do registro de entrega

Inspirado na "Auditoria" do Payment Engine (Usuário, Valor, Data, IP, Origem, Resultado):

* Usuário destinatário
* `event_type` / `event_key` (origem)
* Canal e provedor
* Template e versão usados
* Data/hora de cada transição (queued → sent → delivered/failed)
* Resultado e motivo (erro do provedor, throttled, skipped, bounced)
* Número de tentativas (retry)

---

# 8. Modelo de Dados (proposta complementar)

> **Importante:** Não reescrevemos o schema oficial. A tabela `NOTIFICATIONS` de `04-banco-de-dados/database-schema.md` é **mantida como está** e referenciada abaixo. Os itens marcados como *proposta complementar* devem ser **aprovados** antes de virar migration, conforme a regra "Nenhuma tabela deve ser criada fora desta especificação sem aprovação".

## 8.1 Tabela existente (referência — NÃO recriar)

`NOTIFICATIONS` (oficial):

```text
id
user_id
type
title
message
read_at
created_at
```

O Notification Engine **usa** esta tabela como o canal **in-app**. O campo `type` deve receber o `event_type` do catálogo (seção 3.4).

## 8.2 Campos adicionais sugeridos em `notifications` (proposta complementar)

Para suportar prioridade, deep-link, agrupamento e soft delete sem quebrar o schema atual:

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `category` | enum (`transactional`,`operational`,`engagement`,`system`) | Classe da notificação (3.2) |
| `priority` | enum (`high`,`normal`,`low`) | Prioridade (3.3) |
| `event_key` | string (UNIQUE por usuário) | Idempotência (3.7) |
| `data` | jsonb | Payload de variáveis e IDs para deep-link |
| `group_key` | string (nullable) | Agrupamento/dedupe (3.6) |
| `deleted_at` | timestamp (nullable) | Soft Delete (alinhado à convenção do schema) |
| `updated_at` | timestamp | Convenção oficial de datas |

## 8.3 Tabela `notification_preferences` (proposta complementar)

Preferências por canal e por evento (seção 3.5):

```text
id (UUID)
user_id            → users.id
channel            enum: in_app | email | push | sms | whatsapp
event_type         string (nullable = aplica a todos os eventos do canal)
enabled            boolean
quiet_hours_start  time (nullable)
quiet_hours_end    time (nullable)
created_at
updated_at
```

Constraints sugeridas: `UNIQUE(user_id, channel, event_type)`.

## 8.4 Tabela `notification_templates` (proposta complementar)

Catálogo versionado de templates (seção, ver capítulo de Templates abaixo):

```text
id (UUID)
event_type     string
channel        enum: in_app | email | push | sms | whatsapp
locale         string (default pt-BR)
version        int
subject        string (nullable; usado em email)
body           text (com placeholders {{variavel}})
active         boolean
created_at
updated_at
```

Constraints sugeridas: `UNIQUE(event_type, channel, locale, version)`.

## 8.5 Tabela `notification_deliveries` (proposta complementar)

Trilha técnica de entrega por canal (seção 7):

```text
id (UUID)
notification_id        → notifications.id
user_id                → users.id
channel                enum: in_app | email | push | sms | whatsapp
provider               string (ex.: provedor de email/sms/push)
provider_message_id    string (nullable)
status                 enum: queued | sent | delivered | failed | bounced | skipped | throttled
attempts               int (default 0)
error_reason           string (nullable)
queued_at
sent_at                (nullable)
delivered_at           (nullable)
failed_at              (nullable)
created_at
```

Índices sugeridos: `notification_id`, `user_id`, `status`, `provider_message_id`.
Regra de integridade: **append-only** + atualização de status; **nunca deletar**.

## 8.6 Tabela `device_tokens` (proposta complementar — habilita push, V2)

```text
id (UUID)
user_id        → users.id
token          string
platform       enum: web | android | ios
active         boolean
last_seen_at
created_at
updated_at
```

Constraints sugeridas: `UNIQUE(token)`; tokens inválidos retornados pelo provedor são marcados `active = false`.

---

# Templates (Catálogo por Evento)

Os templates são **versionados** (tabela 8.4), **multicanal** e usam placeholders `{{variavel}}` resolvidos a partir do `data`/payload do evento. Idioma padrão: **pt-BR**.

## Convenções de variáveis comuns

* `{{user_name}}` — nome do destinatário (`users.name`)
* `{{category_name}}` — categoria do lead (`categories.name`)
* `{{city}}` / `{{neighborhood}}` — localização (`leads.city`, `leads.neighborhood`)
* `{{distance_km}}` — distância calculada pelo Matching
* `{{urgency}}` — urgência do lead (`leads.urgency`: immediate/today/this_week/flexible)
* `{{credits_amount}}` / `{{wallet_balance}}` — créditos (`credit_transactions.amount`, `credit_wallets.balance`)
* `{{amount}}` — valor financeiro (`payment_orders.amount`)
* `{{achievement_name}}` / `{{xp_reward}}` — gamificação
* `{{score}}` / `{{stars}}` — avaliação (`reviews.score`)
* `{{sender_name}}` — autor da mensagem/avaliação
* `{{deep_link}}` — destino seguro in-app

## Exemplos de templates (catálogo inicial)

| event_type | Canal | Subject / Title | Body (resumo com variáveis) |
| --- | --- | --- | --- |
| `new_lead_available` | push/in-app | Novo Lead Disponível | "{{category_name}} • {{distance_km}} km • {{urgency}}. Toque para ver." |
| `new_lead_available` | email | Nova oportunidade em {{city}} | "Olá {{user_name}}, há um novo lead de {{category_name}} a {{distance_km}} km. Use seus créditos para desbloquear." |
| `lead_purchased` | in-app/push | Lead desbloqueado | "Você desbloqueou o lead de {{category_name}}. Contato liberado. (−{{credits_amount}} créditos)" |
| `lead_purchased_owner` | in-app/push | Profissional interessado | "Um profissional desbloqueou sua solicitação de {{category_name}}." |
| `message_received` | in-app/push | Nova mensagem | "{{sender_name}}: você recebeu uma nova mensagem." |
| `review_received` | in-app/email | Você recebeu uma avaliação | "{{sender_name}} avaliou você com {{stars}}." |
| `achievement_unlocked` | in-app/push | Conquista desbloqueada | "Parabéns! Você desbloqueou \"{{achievement_name}}\" (+{{xp_reward}} XP)." |
| `level_up` | in-app/push | Você subiu de nível | "Você alcançou o nível {{level_name}}!" |
| `credits_added` | in-app/email | Créditos adicionados | "{{credits_amount}} créditos foram adicionados. Saldo: {{wallet_balance}}." |
| `credits_refunded` | in-app/email | Créditos reembolsados | "{{credits_amount}} créditos retornaram à sua carteira referente ao lead {{category_name}}." |
| `payment_approved` | in-app/email | Pagamento aprovado | "Seu pagamento de R$ {{amount}} foi aprovado." |
| `payment_failed` | in-app/email | Pagamento não aprovado | "Não conseguimos processar seu pagamento de R$ {{amount}}. Tente novamente." |
| `subscription_activated` | in-app/email | Premium ativado | "Sua assinatura Premium está ativa." |
| `verification_approved` | in-app/email | Selo verificado liberado | "Sua verificação foi aprovada. Selo de Perfil Verificado liberado." |
| `verification_rejected` | in-app/email | Verificação não aprovada | "Sua verificação foi rejeitada. Motivo: {{reason}}." |
| `daily_digest` | email/push | Seu resumo do dia | "Você tem {{leads_count}} novos leads e {{events_count}} novidades." |

> Regras de template: SMS/WhatsApp usam variantes curtas (limite de caracteres) e **sem PII sensível**. Email pode usar HTML rico (com assets do S3). In-app prioriza `title` + `message` curtos com `deep_link`.

---

# Filas, Retry e Dead-Letter (detalhe técnico)

## Filas (Redis)

* Uma fila por **canal** (`q:notif:push`, `q:notif:email`, `q:notif:sms`, `q:notif:whatsapp`) e uma fila de **alta prioridade** (`q:notif:high`).
* Processamento **assíncrono** por workers FastAPI/Python (ex.: workers dedicados consumindo do Redis).
* Estruturas auxiliares em Redis: contadores de rate limit, locks de idempotência, chaves de dedupe (`group_key`), agendamento de digest/quiet-hours (sorted set por timestamp).

## Retry

* **Erros transitórios** (timeout, 5xx do provedor, rate limit do provedor) → reentrega.
* **Backoff exponencial** com jitter. Política sugerida: tentativas em `~30s, 2min, 10min, 1h, 6h` (até **5 tentativas**), configurável por canal.
* **Erros permanentes** (token inválido, email inexistente/bounce definitivo, número inválido) → **não** retentar; marcar `failed`/`bounced`, invalidar token quando aplicável.

## Dead-Letter Queue (DLQ)

* Esgotadas as tentativas, o job vai para `q:notif:dlq` com o motivo da falha.
* Itens da DLQ ficam disponíveis para **inspeção e reprocessamento manual** pelo Admin (com auditoria via `admin_actions`).
* O registro in-app **permanece**, garantindo que a informação nunca se perca para o usuário.

---

# 9. Métricas

Métricas do Notification Engine (complementam as métricas dos demais motores; não as duplicam):

* **Volume:** notificações emitidas por dia, por `event_type`, por canal.
* **Entregabilidade:** taxa de entrega (delivered/sent) por canal e por provedor.
* **Engajamento:** taxa de abertura (open rate) e de clique (CTR) por evento/canal.
* **Bounce/Failure:** taxa de bounce (email), tokens inválidos (push), falhas (sms/whatsapp).
* **Antiflood:** % de notificações suprimidas por teto, % agrupadas em digest, eventos coalescidos por dedupe.
* **Latência:** tempo entre emissão do evento e entrega efetiva (por prioridade).
* **Retry/DLQ:** média de tentativas por entrega, volume na DLQ, tempo de drenagem.
* **Opt-out:** taxa de opt-out por canal/evento (sinal de fadiga de notificação).
* **Impacto de negócio (cruzado):** correlação entre `new_lead_available` (push) e taxa de compra de lead (métrica do Matching), e entre notificações de engajamento e retenção (métrica de Gamification).

Painel Admin sugerido: volume por canal, entregabilidade, top eventos, taxa de supressão, fila/DLQ em tempo real.

---

# 10. Roadmap

| Versão | Entregas |
| --- | --- |
| **V1 (MVP)** | Canais **in-app** e **email**. Catálogo de eventos núcleo (novo lead, lead comprado, mensagem recebida, avaliação recebida, conquista desbloqueada, créditos adicionados, pagamento aprovado/falho, verificação aprovada/rejeitada). Filas Redis, retry, DLQ, auditoria, preferências básicas, teto de 20/dia. |
| **V2** | **Push Notifications** (alinhado ao Roadmap da arquitetura: "Push Notifications" em V2) — tabela `device_tokens`, web push e base para Android/iOS. Digest diário. Quiet hours. |
| **V3** | **SMS** para eventos críticos (falha de assinatura, segurança). Notificações inteligentes / priorização adaptativa (alinhado a "Machine Learning" do Matching V3). |
| **V4** | **WhatsApp** (canal `whatsapp` sai de `unavailable`). Notificações ricas e interativas. |
| **V5** | Otimização de horário/canais por IA, personalização de frequência por usuário, A/B testing de templates. |

> Consistência com a arquitetura: o item "Push Notifications" já consta no **Roadmap V2** de `03-arquitetura/marketplace-architecture.md`. Este motor o detalha sem antecipar implementação fora de fase.

---

# 11. Conflitos e Observações

1. **Tabela `notifications` enxuta vs. necessidades do motor.**
   O schema oficial define `notifications` com apenas `id, user_id, type, title, message, read_at, created_at`. Para suportar prioridade, idempotência, agrupamento, deep-link e soft delete, **propõe-se** adicionar campos (seção 8.2) e novas tabelas (8.3–8.6). **Nada foi recriado**; tudo está marcado como *proposta complementar* e depende de aprovação (regra do schema). **Resolução sugerida:** aprovar `event_key`, `data (jsonb)`, `category`, `priority`, `group_key`, `deleted_at`, `updated_at` em `notifications`.

2. **Canais em V1 vs. canais citados no Matching.**
   O Matching Engine cita **Push, Email, Notificação interna** na seção "Notificações", mas o Roadmap da arquitetura coloca **Push apenas em V2**. **Conflito de fase.** **Resolução adotada:** V1 entrega **in-app + email**; **push entra em V2** (consistente com o Roadmap oficial). O exemplo de notificação do Matching ("Novo Lead Disponível / Eletricista / 3 km / Hoje") é honrado pelo template `new_lead_available` (que estará disponível em push a partir da V2 e já em in-app/email na V1).

3. **Teto de 20 notificações/dia — escopo não definido na fonte.**
   O Matching diz "Máximo: 20 notificações por dia", sem especificar se inclui in-app e email transacional. **Decisão documentada (3.6):** o teto se aplica a canais **interruptivos** (push/sms/whatsapp); **in-app não conta** e **email transacional essencial não é bloqueado**. Recomenda-se ratificação.

4. **WhatsApp marcado como futuro em todos os documentos.**
   `01-projeto/master-task.md` afirma "Sem WhatsApp inicialmente". Mantido como canal `unavailable` até V4 (seção 10). Sem conflito — apenas registrado.

5. **Dependência: `anti-fraud-engine.md` ausente.**
   As "Exclusões" (3.8) e o sinal de "contas suspeitas" dependem do Anti-Fraud Engine ainda não documentado. **Tratado como dependência**, não duplicado. Enquanto não existir, usar como proxy o `users.status` (`suspended`/`blocked`) e o estado de chargeback do Payment Engine.

6. **Eventos não cobertos explicitamente pela fonte.**
   Eventos como `subscription_*`, `chargeback_received`, `password_reset_requested`, `welcome_onboarding`, `lead_expiring_soon`, `daily_digest`, `level_up`, `mission_completed`, `xp_milestone_reward` **derivam** logicamente de fluxos já descritos em Payment, Auth, Lead e Gamification Engines, mas não estão listados na seção "Sistema de Notificações" da arquitetura. **Observação:** são propostas de complemento coerentes com os motores existentes; o **núcleo MVP** permanece restrito aos seis eventos da arquitetura + pagamento/verificação do Payment Engine.

7. **Provedor de email/sms/push não definido.**
   O Payment Engine sugere gateways de pagamento, mas nenhum provedor de comunicação (email/sms/push) é citado nas fontes. **Em aberto:** definir provedor(es) na fase de implementação (a arquitetura adapter-based desta especificação permite trocar provedor sem mudar o motor).

8. **`device_tokens` é pré-requisito de push.**
   Como o schema não possui armazenamento de tokens de dispositivo, push **não é viável** sem a tabela proposta (8.6). Reforça a vinculação de push à V2.

---

# Definição de Sucesso

O Notification Engine será bem-sucedido quando:

* o profissional **descobrir oportunidades relevantes rapidamente** sem se sentir bombardeado;
* o contratante **acompanhar suas solicitações** com clareza;
* **nenhuma informação crítica se perder** (in-app + retry + DLQ);
* o teto de **20 notificações/dia** for respeitado, com digest e dedupe evitando spam;
* cada envio for **auditável, idempotente e seguro**;
* o motor permanecer **agnóstico de provedor** e **pronto para escalar** para push, sms e whatsapp sem reescrever a orquestração.

Toda comunicação da plataforma TrampoJá deve passar pelo Notification Engine.
