# security-spec.md

# Security Specification — Segurança de Aplicação

Projeto: FazTudo

Versão: 1.0

Status: Documento Oficial

---

> **Nota de fonte da verdade.** Este documento consolida e aprofunda os requisitos já estabelecidos em
> `01-projeto/master-task.md` (seção SEGURANÇA), `03-arquitetura/marketplace-architecture.md`
> (seção "Segurança Obrigatória" e "Sistema de Permissões"), `04-banco-de-dados/database-schema.md`
> (tabelas `audit_logs`, `admin_actions`, soft delete / `deleted_at`, regras de integridade) e
> `05-payment-engine/payment-engine.md` (seção "Segurança": webhooks assinados, idempotência, proteção
> financeira, chargeback). Ele **não substitui nem contradiz** a arquitetura; apenas detalha **como
> implementar e testar** cada controle de SEGURANÇA DE APLICAÇÃO.
>
> **Escopo antifraude profundo.** A detecção comportamental de fraude (contas duplicadas, manipulação de
> ranking, avaliações falsas, auto contratação, abuso de bônus, IP/dispositivo repetido) pertence ao
> documento relacionado `anti-fraud-engine.md` (**disponível** em docs/19 — ver
> "## Conflitos e Observações"), com base já delineada em `02-lead-engine/lead-engine.md`
> (seção "Sistema Anti-Fraude") e `07-reputation-engine/reputation-engine.md` (seção "Detecção de Fraude").
> Aqui tratamos apenas dos **controles de aplicação** que sustentam o antifraude (sinais, ganchos de
> auditoria, rate limit, validação de identidade) e da **proteção financeira** do Payment Engine.

---

# 1. Objetivo

Definir a política e os controles de **segurança de aplicação** do FazTudo, garantindo que o
marketplace — onde contratantes publicam necessidades que viram *Leads*, profissionais gastam *créditos*,
e reputação/gamificação/monetização movimentam dinheiro real — opere com:

* **Confidencialidade** dos dados de usuários (PII, documentos de verificação, conversas) e segredos.
* **Integridade** das operações financeiras (créditos, pagamentos, reembolsos) e da reputação.
* **Disponibilidade** resistente a abuso (bots, força bruta, scraping de leads, DoS de aplicação).
* **Rastreabilidade** completa via auditoria (quem fez o quê, quando, de onde).
* **Conformidade** com a LGPD (Lei 13.709/2018).

Objetivos mensuráveis:

* 100% das rotas autenticadas com **RBAC** e **ownership validation** aplicados.
* 100% das operações financeiras e administrativas com **registro de auditoria**.
* 0 endpoints com **IDOR** explorável (verificado por testes automatizados).
* 100% dos webhooks de pagamento **assinados e idempotentes**.
* MTTR de incidente de segurança crítico ≤ 4h após detecção.

---

# 2. Escopo

## 2.1 Dentro do escopo (segurança de aplicação)

* Autenticação (login, cadastro, recuperação de senha) — módulo descrito em
  `03-arquitetura` (Módulo de Autenticação).
* Sessões: **JWT**, **Refresh Token** (expiração, rotação, revogação, armazenamento no cliente).
* Autorização: **RBAC** (`customer`, `professional`, `admin` + papéis administrativos) e
  **ownership validation**.
* Proteção contra **IDOR**, **Broken Access Control** e **Mass Assignment**.
* **Rate limiting** por IP, por usuário e por rota sensível (via Redis).
* **Multi Tenant Ready** (isolamento lógico / escopo por tenant).
* **Soft Delete** como controle de integridade e recuperabilidade.
* **Auditoria** (`audit_logs`) e **logs de segurança** vs. auditoria de negócio.
* **Proteção financeira**: webhooks assinados, idempotência, anti-chargeback (consolidando
  `05-payment-engine`).
* **Proteção contra bots** (CAPTCHA, detecção) — camada de aplicação.
* Controles transversais: **gestão de segredos**, **CORS**, **headers de segurança**,
  **criptografia em repouso/trânsito**, **política de senhas e hashing**, **LGPD**.
* Mapeamento **OWASP Top 10** ao contexto do FazTudo.

## 2.2 Fora do escopo (referenciado, não detalhado aqui)

* **Detecção comportamental de fraude** (scoring de risco, grafo de contas, manipulação de
  ranking/reputação): documento relacionado **`anti-fraud-engine.md`** (disponível em docs/19) + bases em
  `02-lead-engine` e `07-reputation-engine`.
* Regras de negócio de monetização e reembolso em si: `05-payment-engine`.
* Lógica de distribuição/elegibilidade de leads: `06-matching-engine`.
* Segurança de infraestrutura física, hardening de SO, configuração de rede de baixo nível e
  WAF de borda (referenciados como pré-requisito operacional, não especificados linha a linha).

## 2.3 Princípios norteadores

* **Defense in depth** — múltiplas camadas; nenhuma falha isolada compromete o sistema.
* **Secure by default** — toda rota é negada até ser explicitamente liberada por papel + ownership.
* **Least privilege** — papéis e tokens recebem o mínimo necessário.
* **Fail closed** — em dúvida (token inválido, escopo ausente, assinatura de webhook não confere),
  negar/rejeitar.
* **Auditabilidade total** — alinhado às "Regras de Integridade" de `04-banco-de-dados`.

---

# 3. Regras de Negócio (Políticas de Segurança)

