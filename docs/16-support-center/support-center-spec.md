# support-center-spec.md

# Support Center — Central de Ajuda e Atendimento

Projeto: TrampoJá

Versão: 1.0

Status: Documento Oficial

---

> Documento **complementar** à fonte da verdade (`docs/01`..`docs/08`).
> Este módulo **não substitui nem duplica** a moderação de denúncias (`reports`, descrita em `04-banco-de-dados` e `07-reputation-engine`). Denúncias são **moderação de conteúdo/conduta**; o Support Center é **atendimento ao usuário**. A relação entre os dois está detalhada na seção 3.6 e na seção 5.
> Toda referência a tabelas, status e papéis preserva integralmente o schema oficial (`04-banco-de-dados/database-schema.md`).

---

## 1. Objetivo

O **Support Center** é o módulo responsável por **atender, organizar e resolver as solicitações de ajuda dos usuários** da plataforma TrampoJá (contratantes, profissionais e parceiros internos), além de **reduzir o volume de atendimento humano** por meio de autoatendimento (central de ajuda e base de conhecimento).

Objetivos específicos:

* Oferecer um **ponto único de contato** para dúvidas, problemas e pedidos dos usuários.
* Estruturar o atendimento em **tickets** rastreáveis, auditáveis e mensuráveis.
* Garantir **SLA** (tempo de primeira resposta e tempo de resolução) por prioridade.
* Disponibilizar uma **base de conhecimento** (artigos/FAQ) para autoatendimento.
* **Encaminhar corretamente** casos que pertencem a outros motores: denúncias (`reports`), reembolsos/estornos (Payment Engine) e reputação (Reputation Engine).
* Produzir **métricas operacionais** (primeira resposta, resolução, CSAT, reabertura, volume por categoria).

O Support Center **não** decide reputação, **não** processa pagamentos e **não** julga denúncias. Ele **orquestra o atendimento** e referencia esses motores quando necessário.

---

## 2. Escopo

### 2.1 Dentro do escopo

* Central de ajuda (autoatendimento) integrada ao produto web.
* Abertura, acompanhamento e ciclo de vida de **tickets** de suporte.
* **Categorias** de atendimento: financeiro, conta, lead, pagamento, denúncia, técnico.
* **Prioridades** e **SLA** associados.
* **Anexos** (prints, comprovantes, documentos) armazenados em S3 (MinIO dev / Cloudflare R2 prod), conforme `03-arquitetura`.
* **Base de conhecimento** (artigos/FAQ, busca, categorias).
* **Atendimento humano**: filas, atribuição a agentes e papéis de suporte ligados ao **RBAC do admin**.
* **Escalonamento** N1 → N2 e encaminhamento para denúncia (`reports`) ou caso financeiro (Payment Engine).
* **Métricas** e **auditoria** de atendimento.

### 2.2 Fora do escopo (pertence a outros documentos)

* **Julgamento e investigação de denúncias** de conduta/conteúdo → `reports` (`04-banco-de-dados`) e `07-reputation-engine`. O Support Center apenas **abre/relaciona** e acompanha.
* **Processamento de reembolso/estorno/chargeback** → `05-payment-engine`. O Support Center **registra o pedido** (ticket) e **dispara/acompanha** a ação; a execução financeira é do Payment Engine.
* **Cálculo de reputação** → `07-reputation-engine`. O resultado de um atendimento **não** altera reputação diretamente.
* **Chat operacional entre contratante e profissional** (`conversations`/`messages`) → `03-arquitetura`. O suporte usa um canal **distinto** (`ticket_messages`).
* **Notificações de produto** → tabela `notifications` existente é **reutilizada** para avisar o usuário sobre o ticket; o Support Center não cria sistema de notificação próprio.

### 2.3 Perfis envolvidos

| Perfil | Origem (RBAC) | Papel no Support Center |
|---|---|---|
| Contratante (`customer`) | `users.role = customer` | Abre e acompanha tickets, avalia (CSAT). |
| Profissional (`professional`) | `users.role = professional` | Abre e acompanha tickets, avalia (CSAT). |
| Agente N1 | `users.role = admin` + papel de suporte | Atende fila, responde, classifica, resolve. |
| Agente N2 / Especialista | `users.role = admin` + papel de suporte | Recebe escalonamento, casos complexos. |
| Supervisor de Suporte | `users.role = admin` + papel de suporte | Reatribui, monitora SLA, reabre, audita. |

