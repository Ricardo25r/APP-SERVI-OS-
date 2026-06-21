# Deploy do FazTudo (produção)

Guia para colocar o FazTudo no ar. O MVP já está funcional; esta é a lista
do que falta para um **deploy público seguro**. Itens marcados com 🔑 dependem
de **contas/credenciais do dono**.

## 1. Infraestrutura
- [ ] Servidor (VPS/cloud) com Docker e Docker Compose — ou serviços gerenciados.
- [ ] 🔑 **Domínio** + DNS (ex.: `app.faztudo.com.br`, `api.faztudo.com.br`).
- [ ] **HTTPS** via reverse proxy (Caddy/Nginx/Traefik) com certificado (Let's Encrypt).
- [ ] **Postgres gerenciado** (ou container com volume + backup automático).
- [ ] **Redis** (rate limiting + futuro cache) — já no stack.
- [ ] **Storage S3**: produção recomendada **Cloudflare R2** ou AWS S3
      (em dev é MinIO). Ajustar `S3_ENDPOINT`, `S3_PUBLIC_URL`, chaves e bucket.

## 2. Variáveis de ambiente (`.env`)
Partir de [`.env.example`](../.env.example). Em `APP_ENV=production` o backend
**recusa subir** com segredos default (fail-fast). Definir:
- [ ] `APP_ENV=production`, `APP_DEBUG=false`
- [ ] `JWT_SECRET` e `PAYMENT_WEBHOOK_SECRET` fortes (aleatórios, longos)
- [ ] `CORS_ORIGINS` = domínio(s) exato(s) do frontend (sem `*`)
- [ ] `DATABASE_URL`, `REDIS_URL`, `S3_*` apontando para os serviços de produção
- [ ] `NEXT_PUBLIC_API_URL` = URL pública da API (https)
- [ ] 🔑 SMTP real (**Resend**): `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`,
      `SMTP_USER=resend`, `SMTP_PASSWORD=re_...`, `SMTP_FROM` com **domínio verificado**;
      `ALERTS_ENABLED=true`, `ALERT_EMAIL_TO`
- [ ] 🔑 Gateway de pagamento real (ver seção 4)

## 3. Build e migração
```bash
docker compose --profile full build backend
docker compose --profile full up -d db redis minio createbuckets backend
docker exec faztudo-backend python -m alembic upgrade head
docker exec faztudo-backend python -m app.seeds   # categorias + pacotes
```
Frontend (build de produção):
```bash
cd frontend && npm ci && npm run build && npm run start   # ou empacotar imagem
```

## 4. Pagamentos (sair do modo DEV) 🔑
- [ ] Conta no **Mercado Pago** ou **Stripe**; criar o adaptador `PaymentProvider`
      real (o `DevPaymentProvider` já isola a interface) e configurar webhook + chaves.
- [ ] `PAYMENT_PROVIDER` ≠ `dev` e `NEXT_PUBLIC_PAYMENT_PROVIDER` correspondente.

## 5. App mobile (lojas) 🔑
- [ ] Empacotar o frontend com **Capacitor** (iOS + Android).
- [ ] Ícone, splash, permissões (câmera, localização, notificações).
- [ ] Contas **Apple Developer** e **Google Play** + publicação.

## 6. Pós-deploy
- [ ] Backups automáticos do Postgres + do bucket.
- [ ] Monitorar `/admin/monitoramento` (erros + alertas por e-mail).
- [ ] Revisar **Termos de uso** e **Política de privacidade** com jurídico.
- [ ] Conferir rate limiting e logs.

> Já resolvido no código: fail-fast em produção, rate limiting (login/registro/
> reset/suporte), CORS por env, e-mail de reset, captura de erros (back e front),
> anti-enumeração no reset, revogação de sessão ao bloquear usuário.
