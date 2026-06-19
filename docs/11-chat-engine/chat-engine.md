# chat-engine.md

# Chat Engine — Motor de Conversas e Comunicação Interna

Projeto: TrampoJá

Versão: 1.0

Status: Documento Oficial

---

> Este documento **complementa** e **não substitui** as fontes da verdade já existentes:
> `03-arquitetura/marketplace-architecture.md`, `04-banco-de-dados/database-schema.md`,
> `06-matching-engine/matching-engine.md`, `07-reputation-engine/reputation-engine.md`,
> `05-payment-engine/payment-engine.md`, `02-lead-engine/lead-engine.md` e
> `01-projeto/master-task.md`.
>
> As tabelas `conversations`, `messages`, `reports`, `audit_logs`, `admin_actions`,
> `notifications` e `users` permanecem definidas em `04-banco-de-dados`. Aqui apenas
> **referenciamos** essas estruturas e propomos **extensões** no item *Modelo de Dados
> (proposta complementar)*, sem reescrever o schema oficial.
>
> Dependência conhecida: o `anti-fraud-engine.md` ainda **não existe**. Onde a moderação
> e a detecção de fraude do chat dependem desse motor, este documento apenas aponta a
> integração esperada, **sem duplicar** regras de antifraude.

---

# 1. Objetivo

O Chat Engine é responsável pela **comunicação interna** entre o **contratante**
(`role = customer`) e o **profissional** (`role = professional`) que **comprou o lead**.

Sua missão é:

* permitir que contratante e profissional conversem **dentro da plataforma**, sem
  expor contatos externos;
* materializar o **contato liberado** após a compra do lead (ver `06-matching-engine`
  e `02-lead-engine` — "Contato liberado");
* registrar de forma auditável toda a troca de mensagens;
* fornecer o sinal de **tempo de resposta**, que impacta a reputação do profissional
  (ver `07-reputation-engine` — "Tempo de Resposta", peso 15%);
* sustentar moderação, denúncias e bloqueios;
* preservar o princípio do MVP: **mensagens internas, sem WhatsApp inicialmente**
  (ver `01-projeto/master-task.md` — seção Chat).

O Chat Engine **não** decide quem recebe leads (isso é do Matching Engine), **não**
calcula reputação (isso é do Reputation Engine) e **não** processa pagamentos ou
créditos (isso é do Payment Engine). Ele é a camada de **conversa** que acontece
**depois** da compra do lead.

---

# 2. Escopo

## Dentro do escopo

* Modelo de **uma conversa por lead** entre o contratante e o profissional comprador.
* **Abertura automática** da conversa no momento da compra do lead.
* **Envio e recebimento** de mensagens de texto.
* **Anexos** (imagens e arquivos) via storage S3 Compatible.
* **Mensagens automáticas do sistema** (boas-vindas, contato liberado, encerramento).
* **Permissões** de quem inicia e quem envia mensagens.
* **Bloqueio** de usuário no contexto da conversa.
* **Moderação** de conteúdo (filtros, palavras proibidas, tentativa de burlar a
  plataforma).
* **Denúncias** a partir do chat, integradas à tabela `reports`.
* **Retenção** de mensagens com **soft delete**.
* **Auditoria** das ações do chat via `audit_logs`.
* **Segurança**: criptografia em trânsito e não exposição de contato antes da compra.
* **Tempo real** via WebSocket (mecanismo proposto, com separação clara entre MVP e
  futuro).

## Fora do escopo

* WhatsApp, SMS ou qualquer canal externo de mensagem (explicitamente fora no MVP —
  `01-projeto`: "Sem WhatsApp inicialmente").
* Chamadas de voz ou vídeo.
* Cálculo de reputação, score de matching, processamento de crédito/pagamento
  (responsabilidade de outros motores).
* Regras detalhadas de **antifraude** (dependem do `anti-fraud-engine.md`, ainda
  ausente).
* Chat em grupo / múltiplos profissionais por conversa (incompatível com o modelo
  MVP de **Lead Exclusivo** — ver Conflitos).