> Os papéis de suporte **não criam um novo `role`**. Eles são **sub-papéis do `admin`** (ver seção 6.1), respeitando `users.role ∈ {customer, professional, admin}` do schema oficial.

---

## 3. Regras de Negócio

### 3.1 Quem pode abrir ticket

* Qualquer usuário **autenticado** com `users.status = active` pode abrir tickets.
* Usuário `suspended` ou `blocked` pode abrir **apenas** tickets da categoria **conta** (ex.: contestar suspensão) — demais categorias ficam bloqueadas.
* Cada ticket pertence a **um** `requester_id` (FK → `users.id`). Não há ticket anônimo.

### 3.2 Categorias de atendimento

| Categoria (`category`) | Descrição | Motor relacionado |
|---|---|---|
| `financeiro` | Saldo de créditos, cobrança, nota, valores. | Payment Engine (`credit_*`, `payment_orders`) |
| `conta` | Login, dados cadastrais, suspensão/bloqueio, exclusão. | Auth / Users |
| `lead` | Qualidade do lead, lead inválido, contato inexistente. | Lead Engine / Matching |
| `pagamento` | Falha de pagamento, PIX/cartão, webhook, assinatura. | Payment Engine (`payment_orders`) |
| `denuncia` | Usuário quer reportar conduta/golpe/abuso. | **Reports** (`reports`) — ver 3.6 |
| `tecnico` | Bug, erro de sistema, indisponibilidade. | Plataforma |

> A categoria `lead` com motivo "lead inválido / contato inexistente / fraude" frequentemente **gera um caso financeiro de reembolso em créditos** (Payment Engine, seção 5.2), pois reembolso na TrampoJá é **em créditos, nunca em dinheiro** (`05-payment-engine` → "Regras de Reembolso").

### 3.3 Prioridades

| Prioridade (`priority`) | Critério |
|---|---|
| `baixa` | Dúvida geral, sugestão, sem impacto operacional. |
| `media` | Problema que atrapalha o uso, mas há contorno. |
| `alta` | Bloqueio relevante (não compra créditos, lead pago sem acesso). |
| `urgente` | Impacto financeiro/segurança: chargeback, cobrança indevida, conta invadida, suspeita de fraude ativa. |

* A prioridade pode ser definida pelo usuário, mas é **sempre validada/ajustada pelo agente** (a prioridade efetiva é a do agente).
* Categorias `pagamento` e `financeiro` entram **no mínimo** como `media`.
* Suspeita de **conta invadida** ou **fraude ativa** entra como `urgente` (ver seção 6.4).

### 3.4 SLA (tempos por prioridade)

SLA é medido em **horas úteis** (janela de atendimento configurável; padrão MVP: 7 dias/semana, 08h–20h, horário de Brasília).

| Prioridade | 1ª resposta (FRT) | Resolução (TTR) |
|---|---|---|
| `urgente` | 1 hora | 8 horas |
| `alta` | 4 horas | 24 horas |
| `media` | 8 horas | 48 horas |
| `baixa` | 24 horas | 120 horas (5 dias úteis) |

Regras de SLA:

* O **relógio de 1ª resposta** para quando o **primeiro retorno do agente** é registrado em `ticket_messages` (`author_role = agent`, `is_internal = false`).
* O **relógio de resolução** para quando o ticket entra em `resolvido`.
* Tempo no estado **`aguardando_usuario`** (waiting) **pausa o SLA de resolução** (o atraso não é da operação; ver seção 4).
* `sla_first_response_due_at` e `sla_resolution_due_at` são calculados na criação/alteração de prioridade e persistidos no ticket.
* **Violação de SLA** marca `sla_breached = true` e gera alerta ao Supervisor; não fecha nem reatribui o ticket automaticamente no MVP.

### 3.5 SLA × Reputation Engine (esclarecimento)