| # | Política | Regra | Origem |
|---|----------|-------|--------|
| P01 | Autenticação obrigatória | Toda rota não pública exige JWT válido e não revogado. | 03-arquitetura |
| P02 | RBAC | Acesso decidido por `users.role` (`customer`/`professional`/`admin`) + papéis admin. | 03-arquitetura |
| P03 | Ownership | Usuário só acessa/edita recursos que possui, exceto `admin`. | 03-arquitetura |
| P04 | Mass Assignment | Entrada validada por Pydantic com allow-list; campos sensíveis nunca aceitos do cliente. | 03-arquitetura |
| P05 | Soft Delete | Registros críticos nunca apagados fisicamente; usar `deleted_at`. | 04-banco / 03-arquitetura |
| P06 | Imutabilidade financeira | `credit_transactions` e `payment_orders` nunca editados/apagados. | 04-banco / 05-payment |
| P07 | Imutabilidade de avaliação | `reviews` nunca alteradas diretamente. | 04-banco |
| P08 | Auditoria administrativa | Toda ação de admin gera `admin_actions`. | 04-banco / 05-payment |
| P09 | Webhooks assinados | Todo webhook de pagamento verificado por assinatura antes de processar. | 05-payment |
| P10 | Idempotência | Operação financeira repetida não duplica efeito. | 05-payment |
| P11 | Rate limiting | Rotas sensíveis limitadas por IP e por usuário (Redis). | 03-arquitetura |
| P12 | Senhas | Hashing forte (Argon2id); nunca em texto claro nem em logs. | Este doc |
| P13 | Segredos | Nenhum segredo em código/repositório; somente em cofre/variáveis de ambiente. | Este doc |
| P14 | Trânsito | TLS 1.2+ obrigatório em toda comunicação externa. | Este doc |
| P15 | LGPD | PII tratada conforme bases legais; direitos do titular suportados. | Este doc |
| P16 | Multi-tenant | Toda query escopada por tenant quando o modo multi-tenant estiver ativo. | 01-projeto |
| P17 | Bloqueio de conta | `status` em `users` (`active`/`suspended`/`blocked`) bloqueia acesso. | 04-banco |
| P18 | Chargeback | Chargeback bloqueia créditos adquiridos e suspende a conta. | 05-payment |

Regras de integridade herdadas de `04-banco-de-dados` (reforçadas aqui como política de segurança):

* Nunca remover registros críticos fisicamente — usar Soft Delete.
* Transações financeiras nunca podem ser apagadas.
* Avaliações nunca podem ser alteradas diretamente.
* Toda movimentação de crédito deve gerar histórico (`credit_transactions`).
* Toda ação administrativa deve gerar auditoria (`admin_actions`).

---

# 4. Fluxos (Autenticação, Refresh, Autorização)

## 4.1 Cadastro (POST /auth/register)

```
Cliente envia name, email, phone, password
        ↓
Validação Pydantic (formato, política de senha)  →  falha → 422
        ↓
Verificar CAPTCHA / proteção de bot               →  falha → 400
        ↓
Rate limit por IP (registro)                       →  estourou → 429
        ↓
email/phone já existem? (UNIQUE)                    →  sim → 409 (msg genérica)
        ↓
Hash da senha (Argon2id)
        ↓
Criar users (role definido pelo fluxo, status=active)
        ↓
Criar profile correspondente (customer/professional)
        ↓
audit_logs: action=user.register
        ↓
(opcional) verificação de e-mail / telefone
```

* **role nunca vem do cliente** no payload de registro (proteção Mass Assignment, P04). É derivado
  do fluxo de cadastro (ex.: rota/intenção "sou profissional" vs. "sou contratante"), não de um campo
  arbitrário do corpo.
* Resposta de conflito de e-mail/telefone deve ser **genérica** para reduzir enumeração de contas.

## 4.2 Login (POST /auth/login)

```
Cliente envia email + password
        ↓
Rate limit por IP + por conta-alvo (Redis)          →  estourou → 429 + backoff
        ↓
CAPTCHA após N falhas consecutivas
        ↓
Buscar users por email (sempre executar verify p/ timing constante)
        ↓
status == blocked/suspended?                         →  sim → 403
        ↓
verify_password(Argon2id)                            →  falha → 401 (msg genérica) + incrementa contador
        ↓
Sucesso:
  - emitir Access Token (JWT, curta duração)
  - emitir Refresh Token (rotativo, persistido/hash)
  - atualizar users.last_login_at
  - zerar contador de falhas
  - audit_logs: action=auth.login.success
```

* **Mensagem de erro genérica** ("credenciais inválidas") tanto para e-mail inexistente quanto senha
  errada (anti-enumeração).
* **Timing constante**: executar o hash/verify mesmo quando o e-mail não existe, para não vazar
  existência por tempo de resposta.
* Falhas registram `audit_logs` (`auth.login.failed`) com IP e user-agent — base para detecção de
  força bruta e para o `anti-fraud-engine` (docs/19).

## 4.3 Refresh (POST /auth/refresh) — rotação de token

```
Cliente envia Refresh Token (cookie HttpOnly)
        ↓
Token existe, não expirado e não revogado?           →  não → 401
        ↓
Detecção de reuso: token já marcado como usado/rotacionado?
        ↓ sim
  → REUSO DETECTADO: revogar TODA a família de tokens do usuário,
    forçar re-login, audit_logs: action=auth.refresh.reuse_detected (SEVERIDADE ALTA)
        ↓ não
Revogar (marcar usado) o refresh atual
        ↓
Emitir novo Access Token + novo Refresh Token (rotação)
        ↓
audit_logs: action=auth.refresh.rotated
```

* **Rotação obrigatória**: cada refresh emite um novo refresh token e invalida o anterior.
* **Detecção de reuso** com revogação da família inteira (mitiga roubo de refresh token).
* Refresh tokens são armazenados no servidor por **hash** (nunca em claro), permitindo revogação
  e auditoria.

## 4.4 Logout (POST /auth/logout) — revogação

```
Cliente autenticado solicita logout
        ↓
Revogar Refresh Token atual (e família, se "logout de todos os dispositivos")
        ↓
Adicionar jti do Access Token à blacklist Redis (TTL = tempo restante do token)
        ↓
Limpar cookie HttpOnly
        ↓
audit_logs: action=auth.logout
```

## 4.5 Autorização (toda requisição protegida)

```
Requisição com Access Token (header Authorization: Bearer)
        ↓
Verificar assinatura + exp + iss + aud do JWT          →  inválido → 401
        ↓
jti na blacklist (Redis)?                               →  sim → 401
        ↓
Carregar usuário; status == active?                     →  não → 403
        ↓
(multi-tenant) tenant do token == tenant do recurso?    →  não → 404 (não 403, p/ não vazar existência)
        ↓
RBAC: role autorizado para a rota/ação?                 →  não → 403
        ↓
Ownership: recurso pertence ao usuário (ou é admin)?    →  não → 404 (evita confirmar existência)
        ↓
Executar handler com input já validado por Pydantic (allow-list)
        ↓
audit_logs quando aplicável (escrita/ação sensível)
```