---

# 3. Regras de Negócio

## 3.1 Modelo de conversas

* Existe **no máximo uma conversa por lead** (`conversations.lead_id`).
* A conversa conecta exatamente **dois usuários**:
  * o **contratante** dono do lead (`conversations.customer_id` →
    `leads.customer_id`);
  * o **profissional** que comprou o lead (`conversations.professional_id` →
    `lead_purchases.professional_id`).
* O vínculo é direto com o lead. Como o MVP adota **Lead Exclusivo**
  (`lead_purchases.lead_id UNIQUE` em `04-banco-de-dados`; "Primeiro que comprar leva"
  em `06-matching-engine`), há **um único profissional** por lead e, portanto,
  **uma única conversa** por lead.
* `conversations.status` segue o enum oficial: **`active`** ou **`archived`**.

## 3.2 Abertura automática (gatilho de compra)

* A conversa **não** é criada quando o lead é publicado nem quando entra na fila.
* A conversa é criada **automaticamente** no momento em que o profissional **compra o
  lead** (registro em `lead_purchases`), que é exatamente o evento de **contato
  liberado** descrito em `06-matching-engine` ("Contato desbloqueado") e em
  `02-lead-engine` ("Contato liberado").
* O Chat Engine **consome** o evento de compra emitido pelo Lead/Matching/Payment
  Engine; ele **não** debita créditos nem valida saldo (isso já ocorreu no fluxo de
  compra).
* Ao abrir a conversa, o sistema:
  1. cria o registro em `conversations` com `status = active`;
  2. emite as mensagens automáticas iniciais (ver 3.6);
  3. dispara a notificação de "mensagem recebida"/"contato liberado" (ver
     `03-arquitetura` — Sistema de Notificações).

## 3.3 Permissões

Baseadas no RBAC oficial (`03-arquitetura` — Sistema de Permissões; roles em
`04-banco-de-dados`: `customer`, `professional`, `admin`).

* **Iniciar a conversa**: somente o **sistema**, no gatilho de compra. Nenhum usuário
  cria conversa manualmente.
* **Enviar mensagens**: apenas os dois participantes da conversa
  (`customer_id` e `professional_id`).
* **Contratante**: só conversa com profissionais que **compraram o lead** dele. Não
  existe canal de mensagem com profissionais que não compraram.
* **Profissional**: só conversa em leads que **ele comprou**.
* **Admin**: pode **visualizar** conversas para fins de moderação e auditoria, mas
  **não** envia mensagens em nome dos participantes (apenas mensagens de sistema, se
  necessário, em ações administrativas registradas em `admin_actions`).
* Toda permissão é validada no **backend** (Ownership Validation + proteção IDOR,
  conforme `03-arquitetura` — Segurança Obrigatória). O usuário nunca acessa uma
  conversa pela troca de `conversation_id` na URL.

## 3.4 Estados da conversa

| Estado     | Significado                                                                 | Origem                                   |
|------------|------------------------------------------------------------------------------|------------------------------------------|
| `active`   | Conversa aberta; ambas as partes podem trocar mensagens.                      | Compra do lead (3.2)                      |
| `archived` | Conversa encerrada; histórico preservado, sem novas mensagens dos usuários.  | Encerramento (3.5) / ação administrativa  |

`active` e `archived` são os **únicos** valores oficiais (`04-banco-de-dados` —
CONVERSATIONS). Bloqueio e moderação **não criam novos status** de conversa; são
controlados por campos complementares (ver Modelo de Dados, item 4-proposta).

## 3.5 Encerramento

A conversa passa a `archived` quando:

* o lead é **encerrado** ou **cancelado** (`leads.status = closed | cancelled`);
* a contratação é concluída e o ciclo de avaliação é iniciado (ver
  `02-lead-engine` — Ciclo do Lead);
* um administrador encerra a conversa por moderação.

Ao arquivar, o sistema emite a mensagem automática de **encerramento** (3.6) e impede
**novas mensagens de usuário**. O histórico permanece **legível** pelos participantes
(salvo soft delete) e pelo admin.