O `tempo de resposta` do **Reputation Engine** (peso 15%, `07-reputation-engine`) mede a velocidade do **profissional respondendo ao contratante** no chat de leads. O **SLA do Support Center** mede a velocidade da **operação de suporte respondendo ao usuário**. São métricas **distintas e independentes**: o SLA de suporte **não** entra no `reputation_score`.

### 3.6 Relação com Denúncias (`reports`) — NÃO duplicar

A moderação de denúncias é descrita em `04-banco-de-dados` (tabela `reports`: `reporter_id`, `target_user_id`, `reason`, `description`, `status ∈ {open, investigating, resolved}`) e em `07-reputation-engine` (impacto: denúncia válida reduz reputação).

Regras de integração (sem duplicação):

1. Quando um usuário usa o suporte para **reportar outro usuário**, o agente **cria/relaciona um `report`** (não um julgamento dentro do ticket). O ticket guarda a referência em `tickets.related_report_id` (FK → `reports.id`).
2. O **julgamento** (open → investigating → resolved) acontece **exclusivamente** no fluxo de `reports`/Moderação. O ticket apenas **acompanha** e comunica o usuário.
3. O ticket de categoria `denuncia` **pode ser resolvido** assim que o `report` é registrado e o usuário informado — **independentemente** do desfecho da moderação. O resultado da denúncia é comunicado pelo fluxo de moderação, não reaberto como SLA de suporte.
4. O Support Center **nunca** altera `reports.status` nem aplica suspensão/bloqueio/remoção por conta própria — essas ações pertencem à Moderação/Reputation Engine.

### 3.7 Relação com Reembolsos/Estornos (Payment Engine) — chamados

Conforme `05-payment-engine`, reembolsos são **em créditos** e ocorrem apenas em: lead inválido, contato inexistente, fraude comprovada, erro da plataforma; chargeback gera bloqueio de créditos + suspensão + análise.

Regras de integração:

1. Um pedido de reembolso vira um **ticket** (`category = financeiro` ou `lead`) com `related_payment_order_id` ou `related_lead_id` quando aplicável.
2. A **decisão e a execução** do reembolso seguem as **Regras de Reembolso** do Payment Engine. O agente N1 **valida o caso**; a efetivação gera `credit_transactions.transaction_type = refund` (e, se houver, `payment_orders.status = refunded`) — pelo Payment Engine, **não** pelo Support Center.
3. **Chargeback** chega como ticket `urgente`; o Support Center **não** reverte cobrança: aciona o fluxo de chargeback do Payment Engine (bloqueio/suspensão/análise) e acompanha.
4. Nenhum reembolso é **em dinheiro** — o suporte deve comunicar o usuário nesse padrão.

### 3.8 Anexos

* Anexos são armazenados em **S3 compatível** (MinIO em dev, Cloudflare R2 em produção), conforme `03-arquitetura`.
* O ticket/mensagem guarda **somente metadados + chave do objeto** (`s3_key`), nunca o binário no banco.
* Tipos permitidos (MVP): `png`, `jpg`, `jpeg`, `pdf`, `txt`. Tamanho máximo por arquivo: **10 MB**; até **5 anexos** por mensagem.
* Documentos sensíveis (RG/CPF) **não** devem ser solicitados no suporte para verificação — isso pertence a `verification_requests` (Payment/Users). O suporte referencia esse fluxo.
* URLs de download são **assinadas e expiráveis**; nunca públicas (ver seção 6.3).

### 3.9 Reabertura e fechamento

* Um ticket `resolvido` pode ser **reaberto pelo usuário** dentro de **7 dias**; após isso ele é **fechado** automaticamente.
* Ticket `fechado` **não** reabre: o usuário deve abrir um novo (com `related_ticket_id` para histórico).
* Toda reabertura incrementa `reopen_count` e alimenta a métrica de **taxa de reabertura** (seção 8).

### 3.10 CSAT

* Ao **resolver**, o sistema solicita avaliação **CSAT** (1 a 5) e comentário opcional, via `notifications`.
* CSAT é **opcional** para o usuário e **imutável** após enviado (consistente com a política de avaliações de `04-banco-de-dados`: avaliações não são alteradas/removidas pelo usuário).
* CSAT do suporte **não** se confunde com `reviews` (avaliação de serviço entre usuários) e **não** afeta `reputation_score`.