* **Ordem importa**: autenticação → status → tenant → RBAC → ownership. Falha em qualquer etapa = negar.
* Para violação de ownership/tenant, retornar **404** (não 403) em recursos identificáveis, para não
  confirmar a existência de IDs alheios.

## 4.6 Recuperação de senha (forgot/reset)

```
POST /auth/forgot-password (email)
        ↓
Resposta SEMPRE 200 genérica (não revela se e-mail existe)
        ↓
Se existir: gerar token de reset de uso único, curta validade (15 min), armazenado por hash
        ↓
Enviar link por e-mail; rate limit por e-mail/IP
        ↓
POST /auth/reset-password (token + nova senha)
        ↓
Validar token (não expirado, não usado), política de senha
        ↓
Re-hash (Argon2id); invalidar token; revogar TODOS os refresh tokens do usuário
        ↓
audit_logs: action=auth.password.reset
```

---

# 5. Casos Especiais

| Caso | Tratamento de segurança |
|------|-------------------------|
| Conta `suspended`/`blocked` | Login negado (403); tokens existentes invalidados; refresh revogado. |
| Chargeback recebido | P18: bloquear créditos adquiridos, suspender conta, registrar `admin_actions`/auditoria; encaminhar a antifraude. |
| Admin agindo sobre recurso de terceiro | Permitido por RBAC, mas **sempre** gera `admin_actions` com `reason`. |
| Compra de lead concorrente (race) | `lead_purchases.lead_id UNIQUE` (MVP lead exclusivo) + transação atômica garantem que só um profissional compra; falha → 409, sem débito. |
| Débito de crédito | Verificação de saldo + débito atômico (lock de linha na wallet); registra `credit_transactions` com `balance_before`/`balance_after`. Nunca permitir saldo negativo. |
| Reembolso | Só devolve **créditos** (não dinheiro), conforme 05-payment; gera `credit_transactions` (type=refund) + auditoria. |
| Webhook duplicado | Idempotência por `external_reference`/id de evento; segundo processamento é no-op. |
| Webhook com assinatura inválida | Rejeitar (401/400), **não** processar, registrar tentativa em logs de segurança. |
| Token vazado/roubado | Reuso de refresh → revogação da família; suporte a "encerrar todas as sessões". |
| Upload de documento de verificação | URL S3 privada/assinada com expiração curta; nunca pública; acesso só do dono e de admin. |
| Exclusão de conta (LGPD) | Soft delete + anonimização de PII; preservar registros financeiros/auditoria (base legal de obrigação legal). |
| Acesso a conversa (`conversations`/`messages`) | Ownership: só `customer_id`, `professional_id` da conversa (ou admin) leem/escrevem. |
| Enumeração de leads/usuários | IDs UUID (não sequenciais) + ownership/tenant + 404 em vez de 403. |
| Self-review / auto contratação | Bloqueio em regra de negócio (`author_id != target_id`); sinal encaminhado ao antifraude. |

---

# 6. Segurança

Para **cada** item abaixo: **Ameaça → Mitigação concreta → Como testar**.

## 6.1 OWASP Top 10 (mapeado ao FazTudo)

### A01:2021 — Broken Access Control
* **Ameaça**: profissional acessa lead/conversa de outro; usuário chama rota de admin; IDOR em
  `/leads/{id}`, `/credits/...`, `/lead-purchases`, `/messages`.
* **Mitigação**: middleware de autorização (4.5) com RBAC + ownership + tenant **server-side** em toda
  rota; negar por padrão; 404 em violação de ownership; nunca confiar em flags do cliente.
* **Como testar**: suíte de testes de autorização cruzada — para cada rota, tentar acessar recurso de
  outro usuário e de outro papel; esperar 403/404. Teste de "horizontal" (mesmo papel, outro dono) e
  "vertical" (papel inferior tentando rota admin).

### A02:2021 — Cryptographic Failures
* **Ameaça**: senhas/segredos/PII expostos; TLS ausente; documentos S3 públicos.
* **Mitigação**: Argon2id para senhas (6.13); TLS 1.2+ (6.16); criptografia em repouso (6.15);
  buckets S3 privados com URLs assinadas; segredos fora do código (6.10).
* **Como testar**: scan TLS (Qualys/testssl.sh); inspecionar resposta da API por ausência de
  `password_hash`/PII desnecessária; tentar acessar URL S3 sem assinatura (esperar 403).

### A03:2021 — Injection
* **Ameaça**: SQL injection em filtros de lead (city/state/category); XSS via `bio`, `comment`,
  `message`, `title`.
* **Mitigação**: SQLAlchemy com queries parametrizadas (sem string interpolation); validação Pydantic;
  escape/saneamento de saída no Next.js (React escapa por padrão); CSP (6.14).
* **Como testar**: payloads de SQLi nos filtros; payloads de XSS em campos de texto e verificar que
  são renderizados como texto; SAST (Bandit/Semgrep).

### A04:2021 — Insecure Design
* **Ameaça**: lógica de crédito/reembolso explorável; ausência de rate limit em fluxos sensíveis.
* **Mitigação**: débito atômico com lock; idempotência; threat modeling por feature; este documento
  como design de segurança.
* **Como testar**: teste de concorrência (comprar mesmo lead em paralelo → 1 sucesso); revisão de
  design por feature nova.

### A05:2021 — Security Misconfiguration
* **Ameaça**: CORS permissivo; debug/stack traces em produção; headers ausentes; defaults inseguros.
* **Mitigação**: CORS allow-list (6.12); headers de segurança (6.14); `DEBUG=false` em produção;
  mensagens de erro genéricas.
* **Como testar**: checar headers de resposta; provocar erro 500 e confirmar ausência de stack trace;
  testar CORS com `Origin` não autorizada.

### A06:2021 — Vulnerable and Outdated Components
* **Ameaça**: dependências Python/Node com CVEs.
* **Mitigação**: lockfiles; `pip-audit`/`safety` e `npm audit` no CI; Dependabot/Renovate;
  política de atualização.
