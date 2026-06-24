# Empacotar o FazTudo para Android (Capacitor) — Runbook

**Data:** 2026-06-24
**Branch:** `feat/mobile-capacitor`
**Objetivo desta etapa:** rodar o app em **modo debug** num **celular Android físico** via USB. (Build assinado para a Play Store e push nativo são marcos posteriores.)

---

## Estado atual (já pronto no repositório)

- Capacitor 8 totalmente estruturado: `frontend/android/` existe e configurado.
- Arquitetura: Next.js **export estático** (`output:'export'` em produção → pasta `out/`) empacotado pelo Capacitor; chamadas de rede vão para a **API HTTPS pública** (`NEXT_PUBLIC_API_URL=https://faztudoapp.com.br`).
- `appId`: `br.com.faztudo.app` · `appName`: FazTudo.
- Plugins instalados: `app`, `camera`, `geolocation`, `splash-screen`, `status-bar`.
- `AndroidManifest.xml` com permissões corretas: INTERNET, CAMERA, READ_MEDIA_IMAGES (+ READ_EXTERNAL_STORAGE até SDK 32), ACCESS_FINE/COARSE_LOCATION; câmera/GPS marcados como opcionais.
- Scripts: `build:app` (`next build && cap sync android`), `app:sync`, `app:open`.

**Único bloqueio para rodar:** esta máquina não tem o toolchain de build Android (sem Android Studio, sem Android SDK, sem JDK).

---

## A. Instalar e configurar o toolchain (uma vez só) — AÇÃO MANUAL DO DONO

1. Baixar e instalar o **Android Studio** (https://developer.android.com/studio). O instalador já traz **JDK 17 (JBR)**, **Android SDK**, **platform-tools (adb)** e o **emulador**.
2. Na primeira abertura, aceitar o assistente "Standard" — ele baixa: SDK Platform (API mais recente), Android SDK Build-Tools e Platform-Tools.
3. Local padrão do SDK no Windows: `C:\Users\inova\AppData\Local\Android\Sdk`.
4. Arquivo `frontend/android/local.properties` aponta o SDK para o Gradle (gerado automaticamente; ver passo C). É **gitignored** (local da máquina).

### Verificação (linha de comando, feita pela IA)
- `adb version` → mostra versão do Android Debug Bridge.
- `java -version` (JBR do Android Studio) → 17.x.
- Gradle encontra o SDK via `sdk.dir` em `local.properties`.

## B. Buildar o web app e sincronizar no Android

```
npm --prefix frontend run build:app
```
- `next build` em modo produção usa `.env.production` → API `https://faztudoapp.com.br`.
- Gera `out/` e o `cap sync android` copia para `frontend/android/app/src/main/assets/public`.
- Não precisa do SDK/JDK (só copia assets) — pode rodar antes da instalação do Android Studio.

## C. Rodar no celular físico

1. No celular: **Configurações → Sobre o telefone → tocar 7x em "Número da versão"** para liberar Opções do desenvolvedor.
2. **Opções do desenvolvedor → Depuração USB: LIGAR.**
3. Conectar o cabo USB; no celular, **autorizar** a impressão digital RSA do computador.
4. `adb devices` → o aparelho aparece como `device` (não `unauthorized`).
5. Abrir no Android Studio: `npm --prefix frontend run app:open` (= `cap open android`) → botão **Run ▶** (instala o APK debug e abre no celular).
   - Alternativa CLI: `cd frontend/android && ./gradlew assembleDebug` e depois `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

## D. Checklist de fumaça no aparelho

- [ ] App abre, splash azul (#0D47A1), carrega a home a partir da API ao vivo.
- [ ] Cadastro/Login por e-mail.
- [ ] **Login Google** — ⚠️ risco nº 1: OAuth do Google frequentemente recusa WebView embarcado (`disallowed_useragent`) e a origem `https://localhost` não casa com o redirect. Testar e registrar o comportamento.
- [ ] Geolocalização: permissão nativa + "usar minha localização".
- [ ] Câmera/galeria: foto de perfil/serviço.
- [ ] Botão **voltar** do Android navega/fecha corretamente (plugin `@capacitor/app`).
- [ ] Checkout **Mercado Pago** abre.

## Fora de escopo desta etapa (próximos marcos)

1. **Push nativo (FCM):** o Web Push via service worker **não dispara** na WebView do Capacitor. Requer `@capacitor/push-notifications` + `google-services.json` (Firebase) + integração no backend. Marco separado.
2. **Login Google nativo:** se o checklist D confirmar o bloqueio do WebView, migrar para `@capacitor/browser` (fluxo de sistema) ou plugin nativo de Google Sign-In.
3. **Build assinado (AAB) para a Play Store:** gerar keystore, configurar `signingConfig` em `app/build.gradle`, `versionCode`/`versionName`, e subir na Google Play Console.

---

## Build reproduzível por linha de comando (o que funcionou — sem GUI)

Toolchain instalado em pasta do usuário (sem admin):
- **JDK 21** (Temurin, portable): `C:\Users\inova\android-build\jdk21\jdk-21.0.11+10`
  - ⚠️ **Capacitor 8 exige toolchain Java 21** (os plugins pedem `languageVersion=21`). JDK 17 falha com `ToolchainProvisioningException`.
- **Android SDK**: `C:\Users\inova\AppData\Local\Android\Sdk` (cmdline-tools + platform-tools + platforms;android-36 + build-tools;36.0.0)
  - Licenças aceitas via arquivos em `Sdk\licenses\` (`android-sdk-license`, `android-sdk-preview-license`).

Comando de build (PowerShell):
```powershell
$env:JAVA_HOME = "C:\Users\inova\android-build\jdk21\jdk-21.0.11+10"
$env:ANDROID_HOME = "C:\Users\inova\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
Set-Location "C:\FazTudo\frontend\android"
.\gradlew.bat assembleDebug --no-daemon
```
Saída: `frontend/android/app/build/outputs/apk/debug/app-debug.apk` (~15 MB).
Cópia de entrega: `C:\FazTudo\dist\FazTudo-debug.apk`.

Para regenerar depois de mudar o frontend: `npm --prefix frontend run build:app` (refaz o `out/` + `cap sync`) e então o `gradlew assembleDebug` acima.

## Riscos conhecidos

- **Embedded WebView + OAuth:** ver item D / marco 2.
- **Web Push não funciona no app:** ver marco 1. Hoje os gatilhos de push existem só para a web (PWA/navegador).
- **Cleartext:** não é problema — API é HTTPS e `androidScheme:'https'`.