---

## 4. Fluxos

### 4.1 Ciclo de vida do ticket

Estados oficiais (`tickets.status`):

```
aberto → em_atendimento → aguardando_usuario → resolvido → fechado
```

```
              (agente assume)        (agente pede info)
   aberto  ───────────────►  em_atendimento ──────────────►  aguardando_usuario
     ▲                              │   ▲                              │
     │                             (resolve)│  (usuário responde)      │
     │                              ▼   └──────────────────────────────┘
     │                          resolvido
     │  (usuário reabre ≤7d)        │
     └──────────────────────────────┤ (7 dias sem reabertura)
                                     ▼
                                  fechado
```

Definições:

| Estado | Significado | SLA |
|---|---|---|
| `aberto` | Criado, na fila, sem agente. | Conta FRT e TTR. |
| `em_atendimento` | Agente atribuído e trabalhando. | Conta FRT (até 1ª resposta) e TTR. |
| `aguardando_usuario` | Aguardando retorno do usuário. | **Pausa TTR**. |
| `resolvido` | Solução entregue; aguardando confirmação/CSAT/janela de reabertura. | TTR encerrado. |
| `fechado` | Encerrado definitivamente. | — |

### 4.2 Fluxo — Autoatendimento (central de ajuda)

```
Usuário acessa Central de Ajuda
        ↓
Busca na Base de Conhecimento (kb_articles)
        ↓
Encontrou artigo?  ── sim ──►  Marca "isso ajudou?" (sinal p/ métrica)
        │ não
        ▼
Inicia abertura de ticket (categoria sugerida pelo contexto)
```

### 4.3 Fluxo — Abertura e atendimento de ticket

```
Usuário abre ticket (categoria, prioridade sugerida, descrição, anexos S3)
        ↓
Sistema cria ticket (status = aberto), calcula SLA, envia p/ FILA da categoria
        ↓
Notificação ao usuário (notifications) + protocolo
        ↓
Agente (N1) puxa/recebe ticket  →  status = em_atendimento
        ↓
Agente responde (ticket_messages) → marca 1ª resposta (FRT)
        ↓
   Precisa de info? ── sim ──► status = aguardando_usuario (pausa TTR)
        │ não                          ↓ (usuário responde)
        ▼                       volta a em_atendimento
Resolve → status = resolvido → dispara CSAT
        ↓
Usuário reabre (≤7d)? ── sim ──► em_atendimento (reopen_count++)
        │ não
        ▼
   após 7 dias → status = fechado
```

### 4.4 Fluxo — Escalonamento N1 → N2

```
N1 avalia ticket
   │
   ├─ resolve no N1? ── sim ──► resolvido
   │
   └─ não (complexo / fora da alçada)
            ↓
   Registra motivo de escalonamento (audit) + escalated_level = 2
            ↓
   Vai para FILA N2 / especialista da categoria
            ↓
   N2 atende → resolve OU encaminha p/ motor externo (ver 4.5)
```

### 4.5 Fluxo — Encaminhamento para motor externo (denúncia / financeiro)

```
Ticket revela caso de outro motor
   │
   ├─ Conduta/golpe/abuso  → cria/relaciona REPORT (tickets.related_report_id)
   │        → Moderação julga (open→investigating→resolved) [07-reputation-engine]
   │        → ticket resolvido após registro + comunicação ao usuário
   │
   └─ Reembolso / cobrança / chargeback → relaciona payment_order/lead
            → Payment Engine decide e executa (refund em CRÉDITOS)
            → ticket resolvido após confirmação da execução
```

### 4.6 Atribuição e filas

* Cada **categoria** possui uma **fila** (`queue`). Tickets entram na fila correspondente.
* **Atribuição** pode ser:
  * **Pull**: agente puxa o próximo ticket elegível (ordem: prioridade desc, depois `created_at` asc).
  * **Push**: supervisor/automação atribui (`assigned_agent_id`).