* **Como testar**: rodar `pip-audit` e `npm audit` no pipeline; build falha em CVE crítico.

### A07:2021 — Identification and Authentication Failures
* **Ameaça**: força bruta de login; sessões não expiram; refresh roubado.
* **Mitigação**: rate limit + bloqueio progressivo (6.7); JWT curto + refresh rotativo com detecção de
  reuso (4.3); MFA no roadmap (9).
* **Como testar**: simular força bruta (esperar 429/bloqueio); reusar refresh token (esperar revogação
  da família); validar expiração do access token.

### A08:2021 — Software and Data Integrity Failures
* **Ameaça**: webhook de pagamento forjado; pipeline/artefato adulterado.
* **Mitigação**: webhooks assinados + idempotência (6.9); integridade de build no CI; pinagem de
  dependências.
* **Como testar**: enviar webhook sem/with assinatura inválida (esperar rejeição); reenviar evento
  (esperar no-op).

### A09:2021 — Security Logging and Monitoring Failures
* **Ameaça**: incidentes não detectados; falta de trilha.
* **Mitigação**: `audit_logs` + logs de segurança estruturados (7); alertas em eventos críticos;
  métricas (8).
* **Como testar**: executar ação sensível e confirmar registro em `audit_logs`; disparar alerta de teste.

### A10:2021 — Server-Side Request Forgery (SSRF)
* **Ameaça**: URLs fornecidas pelo usuário (avatar, documento, webhook futuro) usadas para acessar rede
  interna/metadados de nuvem.
* **Mitigação**: não buscar URLs arbitrárias do usuário; uploads vão direto ao S3 via URL pré-assinada;
  allow-list de domínios; bloquear faixas internas/`169.254.169.254`.
* **Como testar**: submeter URLs apontando para IP interno/metadados e confirmar bloqueio.

## 6.2 IDOR (validação de ownership)

* **Ameaça**: trocar o `{id}` em `/leads/{id}`, `/reviews/{userId}`, `/lead-purchases`, `/messages`
  para acessar dados de terceiros.
* **Mitigação concreta**:
  * IDs **UUID** (já no schema) — não sequenciais, não adivinháveis.
  * Em **toda** consulta de recurso individual, filtrar pelo dono: ex.
    `SELECT ... FROM leads WHERE id=:id AND customer_id=:current_user` (ou validar `lead_purchases`
    para o profissional). Para conversas, exigir que o `current_user` seja `customer_id` ou
    `professional_id` da `conversation`.
  * Dependência/decorator de FastAPI `require_ownership(resource, field)` reutilizável.
  * Retornar **404** quando não pertence ao usuário.
* **Como testar**: para cada endpoint com `{id}`, autenticar como usuário A e requisitar recurso de
  usuário B; esperar 404. Cobrir leads, conversas, mensagens, reviews, wallet, payment_orders,
  verification_requests.

## 6.3 Broken Access Control

* **Ameaça**: escalonamento vertical (`customer`/`professional` acessando rotas de `admin`) e
  horizontal (mesmo papel, dono diferente); confiar em controle só no frontend.
* **Mitigação concreta**: autorização **sempre no backend** (4.5); matriz RBAC (6.4) aplicada por
  dependency em cada rota; ownership (6.2); negação por padrão; método HTTP correto
  (não permitir PATCH/DELETE onde só GET é esperado).
* **Como testar**: matriz de testes papel × rota (incluindo métodos); verificar que o frontend nunca é
  a única barreira (chamar a API diretamente).

## 6.4 RBAC (papéis)

Papéis de usuário (de `users.role`, em `04-banco`/`03-arquitetura`): `customer`, `professional`, `admin`.

**Papéis administrativos** (refinamento de `admin` para least-privilege; ver Conflitos — granularidade
não está no schema atual e pode exigir nova estrutura):

* `admin_support` — moderação de denúncias, conversas reportadas, suporte ao usuário.
* `admin_finance` — painel financeiro, reembolsos (em créditos), tratamento de chargeback.
* `admin_verification` — análise de `verification_requests` (documentos/selfie).
* `admin_super` — gestão de papéis, configurações críticas (acesso total, "Admin pode tudo" do
  03-arquitetura).

Matriz de permissões (resumo; alinhada a "Sistema de Permissões" de 03-arquitetura):

| Ação | customer | professional | admin (papéis) |
|------|:--------:|:------------:|:--------------:|
| Criar/editar lead próprio | ✅ | ❌ | ✅ |
| Comprar lead / gastar créditos | ❌ | ✅ | ✅ |
| Ver contato do lead comprado | ❌ | ✅ (se comprou) | ✅ |
| Conversar (própria conversa) | ✅ | ✅ | ✅ |
| Avaliar (própria contratação) | ✅ | ✅ | ✅ |
| Ver carteira/transações próprias | ❌ | ✅ | ✅ (finance) |
| Aprovar verificação | ❌ | ❌ | ✅ (verification/super) |
| Reembolso / chargeback | ❌ | ❌ | ✅ (finance/super) |
| Bloquear/suspender usuário | ❌ | ❌ | ✅ (support/super) |
| Gerenciar papéis | ❌ | ❌ | ✅ (super) |

* **Ameaça**: papel mal atribuído, mudança de papel não auditada, admin genérico com poder excessivo.
* **Mitigação concreta**: `role` (e papel admin) só alterável por `admin_super`, com `admin_actions`;
  RBAC por dependency `require_roles([...])`; least-privilege via papéis administrativos.
* **Como testar**: para cada papel, validar acesso permitido e negado; tentar elevar o próprio papel
  via API (esperar 403); confirmar `admin_actions` em mudança de papel.

## 6.5 Auditoria / Logs (segurança vs. negócio)

Tratado em detalhe na seção **7**. Resumo:

* **Logs de segurança** (eventos de autenticação/autorização/abuso): login falho, bloqueio, reuso de
  refresh, 401/403, webhook inválido, rate limit estourado.
* **Auditoria de negócio** (`audit_logs`): criação/edição/exclusão de entidades, movimentação de
  crédito, ações administrativas (`admin_actions`).