## 3.6 Mensagens automáticas (mensagens de sistema)

Mensagens emitidas pelo próprio sistema (sem `sender_id` de usuário; ver proposta de
`message_type`/`is_system` no item 4):

* **Boas-vindas**: orienta as boas práticas e lembra que a comunicação deve permanecer
  na plataforma.
* **Contato liberado**: confirma que a compra do lead liberou o contato e habilitou a
  conversa.
* **Encerramento**: informa que a conversa foi arquivada e que o histórico continua
  disponível para consulta.

Mensagens de sistema **não** contam para o **tempo de resposta** do profissional e
**não** podem ser editadas ou denunciadas pelos usuários.

## 3.7 Anexos

* Suporte a **imagens e arquivos** enviados pelos participantes.
* Armazenamento em **S3 Compatible** (MinIO em desenvolvimento, Cloudflare R2 em
  produção — `03-arquitetura`).
* O conteúdo do anexo **não** é gravado no banco; grava-se a **referência** (chave/URL
  no storage) mais metadados (ver `message_attachments` no item 4).
* **Tipos permitidos (MVP)**: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
* **Limites sugeridos (MVP)**: até **10 MB** por arquivo e até **5 anexos** por
  mensagem (parametrizável).
* Upload via **URL pré-assinada** do S3 (o backend gera a URL; o cliente envia direto
  ao storage), evitando trafegar binários pela API.
* Acesso aos anexos é **autorizado**: somente participantes da conversa e admins
  obtêm URLs de leitura assinadas e de curta validade. Nunca há link público
  permanente.
* Anexos passam pela mesma **moderação** (3.9) e podem ser **denunciados** (3.10).

## 3.8 Bloqueios (bloquear usuário)

* Um participante pode **bloquear** o outro dentro do contexto da conversa.
* Efeito do bloqueio:
  * o bloqueado **não consegue mais enviar** mensagens nessa conversa;
  * o bloqueador **não recebe** novas mensagens do bloqueado;
  * o histórico já existente é **preservado** (não é apagado).
* O bloqueio é **assimétrico** e registrado (ver `conversation_blocks` no item 4) e
  gravado em `audit_logs`.
* O bloqueio **não** estorna crédito nem altera reputação por si só (essas decisões
  pertencem a Payment e Reputation Engines). Um bloqueio pode, porém, acompanhar uma
  **denúncia** (3.10).
* Bloqueio **a nível de plataforma** (banir o usuário do sistema) é ação de **admin**
  sobre `users.status = blocked` (`04-banco-de-dados`), **fora** do escopo deste
  motor — aqui tratamos apenas o bloqueio **dentro da conversa**.

## 3.9 Moderação

O Chat Engine aplica uma camada de moderação **na escrita** de cada mensagem:

* **Filtro de conteúdo**: bloqueia/oculta conteúdo ofensivo, ilegal ou abusivo.
* **Palavras proibidas**: lista parametrizável (xingamentos graves, discurso de ódio,
  etc.).
* **Tentativa de burlar a plataforma**: detecção de padrões que tentam **mover o
  contato para fora** antes/depois e contornar a monetização — por exemplo, números de
  telefone, e-mails, links para WhatsApp/Telegram e menções explícitas a "me chama no
  zap". Isso reforça o princípio "Sem WhatsApp inicialmente" e protege o modelo de
  **contato liberado somente após a compra**.

Ações possíveis (parametrizáveis por severidade):

* **Permitir**;
* **Mascarar** o trecho (ex.: ocultar dígitos de telefone);
* **Bloquear** o envio e avisar o remetente;
* **Sinalizar** para revisão administrativa (sem bloquear).

Observações de fronteira:

* A moderação automática do chat **não substitui** o antifraude global. Sinais
  fortes (múltiplas contas, manipulação) devem ser encaminhados ao
  **`anti-fraud-engine`** (ainda ausente) — aqui apenas registramos o sinal e
  geramos `report`/auditoria, **sem duplicar** as regras de fraude.