* Um agente só vê filas das categorias para as quais tem permissão (RBAC, seção 6.1).
* Reatribuição é registrada em `audit_logs` + `admin_actions` (motivo obrigatório).

---

## 5. Casos Especiais

1. **Usuário suspenso/bloqueado contestando** — só pode abrir categoria `conta`. O ticket **não** levanta a suspensão; apenas registra a contestação. A decisão pertence à Moderação (`admin_actions`).
2. **Lead inválido / contato inexistente** — ticket `lead`; se validado, **reembolso em créditos** pelo Payment Engine (não dinheiro). Relacionar `related_lead_id`.
3. **Cobrança indevida / não recebi créditos** — ticket `pagamento`/`financeiro`, prioridade ≥ `alta`. Verificar `payment_orders` e webhook; reprocessamento/refund pelo Payment Engine.
4. **Chargeback** — ticket `urgente`; aciona fluxo de chargeback (bloqueio de créditos + suspensão + análise) do Payment Engine. Suporte **não** reverte.
5. **Denúncia de golpe/assédio/ameaça/discriminação** ("Reclamações Graves" do Reputation Engine) — cria `report`, marca prioridade `urgente`, **encaminha imediatamente** à Moderação; suporte não julga nem pune.
6. **Conta possivelmente invadida** — ticket `conta` `urgente`; recomendar troca de senha/encerrar sessões; acionar trilha de segurança (seção 6.4).
7. **Pedido de exclusão de conta (LGPD)** — ticket `conta`; respeitar **Soft Delete** e a regra de que **transações financeiras e avaliações nunca são apagadas** (`04-banco-de-dados`). Anonimização, não remoção física de dados financeiros.
8. **Spam / abuso de abertura de tickets** — rate limit por usuário (seção 6.2); tickets duplicados podem ser **mesclados** (`merged_into_ticket_id`).
9. **Tentativa de manipular reputação via suporte** — suporte **não** edita `reputation_score`, `reviews` nem `reports.status`; pedidos desse tipo são negados e registrados.
10. **Ausência do `anti-fraud-engine.md`** — ver seção 10 (dependência). Onde o suporte deveria acionar o motor antifraude (fraude ativa, múltiplas contas), o MVP escala para Supervisor + Moderação manualmente.

---

## 6. Segurança

Alinhado à seção "Segurança Obrigatória" de `03-arquitetura` e às convenções de `04-banco-de-dados`.

### 6.1 RBAC e papéis de suporte (ligados ao admin)

* Os papéis de suporte são **sub-papéis do `admin`** — o schema mantém `users.role ∈ {customer, professional, admin}`.
* Proposta de implementação: tabela `support_agents` (ver seção 9 — Modelo de Dados) ligando `user_id` (admin) a um `support_role` e às categorias/filas permitidas.

| `support_role` | Permissões |
|---|---|
| `agent_n1` | Ver/atender filas autorizadas, responder, classificar, resolver, escalar p/ N2, abrir `report`. |
| `agent_n2` | Tudo do N1 + receber escalonamento, casos complexos. |
| `supervisor` | Tudo do N2 + reatribuir, reabrir, ajustar prioridade/SLA, ver métricas, mesclar tickets. |

* **Ownership**: o usuário só acessa **os próprios** tickets (proteção IDOR). Agente só acessa tickets das **suas filas**.
* **Mass Assignment**: campos como `status`, `assigned_agent_id`, `priority`, `sla_*`, `related_*` **não** são editáveis pelo usuário final.

### 6.2 Rate limiting

* Abertura de tickets: limite por usuário (ex.: 5/hora) para evitar spam (consistente com Rate Limiting de `03-arquitetura`).
* Upload de anexos: limite por minuto e por tamanho (seção 3.8).

### 6.3 Anexos e dados sensíveis

* Objetos S3 **privados**; download via **URL assinada e expirável**.
* Validar **tipo e tamanho** no upload; varredura básica de conteúdo.
* Não expor `s3_key` bruta ao cliente sem assinatura.
* Mensagens internas (`is_internal = true`) **nunca** são exibidas ao usuário final.

### 6.4 Trilha de segurança / fraude