* **Ameaça**: ausência de trilha; logs com PII/segredos; logs adulteráveis.
* **Mitigação**: nunca logar senha/token/PAN; `audit_logs`/`admin_actions` append-only;
  logs estruturados (JSON) com correlation id; retenção definida.
* **Como testar**: executar cada ação sensível e validar registro correspondente; grep nos logs por
  segredos/PII (esperar zero).

## 6.6 Sessões / JWT / Refresh Tokens

* **Access Token (JWT)**: curta duração (**15 min**), assinado (RS256 recomendado, ou HS256 com segredo
  forte), claims `sub`, `role`, `tenant_id` (quando aplicável), `jti`, `iss`, `aud`, `exp`, `iat`.
  Validar assinatura + `exp` + `iss` + `aud` + blacklist de `jti`.
* **Refresh Token**: longa duração (**7–30 dias**), **opaco** (não JWT) ou JWT armazenado por **hash**
  no servidor; **rotativo** (4.3) com **detecção de reuso** e revogação de família; revogável (logout,
  reset de senha, bloqueio de conta).
* **Armazenamento seguro no cliente**:
  * Refresh token em **cookie HttpOnly + Secure + SameSite=Strict/Lax**, escopo de path `/auth`.
  * Access token em **memória** do app (não em `localStorage`, para reduzir superfície de XSS).
  * Nunca expor token em URL/log.
* **Ameaça**: roubo de token (XSS), replay, sessão eterna, ausência de revogação.
* **Mitigação concreta**: cookies HttpOnly; access em memória; rotação + reuse detection; blacklist de
  `jti` no logout; CSP (6.14) reduz XSS; expiração curta do access.
* **Como testar**: tentar ler refresh via JS (deve falhar por HttpOnly); usar access token expirado
  (esperar 401); reusar refresh (esperar revogação da família); fazer logout e reutilizar token
  (esperar 401).

## 6.7 Rate Limit (por IP, por usuário, por rota sensível; Redis)

* **Ameaça**: força bruta de login, enumeração, scraping de leads, abuso de envio de e-mail (reset),
  flood de webhooks, DoS de aplicação.
* **Mitigação concreta** (contadores no **Redis**, algoritmo *token bucket* ou *sliding window*):

  | Rota / Ação | Limite por IP | Limite por usuário | Extra |
  |-------------|---------------|--------------------|-------|
  | POST /auth/login | 10 / 5 min | 5 / conta-alvo / 5 min | CAPTCHA após 5 falhas; backoff exponencial |
  | POST /auth/register | 5 / hora | — | CAPTCHA obrigatório |
  | POST /auth/forgot-password | 3 / hora | 3 / e-mail / hora | resposta sempre genérica |
  | POST /auth/refresh | 60 / hora | 60 / usuário / hora | reuse detection |
  | GET /leads (listagem/scraping) | 120 / min | 300 / hora | paginação obrigatória |
  | POST /lead-purchases | — | 30 / min | proteção de saldo |
  | POST /credits/purchase | 20 / hora | 10 / hora | — |
  | POST /messages | — | 60 / min | anti-spam |
  | Webhooks de pagamento | por origem do gateway | — | allow-list de IP + assinatura |

  * Resposta `429` com header `Retry-After`.
  * Chave Redis: `rl:{scope}:{identificador}:{janela}` com TTL.
  * Limites globais por IP como rede de proteção anti-DoS.
* **Como testar**: disparar requisições acima do limite e confirmar `429 + Retry-After`; validar que o
  contador é por IP **e** por usuário; verificar reset após a janela.

## 6.8 Multi Tenant Ready (isolamento lógico, escopo por tenant)

* **Ameaça**: vazamento de dados entre tenants (quando a plataforma operar marcas/regiões/empresas
  isoladas no futuro — "Multi Tenant Ready" exigido por `01-projeto`).
* **Mitigação concreta**:
  * Modelo de **isolamento lógico** (shared DB) com coluna `tenant_id` nas tabelas relevantes
    (ver Conflitos — `tenant_id` não está no schema atual; é "ready", não ativo).
  * `tenant_id` carregado no JWT e aplicado **automaticamente** em todas as queries via
    *query filter* global (SQLAlchemy event/session scope), evitando esquecimento manual.
  * Toda criação de registro herda o `tenant_id` do contexto autenticado (nunca do payload — P04).
  * Violação de tenant tratada como IDOR → **404**.
* **Como testar**: com a feature ativa, autenticar em tenant A e tentar ler/escrever recurso de
  tenant B (esperar 404); verificar que inserts gravam o tenant do contexto; teste que omite o filtro
  global falha por design (fail closed).

## 6.9 Proteção Financeira (webhooks assinados, idempotência, anti-chargeback)

Consolidação de `05-payment-engine` (seção "Segurança").

* **Webhooks assinados**
  * **Ameaça**: atacante forja confirmação de pagamento para creditar carteira sem pagar.
  * **Mitigação**: verificar assinatura HMAC/headers do gateway com o segredo do webhook **antes** de
    qualquer processamento; allow-list de IPs do gateway; TLS; rejeitar payload não assinado/expirado
    (proteção contra replay por timestamp).
  * **Como testar**: enviar webhook sem assinatura, com assinatura inválida e com timestamp antigo →
    todos rejeitados e registrados em logs de segurança; webhook válido processa uma vez.
* **Idempotência**
  * **Ameaça**: reprocessamento do mesmo evento duplica créditos/saldo.
  * **Mitigação**: chave de idempotência = id do evento / `external_reference` de `payment_orders`;
    registrar evento processado; segundo processamento é no-op; transição de status `pending → paid`
    só ocorre uma vez (lock/condição na atualização).
  * **Como testar**: reenviar o mesmo webhook N vezes e confirmar saldo creditado uma única vez e
    `credit_transactions` sem duplicidade.