* Toda decisão de moderação é registrada (ver `message_moderations` no item 4) e
  auditada.

## 3.10 Denúncias (integração com `reports`)

* A partir do chat, qualquer participante pode **denunciar** o outro usuário ou uma
  mensagem específica.
* A denúncia **cria um registro** na tabela oficial **`reports`**
  (`04-banco-de-dados`): `reporter_id`, `target_user_id`, `reason`, `description`,
  `status` (`open` → `investigating` → `resolved`).
* Para preservar o contexto, propomos campos opcionais de vínculo
  (`conversation_id`, `message_id`) em `reports` (ver item 4) — **extensão**, não
  reescrita.
* A denúncia **não** altera reputação automaticamente. O `07-reputation-engine` define
  que apenas **denúncia válida** gera redução; a validação é administrativa. O Chat
  Engine apenas **origina** a denúncia.

## 3.11 Retenção e soft delete

* As mensagens seguem a regra oficial de **Soft Delete** (`04-banco-de-dados` —
  Soft Delete / Regras de Integridade: "Nunca remover registros críticos
  fisicamente").
* Propomos `deleted_at` em `messages` (ver item 4). Mensagem "apagada" é **ocultada**
  para os usuários, mas **preservada** para auditoria e moderação.
* **Período de retenção (proposta MVP)**: mensagens e metadados mantidos por **24
  meses** após o encerramento da conversa, depois elegíveis a anonimização. Conteúdo
  necessário a investigações de denúncia/fraude é retido até a **resolução** do caso.
* Anexos no S3 seguem retenção equivalente; ao expirar, o objeto é removido do storage
  e a referência marcada como expirada.
* O **histórico financeiro e de auditoria associado nunca é apagado** (regra de
  `04-banco-de-dados` e `05-payment-engine`).

## 3.12 Tempo de resposta (sinal para reputação)

* O Chat Engine **mede** o intervalo entre a **abertura da conversa / primeira
  mensagem do contratante** e a **primeira resposta do profissional**, e o disponibiliza
  ao **Reputation Engine**.
* As faixas de pontuação ("menos de 5 min", "menos de 15 min", "menos de 1 hora",
  "acima de 1 hora") e o peso (**15%**) são definidos em `07-reputation-engine` e
  **não** são recalculados aqui — o Chat Engine apenas **fornece o evento/medição**.
* O mesmo sinal alimenta o critério "Tempo de Resposta" do `06-matching-engine`.

---

# 4. Fluxos

## 4.1 Abertura automática após compra do lead

```text
Profissional compra o Lead
        ↓
Payment/Lead Engine debita créditos e registra lead_purchases
        ↓
Evento "lead comprado / contato liberado" emitido
        ↓
Chat Engine cria conversation (status = active)
        ↓
Mensagens de sistema: boas-vindas + contato liberado
        ↓
Notificação enviada às duas partes
        ↓
Conversa disponível para troca de mensagens
```

## 4.2 Envio de mensagem (com moderação)

```text
Remetente envia mensagem
        ↓
Backend valida participante + conversa active + sem bloqueio
        ↓
Camada de moderação (filtro + palavras proibidas + anti-burla)
        ↓
   ┌── Bloqueada → erro ao remetente + registro de moderação
   ├── Mascarada → conteúdo ajustado + segue
   └── Permitida → segue
        ↓
Persiste em messages (+ anexos, se houver)
        ↓
Auditoria (audit_logs) + cálculo de tempo de resposta (se 1ª do profissional)
        ↓
Entrega em tempo real (WebSocket) + notificação se offline
```

## 4.3 Envio de anexo

```text
Cliente solicita upload
        ↓
Backend valida participante + tipo + tamanho
        ↓
Backend gera URL pré-assinada (S3 / MinIO / R2)
        ↓
Cliente envia o arquivo direto ao storage
        ↓
Cliente confirma; backend registra message_attachment (referência + metadados)
        ↓
Moderação do anexo + auditoria
        ↓
Entrega em tempo real
```

## 4.4 Bloqueio de usuário

```text
Participante aciona "bloquear"
        ↓
Backend registra conversation_block (bloqueador → bloqueado)
        ↓
Envio do bloqueado passa a ser recusado nesta conversa
        ↓
Auditoria (audit_logs)
        ↓
(Opcional) abertura de denúncia (reports)
```

## 4.5 Denúncia a partir do chat

```text
Participante aciona "denunciar" (usuário ou mensagem)
        ↓
Backend cria report (reporter_id, target_user_id, reason, description, status = open)
        ↓
Vincula conversation_id / message_id (extensão)
        ↓
Auditoria (audit_logs)
        ↓
Moderação administrativa avalia → investigating → resolved
        ↓
(Se válida) Reputation/Anti-Fraud Engine aplica consequências
```

## 4.6 Encerramento da conversa

```text
Lead encerrado/cancelado OU contratação concluída OU ação de admin
        ↓
conversation.status = archived
        ↓
Mensagem de sistema: encerramento
        ↓
Bloqueio de novas mensagens de usuário
        ↓
Histórico preservado (sujeito a retenção/soft delete)
```

---

# 5. Casos Especiais

* **Lead cancelado logo após a compra**: se houver reembolso de créditos (regra do
  `05-payment-engine`/`02-lead-engine`), a conversa é **arquivada** com mensagem de
  encerramento. O Chat Engine não decide o reembolso.
* **Profissional sem nenhuma mensagem**: a conversa existe (criada na compra), mas o
  tempo de resposta permanece "não respondido" até a 1ª resposta; isso alimenta a
  penalização de tempo de resposta no Reputation Engine.
* **Bloqueio mútuo**: ambos os lados podem bloquear; o efeito é cumulativo — nenhuma
  nova mensagem trafega, histórico preservado.
* **Conta suspensa/bloqueada na plataforma** (`users.status = suspended | blocked`):
  o usuário perde a capacidade de enviar mensagens em **todas** as conversas; conversas
  permanecem legíveis para a contraparte e para o admin.
* **Anexo malicioso ou tipo não permitido**: upload recusado na validação; tentativas
  repetidas são sinalizadas para moderação/antifraude.
* **Tentativa de troca de contato externo**: trecho mascarado ou mensagem bloqueada
  conforme severidade; reincidência gera `report` automático.
* **Reabertura**: no MVP **não** há reabertura de conversa `archived`. Uma nova
  oportunidade exige um **novo lead** e, portanto, uma **nova conversa** (ver
  Conflitos sobre Lead Compartilhado V2).
* **Mensagem perdida por queda de conexão (WebSocket)**: a fonte da verdade é o banco;
  o cliente sincroniza pelo histórico REST ao reconectar (idempotência por id de
  mensagem do cliente).

---

# 6. Segurança

Alinhada à seção "Segurança Obrigatória" de `03-arquitetura`.

* **Criptografia em trânsito**: todo tráfego (REST e WebSocket) sobre **TLS**
  (`https://` / `wss://`).
* **Não exposição de contato antes da compra**: nenhum dado de contato direto é
  exposto até o **contato liberado** pela compra do lead. A conversa só existe
  após a compra; antes disso não há canal entre as partes.
* **Anti-burla de contato**: a moderação (3.9) coíbe a troca de telefone/e-mail/links
  para canais externos, protegendo o modelo de monetização e o "Sem WhatsApp
  inicialmente".
* **Autenticação e autorização**: **JWT** + **RBAC**; toda mensagem valida que o
  remetente é participante da conversa.
* **Ownership Validation + proteção IDOR**: acesso a `conversations`/`messages`/anexos
  sempre filtrado pelo vínculo do usuário autenticado.
* **Proteção Mass Assignment**: apenas campos permitidos (ex.: `message`, anexos) são
  aceitos do cliente; `sender_id`, `created_at`, status etc. são definidos pelo
  servidor.
* **Rate Limiting**: limita frequência de mensagens/uploads por usuário para conter
  spam e abuso.
* **URLs de anexo assinadas e de curta validade**; sem link público permanente.
* **Logs de Segurança**: eventos sensíveis (bloqueio, denúncia, moderação) registrados.
* O conteúdo das mensagens é armazenado no PostgreSQL; criptografia **em repouso** fica
  a cargo da infraestrutura de banco/storage (não cabe ao Chat Engine reimplementar).

---

# 7. Auditoria

Usa as tabelas oficiais `audit_logs` e `admin_actions` (`04-banco-de-dados`).

* Em **`audit_logs`** (campos: `user_id`, `action`, `entity`, `entity_id`,
  `ip_address`, `user_agent`, `created_at`), registrar ações como:
  * `conversation_opened`
  * `message_sent`
  * `attachment_uploaded`
  * `message_soft_deleted`
  * `user_blocked` / `user_unblocked`
  * `report_created`
  * `moderation_action`
  * `conversation_archived`
* Em **`admin_actions`** (campos: `admin_id`, `action`, `target_entity`, `target_id`,
  `reason`, `created_at`), registrar intervenções administrativas: encerramento forçado,
  ocultação de mensagem, resolução de denúncia.
* **Mensagens nunca são apagadas fisicamente** (soft delete); o histórico é
  rastreável conforme `04-banco-de-dados` ("Nunca remover registros críticos
  fisicamente").
* Decisões de moderação ficam em `message_moderations` (item 4) e referenciam o
  `audit_log` correspondente.

---

# 8. Métricas

Métricas do Chat Engine (complementares às métricas de `02-lead-engine`,
`06-matching-engine` e `07-reputation-engine`, sem duplicá-las):

* **Taxa de início de conversa**: conversas com ao menos 1 mensagem de usuário ÷
  conversas abertas.
* **Tempo até primeira resposta do profissional** (alimenta tempo de resposta da
  reputação e do matching).
* **Mensagens por conversa** (média e mediana).
* **Conversas que evoluem para contratação** (em conjunto com o Lead Engine — KPI
  "Conversão Contato → Contratação").
* **Taxa de bloqueio** por conversa.
* **Volume de denúncias originadas no chat** e tempo médio até resolução.
* **Taxa de acionamento da moderação** (mensagens mascaradas/bloqueadas) e top
  motivos.
* **Taxa de tentativa de burla de contato** detectada.
* **Anexos por conversa** e distribuição de tipos.

---

# 9. Roadmap

## V1 — MVP

* Conversa 1:1 por lead, aberta automaticamente na compra.
* Mensagens de texto + anexos (imagem/PDF) via S3.
* Mensagens de sistema (boas-vindas, contato liberado, encerramento).
* Moderação por filtro de palavras + regras de anti-burla de contato.
* Bloqueio dentro da conversa.
* Denúncia integrada a `reports`.
* Soft delete + retenção.
* **Tempo real**: WebSocket sobre FastAPI (entrega de mensagens; fallback por polling
  REST). Pode iniciar como **near-real-time** com polling caso o WebSocket entre em
  fase 2 da implementação do chat.

## V2

* **Indicadores de presença/digitação** e **recibos de leitura** (`read_at` por
  mensagem).
* **Lead Compartilhado** (até 3 profissionais — `06-matching-engine`/`02-lead-engine`):
  exige decisão de modelo de conversa (ver Conflitos).
* **Push Notifications** para mensagens (alinhado ao Roadmap V2 de `03-arquitetura`).
* Escalonamento horizontal do WebSocket via **Redis Pub/Sub** (Redis já é stack
  oficial).

## V3

* **Moderação assistida por IA** (alinhado às trilhas de IA dos demais motores V3).
* **Antifraude no chat** integrado ao `anti-fraud-engine` (quando existir).
* Respostas rápidas / modelos de mensagem.

## V4

* Tradução automática, transcrição de áudio e demais recursos avançados, conforme
  evolução do produto.

---

# 10. Conflitos e Observações

1. **Dependência ausente — `anti-fraud-engine.md`**: a moderação do chat (3.9) e a
   detecção de "burla de plataforma" pressupõem um motor de antifraude que **ainda não
   existe**. Este documento **não** define regras de antifraude; apenas aponta a
   integração (gerar `report`/auditoria e encaminhar sinais). **Ação**: criar o
   `anti-fraud-engine.md` e detalhar lá os algoritmos.

2. **Lead Compartilhado (V2) x "uma conversa por lead"**: o MVP é **Lead Exclusivo**
   (`lead_purchases.lead_id UNIQUE`), o que garante 1 profissional → 1 conversa. Na V2,
   "Lead Compartilhado (até 3 profissionais)" (`02-lead-engine`/`06-matching-engine`)
   **quebra** a unicidade conversa↔lead. **Observação**: ao implementar a V2, será
   preciso decidir entre (a) `lead_id UNIQUE` na tabela `conversations` (uma conversa
   por par lead+profissional, removendo a unicidade simples) ou (b) modelagem
   multi-participante. Decisão fora do MVP; sinalizada para o time de schema.

3. **Constraint de unicidade em `conversations`**: `04-banco-de-dados` não declara
   `UNIQUE` em `conversations.lead_id`, embora a regra de negócio MVP implique 1
   conversa por lead. **Proposta** (item 4) de adicionar `UNIQUE(lead_id)` no MVP — a
   ser **aprovada** pelo dono do schema, pois mudanças de schema pertencem a
   `04-banco-de-dados`.

4. **`messages.message` vs `messages.content`**: a fonte oficial em
   `04-banco-de-dados` usa o campo **`message`**. O documento de arquitetura
   (`03-arquitetura`) lista `messages.content`. **Este documento adota `message`**
   (schema oficial). Sinalizado para alinhamento de `03-arquitetura`.

5. **Campos de tempo real e leitura ausentes no schema**: não há `read_at`,
   `message_type`, `deleted_at` em `messages` nem `updated_at`/campos de bloqueio em
   `conversations`. São propostos como **extensão** (item 4), sem reescrever o schema
   oficial.

6. **`messages.created_at` sem `updated_at`**: como mensagens são imutáveis
   (somente soft delete, sem edição no MVP), a ausência de `updated_at` é aceitável.
   A "exclusão" usa `deleted_at` proposto.

7. **Notificações**: o Chat Engine reaproveita a tabela oficial `notifications`
   (`04-banco-de-dados`) e o item "mensagem recebida" do Sistema de Notificações
   (`03-arquitetura`); não cria um sistema de notificação próprio.

---

# Modelo de Dados (proposta complementar)

> **Importante**: as tabelas `conversations`, `messages`, `reports`, `audit_logs`,
> `admin_actions` e `notifications` já são **oficiais** em `04-banco-de-dados`. O
> bloco abaixo lista **somente extensões e novas tabelas auxiliares** necessárias ao
> Chat Engine. Qualquer alteração precisa de **aprovação** do dono do schema, conforme
> regra de `04-banco-de-dados` ("Nenhuma tabela deve ser criada fora desta
> especificação sem aprovação").

## Extensões em tabelas existentes

### `conversations` (proposta)

| Campo            | Tipo         | Observação                                                        |
|------------------|--------------|------------------------------------------------------------------|
| `updated_at`     | timestamp    | Padronização com convenção de datas do schema.                   |
| `archived_at`    | timestamp    | Momento do encerramento (status → `archived`).                   |
| `last_message_at`| timestamp    | Otimização de listagem/ordenação de conversas.                   |
| *(constraint)*   | `UNIQUE(lead_id)` | Garante 1 conversa por lead no MVP (Lead Exclusivo).         |

> `status` permanece com os valores oficiais **`active` / `archived`** — sem novos
> estados.

### `messages` (proposta)

| Campo          | Tipo                                   | Observação                                              |
|----------------|----------------------------------------|--------------------------------------------------------|
| `message_type` | enum (`user`, `system`)                | Distingue mensagem de usuário de mensagem de sistema.  |
| `system_event` | enum (`welcome`, `contact_released`, `closed`) | Tipo da mensagem automática (quando `system`).  |
| `read_at`      | timestamp (nullable)                   | Recibo de leitura (entrega plena na V2).               |
| `deleted_at`   | timestamp (nullable)                   | **Soft delete** (regra oficial de retenção).           |

> Campo de conteúdo permanece **`message`** (schema oficial), não `content`.

### `reports` (proposta)

| Campo             | Tipo                  | Observação                                            |
|-------------------|-----------------------|------------------------------------------------------|
| `conversation_id` | uuid (nullable, FK)   | Contexto da denúncia originada no chat.               |
| `message_id`      | uuid (nullable, FK)   | Mensagem específica denunciada.                       |
| `source`          | enum (`chat`, `...`)  | Origem da denúncia (mantém `reason`/`status` oficiais).|

## Novas tabelas auxiliares (sujeitas a aprovação)

### `message_attachments`

| Campo          | Tipo        | Observação                                              |
|----------------|-------------|--------------------------------------------------------|
| `id`           | uuid        | PK.                                                     |
| `message_id`   | uuid (FK)   | → `messages.id`.                                        |
| `storage_key`  | text        | Chave/objeto no S3 (MinIO/R2). Sem URL pública fixa.    |
| `file_name`    | text        | Nome original.                                          |
| `content_type` | text        | MIME (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`). |
| `size_bytes`   | bigint      | Para enforcement de limite (≤ 10 MB MVP).              |
| `created_at`   | timestamp   | Convenção de datas.                                    |
| `deleted_at`   | timestamp   | Soft delete / expiração de retenção.                   |

### `conversation_blocks`

| Campo             | Tipo       | Observação                                          |
|-------------------|------------|-----------------------------------------------------|
| `id`              | uuid       | PK.                                                 |
| `conversation_id` | uuid (FK)  | → `conversations.id`.                               |
| `blocker_id`      | uuid (FK)  | → `users.id` (quem bloqueou).                       |
| `blocked_id`      | uuid (FK)  | → `users.id` (quem foi bloqueado).                  |
| `created_at`      | timestamp  | Auditável.                                          |
| `deleted_at`      | timestamp  | Desbloqueio (soft delete).                          |

### `message_moderations`

| Campo         | Tipo                                       | Observação                                  |
|---------------|--------------------------------------------|---------------------------------------------|
| `id`          | uuid                                       | PK.                                         |
| `message_id`  | uuid (FK, nullable)                        | Mensagem avaliada (pode preceder o insert). |
| `action`      | enum (`allowed`, `masked`, `blocked`, `flagged`) | Resultado da moderação.               |
| `rule`        | text                                       | Regra disparada (palavra proibida, anti-burla, etc.). |
| `severity`    | enum (`low`, `medium`, `high`)             | Severidade.                                 |
| `created_at`  | timestamp                                  | Auditável (referencia `audit_logs`).        |

---

## Apêndice — Tempo real (WebSocket) consistente com FastAPI

* **Mecanismo MVP**: endpoint **WebSocket** nativo do FastAPI (`wss://`), autenticado
  via **JWT** (mesmo esquema do REST). Cada conexão é associada à
  `conversation_id` após validação de participante.
* **Fonte da verdade**: o **PostgreSQL** — o WebSocket entrega a mensagem **após** a
  persistência; clientes sincronizam o histórico via REST (`GET /messages`).
* **Fallback**: se o WebSocket não estiver disponível no início da Fase 8 (Chat), o
  MVP opera em **near-real-time** por **polling** dos endpoints REST já previstos em
  `03-arquitetura` (`GET /conversations`, `GET /messages`, `POST /messages`).
* **Escala (futuro/V2)**: múltiplas instâncias FastAPI coordenadas por **Redis
  Pub/Sub** (Redis já é stack oficial) para fan-out de mensagens entre processos.
* **Notificações offline**: quando o destinatário não está conectado, usa-se a tabela
  `notifications` (item "mensagem recebida"); **Push Notifications** entram na V2,
  conforme Roadmap de `03-arquitetura`.