* Casos `urgente` de segurança (invasão, fraude) acionam alerta ao Supervisor e à Moderação.
* Toda ação de agente/admin sobre ticket gera **auditoria** (seção 7).
* Reutiliza JWT/Refresh/RBAC/Logs de Segurança da arquitetura oficial; o módulo **não** cria autenticação própria.

---

## 7. Auditoria

Conforme `04-banco-de-dados` ("Toda ação administrativa deve gerar auditoria") e `03-arquitetura`.

* **`audit_logs`** (existente) registra ações sobre tickets: criação, mudança de status, atribuição, escalonamento, anexos, mesclagem (`action`, `entity = 'ticket'`, `entity_id`, `ip_address`, `user_agent`).
* **`admin_actions`** (existente) registra ações de agentes/supervisores com `reason` (reatribuição, reabertura, ajuste de prioridade, encaminhamento a `report`/Payment Engine).
* **Imutabilidade**: mensagens de ticket (`ticket_messages`) e o histórico de status **não** são editados nem apagados; correções entram como nova mensagem/evento (mesma filosofia de transações financeiras e avaliações).
* **Soft Delete**: tickets usam `deleted_at`; nunca remoção física.
* Toda transição de estado grava `actor_id`, estado anterior, estado novo e timestamp (proposta: tabela `ticket_events` — seção 9).

---

## 8. Métricas

Métricas operacionais do Support Center (complementam, sem repetir, as métricas de negócio dos demais motores):

| Métrica | Definição | Fórmula / base |
|---|---|---|
| **FRT — Tempo de 1ª resposta** | Tempo até o 1º retorno do agente. | `first_response_at − created_at` (horas úteis) |
| **TTR — Tempo de resolução** | Tempo até `resolvido`, descontando `aguardando_usuario`. | `resolved_at − created_at − tempo_em_espera` |
| **CSAT** | Satisfação no fechamento. | média das notas 1–5; % de notas ≥ 4 |
| **Taxa de reabertura** | Tickets reabertos / resolvidos. | `Σ reopen_count > 0 / Σ resolvidos` |
| **Volume por categoria** | Distribuição por `category`. | contagem por categoria/período |
| **% dentro do SLA** | Tickets sem `sla_breached`. | `(total − breached) / total` |
| **Backlog / fila** | Tickets abertos por fila. | contagem por `queue`/status |
| **Taxa de escalonamento** | Tickets que foram a N2. | `Σ escalated_level=2 / total` |
| **Deflexão (KB)** | Sessões de ajuda resolvidas sem abrir ticket. | `artigos úteis / acessos à central` |

Painel sugerido (Supervisor): FRT/TTR por prioridade, % dentro do SLA, CSAT, reabertura, volume e backlog por categoria, taxa de escalonamento.

---

## 9. Roadmap

| Versão | Entrega |
|---|---|
| **V1 (MVP)** | Central de ajuda + KB básica; tickets (ciclo de vida completo); categorias; prioridades; SLA fixo; anexos S3; filas por categoria; atribuição pull/push; escalonamento N1→N2; relação com `reports` e Payment Engine; CSAT; métricas essenciais; auditoria. |
| **V2** | SLA por **janela de horário comercial** refinada; macros/respostas prontas; automação de roteamento por categoria; alertas proativos de SLA. |
| **V3** | **Chatbot/IA** de autoatendimento sobre a KB; sugestão automática de artigos e de categoria; classificação automática de prioridade. |
| **V4** | Suporte **multicanal** (e-mail, WhatsApp Business, app móvel — alinhado ao roadmap mobile de `03-arquitetura`); base de conhecimento pública e SEO. |
| **V5** | Integração com **anti-fraud-engine** (quando o documento existir) para abertura/encaminhamento automático de casos de fraude. |

---

## Modelo de Dados (proposta complementar)

> As tabelas abaixo são **novas** e propostas para o Support Center. Elas **não** alteram o schema oficial existente; **referenciam** tabelas oficiais (`users`, `reports`, `payment_orders`, `leads`, `notifications`, `audit_logs`, `admin_actions`).
> Convenções herdadas de `04-banco-de-dados`: **PK `id UUID`**, `created_at`/`updated_at`, **Soft Delete (`deleted_at`)** em entidades críticas, histórico imutável.