* **Integridade do crédito**
  * **Ameaça**: corrida em débito/crédito gerando saldo inconsistente ou negativo.
  * **Mitigação**: operações em transação com **lock de linha** na `credit_wallets`; registrar
    `balance_before`/`balance_after` em `credit_transactions` (imutável); proibir saldo negativo;
    valor/pacote validados **server-side** contra `credit_packages` (cliente nunca define preço/valor —
    P04).
  * **Como testar**: concorrência de débitos simultâneos (sem saldo negativo, soma consistente);
    tentar comprar pacote com preço manipulado no payload (ignorado).
* **Anti-chargeback** (P18)
  * **Ameaça**: usuário compra créditos, consome e estorna no cartão (fraude de chargeback).
  * **Mitigação**: ao receber chargeback, **bloquear créditos adquiridos**, **suspender conta**,
    registrar `admin_actions`/auditoria e **encaminhar à análise antifraude**; reembolso só em créditos
    (nunca dinheiro), conforme regras do Payment Engine.
  * **Como testar**: simular evento de chargeback do gateway e confirmar bloqueio de créditos +
    suspensão + auditoria.

## 6.10 Gestão de Segredos

* **Ameaça**: segredos (JWT key, DB, Redis, S3, webhook secret, chave do gateway) vazados via
  repositório/logs/imagem.
* **Mitigação concreta**: segredos **somente** em variáveis de ambiente / cofre (ex.: AWS Secrets
  Manager / Vault / variáveis do ambiente de deploy); `.env` no `.gitignore`; nunca commitar; rotação
  periódica; segregação por ambiente (dev/stage/prod); proibição de segredo em código (P13).
* **Como testar**: scan de segredos no repositório (gitleaks/trufflehog) no CI (build falha se achar);
  inspecionar imagem/logs por segredos; confirmar `.env` ignorado.

## 6.11 (reservado — ver 6.10) Política de Segredos por Ambiente
* Sem reuso de segredo entre ambientes; chaves de assinatura JWT distintas por ambiente; revogação
  facilitada (preferir RS256 com par de chaves para rotação sem invalidar tudo de uma vez).

## 6.12 CORS

* **Ameaça**: site malicioso fazendo requisições autenticadas via navegador (CSRF/uso indevido de
  credenciais de origem cruzada).
* **Mitigação concreta**: **allow-list explícita** de origens (domínios do frontend) — nunca `*`
  quando há credenciais; `allow_credentials=true` apenas com origens específicas; restringir métodos e
  headers; `SameSite` nos cookies como defesa CSRF complementar.
* **Como testar**: requisição com `Origin` não autorizada (sem cabeçalhos CORS de permissão);
  confirmar que `*` não é usado com credenciais; testar preflight (OPTIONS).

## 6.13 Política de Senhas e Hashing

* **Ameaça**: senhas fracas; vazamento de banco expondo senhas; hashing reversível/rápido.
* **Mitigação concreta**:
  * **Hashing**: **Argon2id** (parâmetros calibrados; alternativa aceitável: bcrypt cost ≥ 12).
    `password_hash` nunca exposto em API/log.
  * **Política**: mínimo 8–10 caracteres; bloqueio de senhas comuns/vazadas (lista/HIBP k-anonymity);
    sem exigências que incentivem padrões fracos; rate limit e bloqueio em login (6.7).
  * Reset de senha invalida sessões (4.6).
* **Como testar**: tentar cadastrar senha fraca/comum (rejeitada); inspecionar storage (apenas hash
  Argon2id); confirmar ausência de `password_hash` nas respostas.

## 6.14 Headers de Segurança

* **Ameaça**: XSS, clickjacking, sniffing de MIME, vazamento de referrer, downgrade de protocolo.
* **Mitigação concreta** (aplicar em todas as respostas / no Next.js e/ou borda):
  * `Content-Security-Policy` restritiva (default-src 'self'; bloquear inline quando possível).
  * `Strict-Transport-Security` (HSTS, max-age longo, includeSubDomains).
  * `X-Content-Type-Options: nosniff`.
  * `X-Frame-Options: DENY` (ou `frame-ancestors 'none'` na CSP) — anti-clickjacking.
  * `Referrer-Policy: strict-origin-when-cross-origin`.
  * `Permissions-Policy` mínima.
  * Remover/ocultar `Server`/headers que revelam stack.
* **Como testar**: inspecionar headers (securityheaders.com / curl); confirmar CSP ativa e ausência de
  headers reveladores.

## 6.15 Criptografia em Repouso e em Trânsito

* **Em trânsito**: **TLS 1.2+** obrigatório (HTTPS) em frontend↔API, API↔gateway, API↔Redis/DB quando
  remoto; HSTS; redirecionar HTTP→HTTPS.
* **Em repouso**: criptografia de volume/coluna conforme provedor — PostgreSQL com encryption-at-rest;
  S3/R2 com SSE; campos especialmente sensíveis (documentos de verificação) sempre em bucket privado;
  considerar criptografia adicional em nível de aplicação para PII de documento (ver roadmap).
* **Ameaça**: interceptação (MITM) e vazamento de dados em disco/backup.
* **Mitigação concreta**: forçar TLS; certificados gerenciados; encryption-at-rest no DB e no storage;
  backups criptografados.
* **Como testar**: testssl.sh (sem protocolos/cifras fracas); confirmar SSE no bucket; verificar que
  backups estão criptografados.

## 6.16 Proteção contra Bots (CAPTCHA, detecção)

* **Ameaça**: criação em massa de contas (base para multi-contas/fraude), credential stuffing, scraping
  de leads, spam em chat/reviews.
* **Mitigação concreta**: CAPTCHA (hCaptcha/Turnstile/reCAPTCHA) em registro, login após N falhas e
  forgot-password; rate limit (6.7); detecção de padrões (user-agent ausente/anômalo, velocidade
  impossível) com **sinais encaminhados ao `anti-fraud-engine`**; honeypot fields em formulários.
* **Como testar**: tentar registrar/logar automatizado sem resolver CAPTCHA (bloqueado); validar
  acionamento do CAPTCHA após limiar de falhas; verificar emissão de sinais para auditoria/antifraude.

## 6.17 Proteção contra Fraude (referência ao anti-fraud-engine)

* **Ameaça** (escopo do antifraude, listado em `02-lead-engine` e `07-reputation-engine`): contas
  duplicadas, avaliações falsas, auto contratação, compra artificial de reputação, manipulação de
  ranking, abuso de bônus; sinais: IP repetido, dispositivo repetido, padrão anormal, múltiplas contas.
