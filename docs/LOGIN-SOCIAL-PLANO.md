# Login social (Google / Apple / WhatsApp) — plano e status

Pesquisa + plano validados (workflow). **Arquitetura:** cada provedor só prova a
identidade uma vez; o backend valida o token e emite **o mesmo JWT do FazTudo**
(`AuthResponse`/`TokenPair`) — nada na cadeia de tokens muda. Vínculo por
`provider_sub` (id estável), e-mail só como fallback de 1ª vez.

**Legenda:** ✅ feito · 🔜 falta credencial do dono · ⬜ pendente.

## Status

### Google ✅ (construído, dormente até o Client ID)
- Backend: `POST /api/v1/auth/google {id_token}` → valida via `tokeninfo`
  (audiência = `GOOGLE_WEB_CLIENT_ID`/`GOOGLE_IOS_CLIENT_ID`, emissor, e-mail
  verificado) → vincula por `google_sub` / e-mail ou cria a conta → emite o JWT.
  Migração `fase 20` (password_hash nullable + `google_sub`/`apple_sub`/
  `auth_provider`/`phone_verified_at`). Rate-limit aplicado. 3 testes.
- Frontend (web): `GoogleSignInButton` (GIS) na tela de login — só aparece quando
  `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` está definido; senão fica "Em breve".
- 🔜 **Falta:** o dono criar os Client IDs no Google Cloud Console (grátis) e me
  passar. App **nativo** (Capacitor) usa plugin `@capgo/capacitor-social-login` —
  etapa seguinte (GIS web não roda dentro do app).

### Apple ⬜ (precisa de conta paga)
- Mesma arquitetura (validar `identity_token` via JWKS da Apple). **Obrigatório
  pela App Store** assim que houver outro login social no app iOS.
- 🔜 **Falta:** conta Apple Developer (US$ 99/ano), App ID, Services ID, Key `.p8`,
  Team ID. O `.p8` também é exigido p/ exclusão de conta (revoke).

### WhatsApp ⬜ — **veredito: "login com WhatsApp" não existe**
- A Meta não é provedor de identidade. O caminho real é **OTP por telefone**
  (código via WhatsApp/Twilio Verify + fallback SMS) emitindo o JWT do FazTudo —
  encaixa no onboarding (telefone que Google/Apple não dão).
- 🔜 **Falta:** conta Twilio + Verify Service + WABA aprovado pela Meta (custo por
  OTP). Tratar o botão como "Entrar com código", não login federado.

## Checklist do DONO (o que providenciar)

**Google (grátis):** Google Cloud Console → OAuth consent screen (External,
domínio `faztudoapp.com.br`, links de Termos/Privacidade) → 3 Client IDs (Web,
Android com SHA-1 do Play, iOS com Bundle ID). Entregar: **Web/iOS/Android Client
IDs** (sem secret).

**Apple (US$ 99/ano):** App ID + capability Sign in with Apple, Services ID,
Key `.p8` (+ Key ID), Team ID, Return URL. Entregar: Bundle ID, Services ID,
Team ID, Key ID, `.p8`.

**WhatsApp/OTP (custo por mensagem):** Twilio (Account SID, Auth Token, Verify
Service SID) + Meta Business + WABA aprovado.

## Ativação do Google (quando vier o Client ID)
1. Servidor `.env`: `GOOGLE_WEB_CLIENT_ID=...` (e `GOOGLE_IOS_CLIENT_ID=...`).
2. Frontend `.env.production`: `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=...`.
3. `git pull` → build → up. O botão Google passa a funcionar na web.