### `tickets`

Campos:

* id
* protocol (código legível, ex.: `TKT-2026-000123`, UNIQUE)
* requester_id → users.id
* assigned_agent_id → users.id (admin/agente, nullable)
* queue (categoria-fila)
* category — `financeiro | conta | lead | pagamento | denuncia | tecnico`
* subject
* description
* priority — `baixa | media | alta | urgente`
* status — `aberto | em_atendimento | aguardando_usuario | resolvido | fechado`
* escalated_level — `1 | 2` (default 1)
* related_report_id → reports.id (nullable) — denúncia relacionada
* related_payment_order_id → payment_orders.id (nullable) — caso financeiro
* related_lead_id → leads.id (nullable)
* related_ticket_id → tickets.id (nullable) — origem (reabertura/novo)
* merged_into_ticket_id → tickets.id (nullable) — deduplicação
* sla_first_response_due_at
* sla_resolution_due_at
* first_response_at (nullable)
* resolved_at (nullable)
* closed_at (nullable)
* sla_breached (boolean, default false)
* reopen_count (int, default 0)
* csat_score (int 1–5, nullable)
* csat_comment (nullable)
* created_at
* updated_at
* deleted_at (soft delete)

Status: `aberto | em_atendimento | aguardando_usuario | resolvido | fechado`

### `ticket_messages`

Campos:

* id
* ticket_id → tickets.id
* author_id → users.id
* author_role — `user | agent` (papel no contexto do ticket)
* body
* is_internal (boolean, default false) — nota interna não visível ao usuário
* created_at

> Canal **distinto** de `conversations`/`messages` (chat de leads). Imutável (não editar/apagar).

### `ticket_attachments`

Campos:

* id
* ticket_id → tickets.id
* message_id → ticket_messages.id (nullable)
* uploaded_by → users.id
* s3_key (chave do objeto em S3 / R2)
* file_name
* mime_type
* size_bytes
* created_at

> Apenas metadados + `s3_key`; binário em S3 (MinIO dev / R2 prod). Download por URL assinada.

### `ticket_events`

Campos (trilha imutável de transições):

* id
* ticket_id → tickets.id
* actor_id → users.id
* event_type — `created | assigned | status_changed | escalated | reopened | merged | linked_report | linked_payment`
* from_status (nullable)
* to_status (nullable)
* meta (json — detalhes, motivo)
* created_at

> Complementa `audit_logs`/`admin_actions` (que permanecem como auditoria global).

### `support_agents`

Campos (vincula agentes ao RBAC do admin):

* id
* user_id → users.id (deve ter `role = admin`)
* support_role — `agent_n1 | agent_n2 | supervisor`
* active (boolean)
* created_at
* updated_at

### `support_agent_queues`

Campos (N:N — quais filas/categorias o agente atende):

* id
* support_agent_id → support_agents.id
* category — `financeiro | conta | lead | pagamento | denuncia | tecnico`

### `kb_categories`

Campos (categorias da base de conhecimento):

* id
* name
* slug (UNIQUE)
* parent_id → kb_categories.id (nullable, hierarquia)
* position (int)
* active (boolean)

### `kb_articles`

Campos:

* id
* kb_category_id → kb_categories.id
* title
* slug (UNIQUE)
* body (markdown)
* status — `draft | published | archived`
* author_id → users.id (admin)
* views (int, default 0)
* helpful_count (int, default 0)
* not_helpful_count (int, default 0)
* published_at (nullable)
* created_at
* updated_at
* deleted_at (soft delete)

> **Busca** sobre `title`/`body` (índice full-text); filtragem por `kb_category_id`/`status`. `helpful_count`/`not_helpful_count` alimentam a métrica de **deflexão** (seção 8).

### Índices sugeridos

* `tickets`: `requester_id`, `assigned_agent_id`, `status`, `priority`, `category`, `created_at`, `sla_resolution_due_at`.
* `ticket_messages`: `ticket_id`, `created_at`.
* `ticket_attachments`: `ticket_id`, `message_id`.
* `ticket_events`: `ticket_id`, `created_at`.
* `kb_articles`: `slug`, `kb_category_id`, `status`; full-text em `title`/`body`.