* **Mitigação de aplicação (o que ESTE doc garante)**:
  * Captura confiável de **sinais** em `audit_logs` (IP, user-agent) e em eventos de auth/compra.
  * Ganchos para o motor antifraude consumir (eventos de login, registro, compra de lead, review).
  * Bloqueio rápido via `status` do usuário e revogação de tokens.
  * Bloqueio de auto contratação/self-review em regra de negócio.
* **Detecção e decisão de fraude** → documento relacionado **`anti-fraud-engine.md`** (disponível em docs/19).
* **Como testar (camada de aplicação)**: confirmar que cada evento sensível emite sinal com IP/UA;
  confirmar que bloqueio de conta corta acesso imediatamente.

## 6.18 Soft Delete

* **Ameaça**: perda irreversível de dados (exclusão acidental/maliciosa), perda de trilha de auditoria,
  e — inversamente — "exclusão" que não remove o acesso.
* **Mitigação concreta**:
  * Entidades críticas com `deleted_at` (`04-banco`): nunca DELETE físico.
  * **Toda** query de leitura padrão filtra `deleted_at IS NULL` (filtro global no SQLAlchemy para não
    depender de disciplina manual).
  * Registros financeiros e avaliações **nunca** apagados nem editados (P06, P07).
  * "Soft deleted" também invalida acesso/login quando aplicável (conta excluída não autentica).
  * Restauração só por admin com `admin_actions`.
* **Como testar**: excluir recurso e confirmar `deleted_at` preenchido + ausência nas listagens;
  confirmar que tentar acessar o recurso excluído retorna 404; confirmar que transações financeiras não
  podem ser excluídas (operação proibida).

## 6.19 Validação de Entrada / Proteção contra Mass Assignment

* **Ameaça**: cliente envia campos que não deveria controlar (`role`, `status`, `verified`, `premium`,
  `balance`, `xp`, `level`, `rating`, `credits_cost`, `tenant_id`) e escala privilégio/altera estado.
* **Mitigação concreta**: schemas Pydantic **de entrada separados dos de modelo**, com **allow-list**
  explícita de campos; campos sensíveis nunca presentes no schema de entrada; nunca fazer `Model(**body)`
  ou update genérico a partir do payload; conversões e defaults definidos no servidor.
* **Como testar**: enviar payload com campos proibidos (ex.: `"role":"admin"`, `"balance":99999`,
  `"verified":true`) e confirmar que são **ignorados** (não persistidos); fuzzing de campos extras.

---

# 7. Auditoria

## 7.1 Logs de Segurança vs. Auditoria de Negócio

| Aspecto | Logs de Segurança | Auditoria de Negócio |
|---------|-------------------|----------------------|
| Propósito | Detectar abuso/ataque/incidente | Rastrear ações sobre entidades |
| Exemplos | login falho, bloqueio, reuso de refresh, 401/403, webhook inválido, rate limit | criar/editar/excluir lead, débito/crédito, ações de admin |
| Destino | Stack de logs estruturados (JSON) + alertas | Tabelas `audit_logs` e `admin_actions` |
| Imutabilidade | append-only, retenção definida | append-only (regra de integridade) |

## 7.2 Tabela `audit_logs` (de `04-banco`)

Campos: `id`, `user_id`, `action`, `entity`, `entity_id`, `ip_address`, `user_agent`, `created_at`.

Registrar **no mínimo**:

* Autenticação: `auth.login.success`, `auth.login.failed`, `auth.logout`, `auth.refresh.rotated`,
  `auth.refresh.reuse_detected`, `auth.password.reset`.
* Conta: `user.register`, `user.status_changed`, `user.role_changed`.
* Leads: `lead.created`, `lead.updated`, `lead.cancelled`, `lead.deleted`.
* Créditos/pagamentos: `credit.spend`, `credit.refund`, `payment.order_created`,
  `payment.webhook_received`, `payment.paid`, `payment.chargeback`.
* Verificação: `verification.submitted`, `verification.approved`, `verification.rejected`.
* Reviews/denúncias: `review.created`, `report.created`.

## 7.3 Tabela `admin_actions` (de `04-banco`)

Campos: `id`, `admin_id`, `action`, `target_entity`, `target_id`, `reason`, `created_at`.

* **Toda** ação administrativa registra aqui **com `reason`** (P08): bloqueio/suspensão, reembolso,
  aprovação/rejeição de verificação, mudança de papel, ajuste de crédito, resolução de denúncia,
  tratamento de chargeback, restauração de soft delete.

## 7.4 Regras de logging

* **Nunca** logar: senha, `password_hash`, tokens (access/refresh), dados de cartão, segredos, PII além
  do necessário.
* Logar `request_id`/`correlation_id` para rastreabilidade ponta a ponta.
* `ip_address` e `user_agent` capturados em eventos sensíveis (alimentam o antifraude).
* `audit_logs`/`admin_actions` são **append-only** (sem UPDATE/DELETE) — coerente com "Regras de
  Integridade".
* Definir **retenção**: logs de segurança (≥ 90 dias quentes, arquivamento conforme política);
  auditoria de negócio/financeira retida por obrigação legal (LGPD/fiscal).

---

# 8. Métricas (Segurança)

Métricas e alvos para monitoramento e alertas (complementam as métricas de negócio de 03/05):

| Métrica | Descrição | Alvo / Alerta |
|---------|-----------|---------------|
| Tentativas de login falhas | Falhas por IP/conta/minuto | Alerta em pico anômalo (possível brute force) |
| Taxa de bloqueio de login | % de logins bloqueados por rate limit | Investigar se elevado |
| Contas bloqueadas/suspensas | Volume por dia (manual + chargeback) | Tendência monitorada |
| Eventos de reuso de refresh | `auth.refresh.reuse_detected` | Qualquer ocorrência = investigação |
| Respostas 401/403 | Volume e top rotas | Pico = possível ataque de autorização |
| Respostas 429 (rate limit) | Por rota/IP | Pico = abuso/scraping/DoS |
| Webhooks rejeitados | Assinatura inválida/replay | Qualquer volume relevante = alerta |
| Chargebacks | Quantidade e valor (05-payment) | Monitorar fraude financeira |
| CAPTCHA falhos | Falhas em registro/login | Pico = bot |
| Tempo de detecção/resposta (MTTD/MTTR) | Incidentes de segurança | MTTR crítico ≤ 4h |
| Vulnerabilidades abertas | Por severidade (deps/SAST) | 0 críticas em produção |
| Cobertura de testes de autorização | % de rotas com teste IDOR/RBAC | 100% das rotas autenticadas |

