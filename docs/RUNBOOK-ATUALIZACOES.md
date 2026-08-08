# Runbook — Atualizações do Site e do App (FazTudo)

> Guia operacional para publicar mudanças. Mantido no repositório para consulta
> futura. **Nenhuma senha aqui** — segredos ficam em arquivos locais gitignored.

---

## 1. Visão geral (domínios)

Mesma base de código Next.js serve os dois, decidindo por host (`frontend/src/app/page.tsx`):

| Endereço | O que é |
|---|---|
| **`faztudoapp.com.br`** (domínio puro) | O **app** (o app nativo Android carrega este host ao vivo). |
| **`www.faztudoapp.com.br`** | O **site institucional** (marketing). |

- DNS/proxy no **Cloudflare**. Deploy: **VPS Hostinger `187.127.0.94`** (`srv1775347`), Docker + Traefik, projeto em `/root/FazTudo`.
- O app nativo é um "wrapper" que **carrega o site ao vivo** (`frontend/capacitor.config.ts` → `server.url`). Por isso, **mudança de tela/web não exige novo APK** — sai no deploy normal. Só muda o APK quando mexe em ícone, splash, permissões ou plugins nativos.

---

## 2. Publicar mudança de site / web (o caso comum)

1. Commitar na branch **`main`** e dar `git push origin main`.
2. Na VPS (via SSH), rodar o deploy:
   ```bash
   cd /root/FazTudo && git pull origin main && bash scripts/deploy.sh
   ```
   Isso reconstrói `web` + `backend`, aplica migrations (`alembic upgrade head`) e roda seeds.
3. Conferir no ar (ex.: `https://www.faztudoapp.com.br/` e as rotas alteradas).

> **Cache do Cloudflare:** HTML é dinâmico (não cacheia), mas **arquivos estáticos** (imagens, .apk, JS com hash) podem ficar em cache no edge. Se uma imagem/arquivo não atualizar: use nome/quibust novo (`?v=`), ou purgue no painel do Cloudflare (Caching → Purge).

---

## 3. Atualizar o APK do Android (release assinado)

Fazer **apenas** quando mudar algo nativo (ícone, splash, permissões, plugins) — conteúdo de tela vem do site ao vivo.

**Pré-requisitos (já instalados no PC do dono):** Android Studio (JBR OpenJDK 21) + SDK; a **keystore** `frontend/android/faztudo-release.jks` e o `frontend/android/keystore.properties` (gitignored — ver §4).

Passos:

1. (Se mexeu em web e quer atualizar o fallback empacotado — opcional, pois carrega ao vivo)
   ```bash
   npm --prefix frontend run build:app   # next build + cap sync android
   ```
2. Buildar o **release assinado**:
   ```bash
   cd frontend/android
   export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
   ./gradlew assembleRelease
   ```
   Saída: `frontend/android/app/build/outputs/apk/release/app-release.apk`.
3. Conferir a assinatura (deve ser v2, `CN=FazTudo`):
   ```bash
   "$JAVA_HOME/bin/java.exe" -jar "$LOCALAPPDATA/Android/Sdk/build-tools/37.0.0/lib/apksigner.jar" verify --print-certs app/build/outputs/apk/release/app-release.apk
   ```
4. Publicar no site:
   ```bash
   cp frontend/android/app/build/outputs/apk/release/app-release.apk frontend/public/downloads/faztudo.apk
   ```
5. **Bumpar o `?v=`** em `frontend/src/modules/site/site-config.ts` (`APK_URL`) — senão o Cloudflare continua servindo o APK antigo.
6. Commit + push + deploy (§2).
7. Verificar (o `Content-Length` deve mudar):
   ```bash
   curl -sI "https://www.faztudoapp.com.br/downloads/faztudo.apk?v=SEU_NUMERO" | grep -i content-length
   ```

> **Versão do app:** para uma atualização "de verdade" (não só arquivo novo), subir `versionCode`/`versionName` em `frontend/android/app/build.gradle` antes do passo 2.

---

## 4. Keystore (assinatura) — CUIDADO

- Arquivos: `frontend/android/faztudo-release.jks` + `frontend/android/keystore.properties` (contém a senha e o alias `faztudo`).
- **Gitignored de propósito** — existem **só no PC do dono**.
- 🔴 **Backup obrigatório** (gerenciador de senhas + cópia offline). **Se perder, não dá pra atualizar o app com a mesma assinatura** — a Play Store exige a mesma chave para sempre.
- Para publicar na Play Store depois: dá para usar **Play App Signing** (o Google guarda a chave de app; esta keystore vira a "upload key").

---

## 5. Rotina de segurança / infra

- **Backup do banco** antes de migrations: `bash scripts/backup-db.sh` (mantém os 3 últimos; há cron diário 03:00).
- **Renovação da VPS**: acompanhar a data de expiração no painel da Hostinger (pagamento é ação manual do dono).
- **Acesso SSH de deploy**: chave dedicada em `~/.ssh/faztudo_deploy` (PC do dono) autorizada em `root@187.127.0.94`.

---

## 6. Pendências conhecidas

- Trocar os **dados de contato** placeholder em `frontend/src/modules/site/site-config.ts` (`CONTACT`).
- Depoimentos do site são seção de confiança (sem nomes/notas fabricados) — só adicionar depoimentos reais quando houver.