### APIs sugeridas (alinhadas ao padrão de `03-arquitetura`)

```
# Usuário
GET    /support/tickets
POST   /support/tickets
GET    /support/tickets/{id}
POST   /support/tickets/{id}/messages
POST   /support/tickets/{id}/reopen
POST   /support/tickets/{id}/csat
POST   /support/attachments            (gera URL de upload assinada)

# Base de conhecimento
GET    /support/kb/articles            (busca, filtro por categoria)
GET    /support/kb/articles/{slug}
POST   /support/kb/articles/{id}/feedback   (helpful / not_helpful)

# Agente / Admin (RBAC)
GET    /admin/support/queues
GET    /admin/support/tickets
PATCH  /admin/support/tickets/{id}     (status, priority, assign)
POST   /admin/support/tickets/{id}/escalate
POST   /admin/support/tickets/{id}/link-report     (cria/relaciona reports)
POST   /admin/support/tickets/{id}/link-payment    (relaciona payment_orders)
GET    /admin/support/metrics
```

---

## 10. Conflitos e Observações

1. **Dependência ausente — `anti-fraud-engine.md`.** O documento referenciado como dependência **não existe** no repositório. Fluxos de fraude (fraude ativa, múltiplas contas, padrão anormal — sinais citados em `07-reputation-engine`) **não** podem acionar um motor antifraude formal no MVP. **Mitigação atual:** escalonamento manual para Supervisor + Moderação. **Ação:** quando `anti-fraud-engine.md` for publicado, integrar na V5 (seção 9) e revisar as seções 5.10 e 6.4.

2. **Novo número de documento (16).** A numeração oficial atual vai de **01 a 08** (`README.md`). Este documento foi criado em `16-support-center/` conforme solicitado. **Observação:** o `README.md` (índice) **não** lista os documentos 09–16; recomenda-se atualizar o índice para refletir o Support Center (não alterado por este documento para não contradizer a fonte da verdade).

3. **Papéis de suporte vs. enum de `role`.** O schema oficial fixa `users.role ∈ {customer, professional, admin}`. Para **não** contradizê-lo, os papéis N1/N2/Supervisor foram modelados como **sub-papéis do admin** via `support_agents.support_role`, e **não** como novos valores de `users.role`. Caso o time prefira granularizar `role`, isso exigiria alteração na fonte da verdade (`04-banco-de-dados`) — fora do escopo deste documento.

4. **Idioma dos enums.** O schema oficial usa enums em **inglês** (`open`, `purchased`, `pending`...), porém o conteúdo obrigatório deste módulo especifica o ciclo de vida em **português** (`aberto → em_atendimento → aguardando_usuario → resolvido → fechado`). Mantivemos o **português** nos enums de `tickets` por exigência do escopo, gerando uma **inconsistência de convenção** com o restante do schema. **Sugestão:** padronizar na implementação (ex.: `open/in_progress/waiting_user/resolved/closed`) preservando os rótulos em PT-BR na UI. Decisão deve ser ratificada pelo dono do schema.

5. **Reembolso é em créditos, nunca em dinheiro.** Reforçado para evitar que o atendimento prometa devolução monetária — alinhado a `05-payment-engine` ("Não devolver dinheiro. Devolver créditos.").

6. **CSAT ≠ reputação.** O CSAT do suporte é métrica operacional interna e **não** entra no `reputation_score` (`07-reputation-engine`), evitando contaminar a reputação dos usuários com a performance da operação de suporte.

7. **Reuso de `notifications`.** O Support Center **reutiliza** a tabela `notifications` existente para avisos de ticket; não foi criado sistema de notificação paralelo, mantendo consistência com `03-arquitetura`.

8. **Janela de SLA configurável.** Os tempos de SLA (seção 3.4) são **propostas iniciais**; devem ser ratificados pela operação. A definição de "horas úteis" precisa de uma tabela de horário de atendimento (config), tratada como parâmetro, não como tabela de schema neste documento.