Todas deriváveis dos `audit_logs`, dos logs de segurança estruturados e do painel financeiro admin.

---

# 9. Roadmap

Alinhado às fases de `01-projeto` e aos roadmaps de `03-arquitetura`/`05-payment`.

**MVP (obrigatório desde o início — exigido por 01/03):**

* JWT + Refresh rotativo com revogação; RBAC; Ownership/IDOR; Mass Assignment guard.
* Rate limiting (Redis); Soft Delete; `audit_logs`/`admin_actions`; logs de segurança.
* Webhooks assinados + idempotência + proteção de crédito + anti-chargeback.
* Argon2id; CORS allow-list; headers de segurança; TLS; gestão de segredos; CAPTCHA básico; LGPD base.

**V2:**

* **MFA/2FA** (TOTP) para admins e profissionais; "encerrar todas as sessões".
* Migração de assinatura JWT para **RS256** com rotação de chaves (JWKS).
* Detecção de anomalia de sessão (geolocalização/dispositivo) integrada ao antifraude.
* Alinhado a 03-arquitetura V2 (apps móveis, push) → secure storage de token em mobile.

**V3:**

* Integração plena com o **`anti-fraud-engine`** (docs/19 — scoring de risco, grafo de contas).
* Ativação do modo **multi-tenant** (de "ready" para ativo) com `tenant_id` e filtro global.
* Criptografia em nível de aplicação para PII de documentos de verificação.

**V4+:**

* Suporte a leilão de leads (03/05 V4) com controles antifraude/anti-bot reforçados.
* Programa de bug bounty / pentest recorrente; SIEM dedicado; automação de resposta a incidentes.

---

# 10. Conflitos e Observações

1. **`anti-fraud-engine.md` disponível (docs/19).** O documento dedicado de antifraude profundo agora
   existe em `docs/19-anti-fraud-engine/anti-fraud-engine.md`. Este spec referencia-o como **documento
   relacionado** e cobre apenas os controles de aplicação que o sustentam. Bases complementares:
   `02-lead-engine` ("Sistema Anti-Fraude") e `07-reputation-engine` ("Detecção de Fraude"). A integração
   dos controles de aplicação com o motor central (sinais de IP/dispositivo/múltiplas contas, manipulação
   de ranking, abuso de bônus) deve ser detalhada na implementação.

2. **`tenant_id` não existe no schema atual.** `01-projeto` exige "Multi Tenant Ready", mas
   `04-banco-de-dados` não define `tenant_id` em nenhuma tabela. Tratado aqui como **preparação**
   (isolamento lógico futuro). **Ativar multi-tenant exigirá** adicionar `tenant_id` (UUID, indexado)
   às tabelas de domínio (`users`, `leads`, `lead_purchases`, `credit_wallets`, `conversations`,
   `messages`, etc.) e propagá-lo no JWT — **não aplicar sem aprovação de modelagem** (regra de
   `04-banco`).

3. **Granularidade de papéis administrativos não modelada.** `03-arquitetura` define apenas
   `admin` ("pode tudo"). Para least-privilege, este doc propõe papéis administrativos
   (`admin_support`, `admin_finance`, `admin_verification`, `admin_super`). Implementá-los exige decidir
   entre: (a) ampliar o enum de `role`, ou (b) criar estrutura de papéis/permissões dedicada
   (ex.: `admin_roles`/`permissions`). **Pendente de aprovação** — não contradiz o schema, mas o
   estende.

4. **Campos de auth/sessão não no schema.** A implementação de refresh rotativo com revogação/detecção
   de reuso e a blacklist de `jti` pressupõem armazenamento server-side de refresh tokens (hash, status,
   família, expiração) e, possivelmente, contadores no Redis. O `04-banco` não define tabela de
   `refresh_tokens`/`sessions`. **Recomendação:** criar tabela `refresh_tokens` (ou usar Redis com
   persistência) — sujeito à regra "nenhuma tabela fora da especificação sem aprovação".

5. **Campos de segurança em `users` para anti-brute-force.** Para bloqueio progressivo seria útil
   registrar tentativas falhas/lockout. O contador pode residir no **Redis** (preferido, sem alterar
   schema) ou exigir campos em `users` (`failed_login_attempts`, `locked_until`). Optou-se por Redis no
   MVP para **não** estender o schema; campos persistentes ficam como observação.

6. **Idempotência de webhook precisa de chave persistida.** `05-payment` exige idempotência;
   `payment_orders.external_reference` serve de âncora, mas o id de **evento** do gateway pode requerer
   um registro de "eventos processados" (Redis com TTL ou tabela `webhook_events`). **Observação de
   implementação**, sem contradizer o schema.

7. **Reembolso só em créditos.** Reforço de `05-payment`: nunca devolver dinheiro, apenas créditos
   (`credit_transactions` type=refund). Este doc trata o controle de segurança/auditoria, não a regra
   comercial.

8. **Nomenclatura de tabelas de log.** `04-banco` usa `audit_logs` e `admin_actions`; este doc adota
   exatamente esses nomes. "Logs de segurança" (eventos de auth/abuso) podem ir para `audit_logs`
   (com `action` específica) e/ou para o stack de logs estruturados — **decisão de implementação**, sem
   nova tabela obrigatória.

9. **Sem conflito direto detectado** entre este spec e 01/03/04/05 nas áreas de JWT, RBAC, soft delete,
   auditoria, webhooks e idempotência — apenas **detalhamento** e os **gaps de modelagem** acima
   (itens 2–6), que requerem aprovação de schema antes de implementar.
