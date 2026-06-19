# Contrato Técnico — Fase 6: Pagamentos (Compra de Créditos)

> **Status:** CONTRATO OFICIAL E FONTE DA VERDADE para a Fase 6 do FazTudo.
> **Público-alvo:** 1 agente de **backend** e 1 agente de **frontend**. Este documento existe para que ambos sigam **exatamente** os mesmos nomes, tipos, contratos de API e regras de negócio — sem divergências.
> **Precedência:** este contrato aplica e estende o schema canônico `docs/04-banco-de-dados/database-schema.md` (tabelas `credit_packages`, `payment_orders`), as regras oficiais de `docs/05-payment-engine/payment-engine.md` e as **convenções de módulos/stack** já fixadas em `docs/fases/contrato-fases-2-5.md` (mesma estrutura de pastas, mixins, enums, exceções de domínio, RBAC, paginação). Em caso de dúvida sobre **convenções de código**, valem as Fases 2–5.
> **Regra de ouro:** não renomear, não re-discutir decisões já tomadas, não criar tabelas/campos/endpoints fora deste escopo. Se algo faltar, **registrar e pedir OK — não improvisar**.
> **Objetivo verificável:** comprar créditos **ponta-a-ponta** com um provedor **DEV** (sem chaves externas): listar pacotes → criar pedido → cobrança fake (pix_code/checkout_url) → confirmar via webhook (simulado em dev) → **creditar a carteira** via `credits.apply_movement(transaction_type=purchase)` → atualizar saldo. Arquitetura **pronta para gateways reais** (Mercado Pago/Stripe) trocando só a implementação do provedor.

---

## Índice

1. [Escopo (entra / não entra)](#1-escopo-entra--não-entra)
2. [Modelo de dados](#2-modelo-de-dados)
3. [Abstração de provedor (`PaymentProvider`)](#3-abstração-de-provedor-paymentprovider)
4. [Endpoints (`/api/v1/payments`)](#4-endpoints-apiv1payments)
5. [Fluxo ponta-a-ponta (idempotência + atomicidade)](#5-fluxo-ponta-a-ponta-idempotência--atomicidade)
6. [Seeds (pacotes iniciais)](#6-seeds-pacotes-iniciais)
7. [Configuração (variáveis de ambiente)](#7-configuração-variáveis-de-ambiente)
8. [Frontend (`/credits` — comprar créditos)](#8-frontend-credits--comprar-créditos)
9. [Segurança / Auditoria e Simplificações do MVP](#9-segurança--auditoria-e-simplificações-do-mvp)
10. [Decisões tomadas neste contrato (registro)](#10-decisões-tomadas-neste-contrato-registro)

---

## 1. Escopo (entra / não entra)

### 1.1 ENTRA nesta fase (compra de créditos)
- **Catálogo de pacotes** (`credit_packages`): leitura pública dos pacotes ativos + seed inicial.
- **Pedido de compra** (`payment_orders`): profissional cria um pedido a partir de um `package_id`; o provedor gera a cobrança (pix_code/checkout_url + `external_reference`).
- **Confirmação por webhook**: callback do provedor, com **assinatura verificada (HMAC)** e **idempotência** obrigatória; ao status `paid`, **credita a carteira** (`credits.apply_movement`, `transaction_type=purchase`) **dentro de uma transação atômica**.
- **Provedor DEV** (`DevPaymentProvider`, ativo por `PAYMENT_PROVIDER=dev`): cria cobrança "aprovável" (pix_code/checkout fake) e expõe um endpoint **dev-only** para simular o webhook (`POST /payments/dev/confirm/{order_id}`).
- **Reembolso em créditos** (admin): estorna um pedido `paid` → devolve créditos (`transaction_type=refund`) **se houver saldo** e marca o pedido `refunded`. Nunca devolve dinheiro.
- **Listagem dos próprios pedidos** (profissional).
- **Frontend `/credits`**: aba "Comprar créditos" (listar pacotes, criar pedido, no modo dev mostrar botão "Confirmar pagamento (simulado)", atualizar saldo).
- **Config**: novas variáveis de ambiente (`PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`, etc.).

### 1.2 NÃO entra agora (apenas citado como futuro)
- **Assinatura premium** recorrente (Receita 3 do payment-engine) — Fase futura.
- **Perfil verificado pago** (Receita 2) — Fase futura/KYC.
- **Chargeback avançado** (bloquear créditos adquiridos, suspender conta, fila de análise) — apenas citado; **não** implementar.
- **Painel financeiro admin completo** (receita diária/mensal, MRR/ARR/LTV, relatórios por cidade/categoria) — fora; somente o endpoint pontual de refund e a listagem do próprio usuário.
- **Provedores reais** (Mercado Pago/Asaas/Pagar.me/Stripe) — apenas **documentados** como plugariam na mesma interface; **sem** implementação nesta fase.
- **Pagamento real PIX/cartão** com chaves externas — substituído pelo `DevPaymentProvider`.

---

## 2. Modelo de dados

> **Stack/convenções (idênticas às Fases 2–5):** SQLAlchemy 2 async, `DeclarativeBase` em `app/database/base.py`; UUID → `UUID(as_uuid=True)` (default `uuid4`); datas → `DateTime(timezone=True)` (`timestamptz`); enums nativos → `Enum(PyEnum, name="<enum_name>")` definidos em `app/models/enums.py`; mixins `UUIDPKMixin`, `TimestampMixin`, `SoftDeleteMixin` de `app/models/base.py`/`mixins.py`. Repositório faz `add`/`flush`; **service** faz `commit`.

### 2.1 Visão geral (2 tabelas novas + 0 alterações destrutivas)

| Tabela | Origem | Dono (feature) | Soft delete | Append-only |
|--------|--------|----------------|-------------|-------------|
| `credit_packages` | doc 04 (estendida) | `payments` | não (usa `active`) | não |
| `payment_orders` | doc 04 (estendida) | `payments` | não | não (mutável só nas transições de status) |

> **Idempotência do webhook:** resolvida **sem tabela extra**, via **coluna única `external_reference` em `payment_orders` + coluna `provider_event_id` única** e uma **transação com lock** (`SELECT ... FOR UPDATE` no pedido). Ver §2.4 e §5.3. (Decisão: não criar `payment_events` nem usar Redis no MVP — a unicidade no banco + lock + checagem de `status` já garantem reentrância segura. Registrado em §10.)

### 2.2 `credit_packages` (Fase 6 — feature `payments`)

Catálogo de pacotes de créditos. **Sem soft delete** (usa `active` para desativar — mesmo padrão de `categories`). Preço em **centavos** (`int`), nunca float.

| Coluna | Tipo Postgres / SQLAlchemy | Constraints / Default |
|--------|----------------------------|------------------------|
| `id` | `UUID` / `UUID(as_uuid=True)` | PK, default `uuid4` |
| `name` | `varchar(80)` / `String(80)` | NOT NULL |
| `credits` | `integer` / `Integer` | NOT NULL, **CHECK `credits > 0`** |
| `price_cents` | `integer` / `Integer` | NOT NULL, **CHECK `price_cents >= 0`** (valor em **centavos** de BRL; ex.: R$ 19,90 → `1990`) |
| `currency` | `varchar(3)` / `String(3)` | NOT NULL, default `'BRL'` (ISO-4217) |
| `active` | `boolean` / `Boolean` | NOT NULL, default `true`, indexado |
| `created_at` | `timestamptz` | NOT NULL, default now |
| `updated_at` | `timestamptz` | NOT NULL, default now, onupdate now |

> **Mudança de nome vs. doc 04:** o doc 04 lista `price` (sem unidade). **Decisão:** usar `price_cents` (`int`, centavos) — evita arredondamento de float em dinheiro (regra do payment-engine: financeiro auditável). Registrado em §10. Adicionados `currency` e `created_at`/`updated_at` (convenção geral).

**Índices:** `active`.
**Relacionamentos:** `orders` → 1:N `payment_orders` (via `payment_orders.package_id`).

### 2.3 `payment_orders` (Fase 6 — feature `payments`)

Pedido de compra de um pacote. **Sem soft delete** (transações financeiras nunca são apagadas — payment-engine; o "cancelamento" é uma transição de `status`, não delete). Mutável apenas nas transições de status documentadas (§5).

| Coluna | Tipo | Constraints / Default |
|--------|------|------------------------|
| `id` | `UUID` | PK, default `uuid4` |
| `user_id` | `UUID` | NOT NULL, **FK → `users.id`** (ON DELETE RESTRICT), indexado (comprador; `role == professional`) |
| `package_id` | `UUID` | NOT NULL, **FK → `credit_packages.id`** (ON DELETE RESTRICT), indexado |
| `provider` | `varchar(20)` / `String(20)` | NOT NULL (slug do provedor que gerou a cobrança: `dev`, `mercadopago`, `stripe`, …; vem de `settings.PAYMENT_PROVIDER` na criação) |
| `amount_cents` | `integer` / `Integer` | NOT NULL, **CHECK `amount_cents >= 0`** (snapshot de `credit_packages.price_cents` no momento da criação — imutável) |
| `credits` | `integer` / `Integer` | NOT NULL (snapshot de `credit_packages.credits` no momento da criação — imutável; é o que será creditado no `paid`) |
| `currency` | `varchar(3)` / `String(3)` | NOT NULL, default `'BRL'` (snapshot) |
| `status` | `ENUM payment_order_status` / `Enum(PaymentOrderStatus, name="payment_order_status")` | NOT NULL, default `pending`, indexado |
| `external_reference` | `varchar(120)` / `String(120)` | NOT NULL, **UNIQUE**, indexado (referência do provedor para a cobrança; chave de correlação webhook ↔ pedido) |
| `provider_event_id` | `varchar(120)` / `String(120)` | NULLABLE, **UNIQUE** (id do evento do provedor que confirmou; preenchido no webhook — **garante idempotência**: o mesmo evento não credita 2×) |
| `pix_code` | `text` / `Text` | NULLABLE (copia-e-cola PIX fake no dev; nullable para checkout de cartão) |
| `checkout_url` | `text` / `Text` | NULLABLE (URL de checkout do provedor; nullable para fluxo PIX puro) |
| `paid_at` | `timestamptz` | NULLABLE (preenchido na transição → `paid`) |
| `refunded_at` | `timestamptz` | NULLABLE (preenchido na transição → `refunded`) |
| `failed_reason` | `varchar(255)` / `String(255)` | NULLABLE (motivo em `failed`/`cancelled`, p/ auditoria) |
| `credit_transaction_id` | `UUID` | NULLABLE (FK lógica → `credit_transactions.id` da movimentação `purchase` gerada; **sem FK rígida** para manter desacoplado, igual ao padrão `reference_id` das Fases 2–5; rastreia qual transação creditou) |
| `created_at` | `timestamptz` | NOT NULL, default now |
| `updated_at` | `timestamptz` | NOT NULL, default now, onupdate now |

**Enum `payment_order_status`:** `pending | paid | failed | refunded | cancelled`.
- `pending`: criado, aguardando pagamento (estado inicial).
- `paid`: confirmado pelo webhook; créditos já adicionados à carteira.
- `failed`: provedor reportou falha/expiração da cobrança (não credita).
- `refunded`: pedido `paid` estornado pelo admin (créditos devolvidos via `refund`).
- `cancelled`: cancelado antes de pagar (reservado; não há endpoint de cancelamento pelo usuário no MVP — transição apenas via provedor/admin).

> **Mudanças vs. doc 04:** o doc 04 lista `gateway`, `amount`, `external_reference`, `paid_at`. **Decisões:** (a) `gateway` → `provider` (alinhado à abstração `PaymentProvider`); (b) `amount` → `amount_cents` (int, centavos); (c) adicionados `credits`/`currency`/`amount_cents` como **snapshot** do pacote (o pedido não muda se o pacote mudar de preço depois — financeiro auditável); (d) adicionados `provider_event_id` (idempotência), `pix_code`, `checkout_url`, `refunded_at`, `failed_reason`, `credit_transaction_id`, `updated_at`. O enum ganhou `cancelled` (já previsto no enunciado). Registrado em §10.

**Índices:** `user_id`, `package_id`, `status`, `external_reference` (unique), `provider_event_id` (unique), composto `(user_id, created_at)` (listagem paginada do próprio histórico).
**Relacionamentos:** `user` → N:1 `users`; `package` → N:1 `credit_packages`.

### 2.4 Como a idempotência é garantida (decisão fechada)

Duas camadas, **sem** tabela `payment_events` e **sem** Redis:

1. **Correlação 1:1 cobrança↔pedido** via `payment_orders.external_reference` **UNIQUE**. O webhook chega com um `external_reference`; o service localiza **exatamente um** pedido.
2. **De-duplicação de evento** via `payment_orders.provider_event_id` **UNIQUE** + **checagem de status sob lock**:
   - O webhook handler carrega o pedido com `SELECT ... FOR UPDATE` (lock pessimista).
   - Se o pedido **já está `paid`** (ou `provider_event_id` já preenchido), o handler **retorna `200` sem creditar de novo** (no-op idempotente).
   - Só credita quando a transição é `pending → paid` (primeira vez). Grava `provider_event_id` na mesma transação; uma corrida concorrente que tente gravar o mesmo `provider_event_id` viola o UNIQUE → captura `IntegrityError` → trata como duplicado (no-op) e responde `200`.

> Em SQLite (testes) o `FOR UPDATE` é no-op; a unicidade de `provider_event_id`/`external_reference` + a checagem de `status` continuam garantindo a reentrância. **Mesmo padrão de atomicidade** já usado na compra de lead das Fases 2–5 (§5.4 daquele contrato).

---

## 3. Abstração de provedor (`PaymentProvider`)

### 3.1 Localização no código

```
backend/app/services/payments/
├── __init__.py            # reexporta get_payment_provider, PaymentProvider, DTOs
├── base.py                # interface abstrata PaymentProvider + DTOs (ChargeResult, ProviderEvent)
├── dev.py                 # DevPaymentProvider (ativo por padrão)
├── factory.py             # get_payment_provider() -> escolhe a impl por settings.PAYMENT_PROVIDER
└── exceptions.py          # WebhookSignatureError, ProviderError (subclasses de DomainError)
```

> **Decisão:** ficar em **`app/services/payments/`** (e não `app/payments/`), para alinhar com o padrão "regra de negócio em `services/`" das Fases 2–5. O **service de orquestração** da feature é `app/services/payments.py`? **Não** — para evitar colisão de nome arquivo↔pacote, a orquestração fica em **`app/services/payments/service.py`** (`PaymentService`), e os provedores ficam ao lado. Registrado em §10.

**Mapa de propriedade (feature `payments`, dono único — o agente de backend):**

| Camada | Arquivos |
|--------|----------|
| Models | `app/models/credit_package.py`, `app/models/payment_order.py` (+ enums em `app/models/enums.py`: `PaymentOrderStatus`) |
| Schemas | `app/schemas/payments.py` |
| Repositories | `app/repositories/payments.py` |
| Services | `app/services/payments/` (pacote: `base.py`, `dev.py`, `factory.py`, `service.py`, `exceptions.py`, `__init__.py`) |
| Rotas | `app/api/payments/routes.py` (o dir `app/api/payments/` **já existe**; só falta o `routes.py`) |
| Seeds | `app/db/seeds/credit_packages.py` (ou migration de dados — ver §6) |

> **Backbone (edição mínima por quem detém o agregador):** adicionar **uma linha** em `app/api/__init__.py` na tupla `_FEATURE_ROUTERS`: `("app.api.payments.routes", "/payments", "payments")`. Adicionar `PaymentOrderStatus` ao reexport de `app/models/__init__.py` e `CreditPackage`/`PaymentOrder`. Adicionar as variáveis em `app/core/config.py` (§7).

### 3.2 DTOs e interface

```python
# app/services/payments/base.py
from __future__ import annotations
import abc
from dataclasses import dataclass
from app.models import PaymentOrder, PaymentOrderStatus

@dataclass(frozen=True)
class ChargeResult:
    """Resultado de create_charge: o que o provedor devolve ao criar a cobrança."""
    external_reference: str          # correlação webhook ↔ pedido (gravado no order)
    pix_code: str | None = None      # copia-e-cola PIX (None se for só checkout)
    checkout_url: str | None = None  # URL de checkout (None se for só PIX)

@dataclass(frozen=True)
class ProviderEvent:
    """Evento normalizado extraído do webhook do provedor."""
    external_reference: str          # qual cobrança/pedido o evento se refere
    status: PaymentOrderStatus       # status normalizado (paid|failed|refunded|...)
    provider_event_id: str           # id único do evento (idempotência)
    raw: dict | None = None          # payload bruto (auditoria/log)

class PaymentProvider(abc.ABC):
    """Contrato agnóstico de provedor de pagamento (PIX/cartão).

    A feature de pagamentos depende SÓ desta interface. Trocar de provedor =
    trocar a implementação concreta (settings.PAYMENT_PROVIDER), sem mexer no
    service/rotas/modelos.
    """

    slug: str  # 'dev' | 'mercadopago' | 'stripe' ...  (gravado em payment_orders.provider)

    @abc.abstractmethod
    async def create_charge(self, order: PaymentOrder) -> ChargeResult:
        """Cria a cobrança no provedor a partir do pedido (amount_cents, currency).

        Retorna external_reference + pix_code/checkout_url. NÃO credita nada.
        """

    @abc.abstractmethod
    def verify_webhook(self, headers: dict[str, str], body: bytes) -> dict:
        """Valida a autenticidade do callback (assinatura HMAC) e devolve o
        payload já desserializado (dict). Lança WebhookSignatureError (→ 401) se
        a assinatura for inválida/ausente. Recebe o corpo CRU (bytes) para o HMAC."""

    @abc.abstractmethod
    def parse_event(self, payload: dict) -> ProviderEvent:
        """Normaliza o payload (já verificado) num ProviderEvent
        {external_reference, status, provider_event_id}. Lança ProviderError (→422)
        se o payload não mapear para um evento conhecido."""
```

### 3.3 Comportamento do `DevPaymentProvider` (ativo por padrão)

```python
# app/services/payments/dev.py  (slug = "dev")
```

- **`create_charge(order)`**: gera valores **fake determinísticos**, sem rede:
  - `external_reference = f"dev_{order.id}"` (único; espelha o `id` do pedido).
  - `pix_code = f"00020126...DEV{order.id.hex[:8]}..."` (string PIX **fake**, só para exibir/copiar; não é um BR Code real).
  - `checkout_url = f"{settings.PAYMENT_DEV_CHECKOUT_BASE}/{order.id}"` (URL fake apontando para a tela do front no modo dev).
  - Retorna `ChargeResult(external_reference, pix_code, checkout_url)`.
- **`verify_webhook(headers, body)`**: valida o header **`X-Webhook-Signature`** = `HMAC_SHA256(body, settings.PAYMENT_WEBHOOK_SECRET)` em hex (comparação `hmac.compare_digest`). Inválido/ausente → `WebhookSignatureError` (`401`). O endpoint **dev `/payments/dev/confirm/{order_id}`** **assina internamente** o corpo com o mesmo secret antes de chamar o handler — assim o caminho dev passa pela **mesma** verificação do caminho real (sem atalho que mascare bugs de assinatura).
- **`parse_event(payload)`**: lê `{"external_reference": ..., "event_id": ..., "type": "payment.paid"|"payment.failed"|"payment.refunded"}` e mapeia `type` → `PaymentOrderStatus` (`paid|failed|refunded`). `provider_event_id = payload["event_id"]`.

### 3.4 Como Mercado Pago / Stripe entrariam (documentação, sem implementar)

Mesma interface, nova classe registrada na `factory`:

- **`MercadoPagoProvider`** (`slug="mercadopago"`):
  - `create_charge`: cria *Payment*/*Preference* via SDK (`MP_ACCESS_TOKEN`); usa `external_reference = order.id`; PIX → `pix_code` (QR copia-e-cola); cartão → `checkout_url` (init_point).
  - `verify_webhook`: valida a assinatura **`x-signature`/`x-request-id`** do MP (HMAC com `MP_WEBHOOK_SECRET`).
  - `parse_event`: consulta o pagamento por id e mapeia `status` (`approved→paid`, `rejected→failed`, `refunded→refunded`); `provider_event_id` = id da notificação.
- **`StripeProvider`** (`slug="stripe"`):
  - `create_charge`: *PaymentIntent*/*Checkout Session* (`STRIPE_API_KEY`); `checkout_url` = `session.url`; `external_reference` no metadata.
  - `verify_webhook`: `stripe.Webhook.construct_event(body, sig_header, STRIPE_WEBHOOK_SECRET)` (assinatura `Stripe-Signature`).
  - `parse_event`: `checkout.session.completed`/`payment_intent.succeeded → paid`, `...refunded → refunded`; `provider_event_id = event.id`.

> Para plugar um provedor real: (1) criar `app/services/payments/<provider>.py`; (2) registrá-lo na `factory`; (3) trocar `PAYMENT_PROVIDER` no `.env`; (4) adicionar suas chaves no config. **Nada** no service de orquestração, modelos ou rotas muda. O endpoint `/payments/dev/confirm/...` simplesmente **não é montado** quando `PAYMENT_PROVIDER != dev`.

### 3.5 Factory

```python
# app/services/payments/factory.py
from functools import lru_cache
from app.core.config import settings
from app.services.payments.base import PaymentProvider
from app.services.payments.dev import DevPaymentProvider

_PROVIDERS: dict[str, type[PaymentProvider]] = {
    "dev": DevPaymentProvider,
    # "mercadopago": MercadoPagoProvider,   # futuro
    # "stripe": StripeProvider,             # futuro
}

@lru_cache
def get_payment_provider() -> PaymentProvider:
    slug = settings.PAYMENT_PROVIDER
    try:
        return _PROVIDERS[slug]()
    except KeyError:
        raise RuntimeError(f"PAYMENT_PROVIDER inválido: {slug!r}")
```

---

## 4. Endpoints (`/api/v1/payments`)

> Base: `/api/v1`. Prefixo da feature `/payments` (aplicado pelo agregador `app/api/__init__.py`). Auth: header `Authorization: Bearer <access>`. RBAC via `require_roles(...)` de `app/core/deps.py`. Erros padronizados pelo handler global de `DomainError` (§3.9 das Fases 2–5). Paginação: `?page=1&page_size=20` (default 20, máx 100), resposta `{"items":[...], "page", "page_size", "total"}`.

| # | Método | Caminho | Auth | Papel | Request (corpo/query) | Response (sucesso) | Erros |
|---|--------|---------|------|-------|------------------------|--------------------|-------|
| 1 | GET | `/payments/packages` | opcional (público + auth) | — | query `?active=true` (default só ativos) | `200 [CreditPackageRead]` | — |
| 2 | POST | `/payments/orders` | JWT | **professional** | `{package_id}` | `201 PaymentOrderRead` (com `pix_code`/`checkout_url`/`external_reference`, status `pending`) | `404` pacote inexistente; `422` pacote inativo; `502` ProviderError |
| 3 | GET | `/payments/orders` | JWT | **professional** (próprios) | query `?status=&page=&page_size=` | `200` paginado de `PaymentOrderRead` (do próprio usuário) | — |
| 4 | GET | `/payments/orders/{id}` | JWT | **professional** (dono) | — | `200 PaymentOrderRead` | `404` inexistente; `403` não é o dono |
| 5 | POST | `/payments/webhook` | **assinatura HMAC** (sem JWT) | — (chamado pelo gateway) | corpo cru do provedor + header `X-Webhook-Signature` | `200 {"received": true}` (sempre 200 em evento válido/duplicado; idempotente) | `401` assinatura inválida; `404` `external_reference` desconhecido; `422` payload não mapeável |
| 6 | POST | `/payments/dev/confirm/{order_id}` | JWT | **professional (dono)** ou **admin** | `{event?: "paid"\|"failed"\|"refunded"}` (default `paid`) | `200 PaymentOrderRead` (pedido atualizado; saldo creditado se `paid`) | `404` pedido; `403` não-dono/não-admin; `409` se já não-`pending`; **`404` se `PAYMENT_PROVIDER != dev`** (rota não montada) |
| 7 | POST | `/payments/orders/{id}/refund` | JWT | **admin** | `{reason?}` | `200 PaymentOrderRead` (status `refunded`, créditos devolvidos) | `404` pedido; `409` pedido não está `paid`; `402` saldo insuficiente p/ estornar |

### 4.1 Schemas Pydantic (`app/schemas/payments.py`)

```python
# Pydantic v2; *Read usa model_config = ConfigDict(from_attributes=True)

class CreditPackageRead(BaseModel):
    id: UUID
    name: str
    credits: int
    price_cents: int          # centavos (front formata)
    currency: str             # "BRL"
    active: bool

class PaymentOrderCreate(BaseModel):
    package_id: UUID          # ÚNICO campo do cliente (mass-assignment safe)

class PaymentOrderRead(BaseModel):
    id: UUID
    package_id: UUID
    provider: str
    amount_cents: int
    credits: int
    currency: str
    status: PaymentOrderStatus
    external_reference: str
    pix_code: str | None
    checkout_url: str | None
    paid_at: datetime | None
    refunded_at: datetime | None
    created_at: datetime

class PaymentOrderListResponse(BaseModel):
    items: list[PaymentOrderRead]
    page: int
    page_size: int
    total: int

class DevConfirmRequest(BaseModel):
    event: Literal["paid", "failed", "refunded"] = "paid"

class RefundRequest(BaseModel):
    reason: str | None = None
```

> **Mass assignment / IDOR:** o cliente nunca envia `amount_cents`, `credits`, `status`, `user_id`, `external_reference` — todos derivados do pacote/servidor. O `user_id` do pedido é sempre `current_user.id` (nunca do corpo). `GET /orders/{id}` valida `order.user_id == current_user.id` (senão `403`).

### 4.2 Notas por endpoint

- **#1 `GET /payments/packages`** — público para a vitrine; se autenticado, idêntico. Default só `active=true`; `?active=false` lista todos (útil ao admin, mas sem RBAC extra no MVP).
- **#2 `POST /payments/orders`** — service: valida pacote ativo → cria `payment_orders` (`status=pending`, snapshot `amount_cents/credits/currency`, `provider=settings.PAYMENT_PROVIDER`) → `flush` (gera `id`) → `provider.create_charge(order)` → grava `external_reference/pix_code/checkout_url` → `commit`. **Não credita nada.**
- **#5 `POST /payments/webhook`** — **rota lê o corpo cru** (`await request.body()`) **antes** de qualquer parse, passa para `provider.verify_webhook(headers, body)` (HMAC), depois `provider.parse_event(...)`, depois `service.handle_event(event)` (§5.3). Sempre responde `200` para eventos válidos (inclusive duplicados) para o gateway não reenfileirar; `401` só para assinatura inválida.
- **#6 `POST /payments/dev/confirm/{order_id}`** — **montada condicionalmente**: o `routes.py` só inclui esta rota se `settings.PAYMENT_PROVIDER == "dev"` (ou ela retorna `404` cedo). Internamente monta um payload `{external_reference, event_id, type}`, **assina com o `PAYMENT_WEBHOOK_SECRET`** e chama o **mesmo** `service.handle_event(...)` do webhook real — garantindo paridade de comportamento. Default `event="paid"`. Existe para o front simular "Confirmar pagamento" sem gateway externo.
- **#7 `POST /payments/orders/{id}/refund`** — admin: valida `status == paid` (senão `409`) → localiza a wallet do profissional dono → `credits.apply_movement(wallet, amount=+order.credits, transaction_type=refund, description="Estorno do pedido <id>", reference_id=order.id)` → se saldo já consumido tornaria o estorno impossível, a regra é **devolver os créditos do pedido** (entrada positiva, nunca deixa negativo — `refund` é `amount>0`, então não há risco de negativo aqui; o `402` listado cobre o caso futuro de "clawback"/estorno para baixo, que **não** se aplica a `refund` puro — ver §5.4) → `order.status=refunded`, `order.refunded_at=now` → `commit`. Reembolso **sempre em créditos**, nunca em dinheiro (payment-engine).

---

## 5. Fluxo ponta-a-ponta (idempotência + atomicidade)

### 5.1 Diagrama (compra de créditos)

```
Profissional escolhe pacote (front /credits → aba "Comprar")
        │  POST /payments/orders { package_id }
        ▼
PaymentService.create_order:
   valida pacote ativo → cria payment_orders (pending, snapshot amount/credits)
   → flush → provider.create_charge(order) → grava external_reference/pix_code/checkout_url
   → commit                                   (NÃO credita)
        │  201 { ..., pix_code, checkout_url, external_reference, status: "pending" }
        ▼
Front exibe PIX/checkout. Em DEV: botão "Confirmar pagamento (simulado)".
        │
        ├── (real)  Gateway processa pagamento → envia webhook assinado
        │              POST /payments/webhook  (body + X-Webhook-Signature)
        └── (dev)   POST /payments/dev/confirm/{order_id} { event: "paid" }
                        (assina internamente e chama o MESMO handler)
        ▼
PaymentService.handle_event(ProviderEvent):  ── transação ÚNICA ──
   1. localizar order por external_reference (UNIQUE)
   2. SELECT order FOR UPDATE  (lock)
   3. se order.status == paid OU provider_event_id já setado → NO-OP (200)   ← idempotência
   4. se event.status == paid e order.status == pending:
        a. carregar wallet do profissional (get_or_create_wallet, for_update=True)
        b. credits.apply_movement(wallet, amount=+order.credits,
              transaction_type=purchase, reference_id=order.id,
              description="Compra do pacote <name>")     ← grava CreditTransaction
        c. order.status=paid, order.paid_at=now,
           order.provider_event_id=event.provider_event_id,
           order.credit_transaction_id=tx.id
      se event.status == failed: order.status=failed, failed_reason=...
      se event.status == refunded: (tratar como refund — normalmente via endpoint admin)
   5. commit  (créditos + status do pedido na MESMA transação → tudo-ou-nada)
        ▼
Saldo atualizado. Front invalida queries (balance, history, orders) → mostra novo saldo.
(Notificação de saldo: payload da resposta atualiza o saldo no front; push/email é fase futura.)
```

### 5.2 Atomicidade (regra dura)
- O crédito (`apply_movement` → `CreditTransaction` + `wallet.balance`) e a transição `order.status=paid` ocorrem **no mesmo `commit`**. Se algo falhar, **rollback total**: nem credita, nem marca pago. (`apply_movement` **não** commita — o `PaymentService.handle_event` commita; mesma disciplina das Fases 2–5.)
- A wallet é travada (`get_or_create_wallet(..., for_update=True)`), igual à compra de lead.

### 5.3 Reentrância segura do webhook (idempotência)
- **Mesmo evento 2×:** a checagem `status == paid`/`provider_event_id` setado sob `FOR UPDATE` faz o segundo processamento ser **no-op** → `200`, **sem** segundo `purchase`.
- **Corrida concorrente (dois callbacks simultâneos):** o `UNIQUE(provider_event_id)` falha na segunda gravação → `IntegrityError` capturado → tratado como duplicado → `200`. Nunca dois `CreditTransaction` `purchase` para o mesmo pedido.
- **`external_reference` desconhecido:** `404` (pedido não existe) — não credita.
- Garantia final: **um pedido `paid` ⇒ exatamente uma `CreditTransaction(type=purchase, reference_id=order.id)`**.

### 5.4 Estorno/refund (atomicidade)
- `POST /orders/{id}/refund` faz, num único `commit`: `apply_movement(amount=+order.credits, type=refund, reference_id=order.id)` + `order.status=refunded` + `order.refunded_at=now`.
- `refund` é entrada positiva (`amount > 0`) → não há violação de saldo ≥ 0. O `402` do contrato fica reservado para um **clawback** futuro (estornar créditos já gastos), que **não** está no escopo desta fase.

---

## 6. Seeds (pacotes iniciais)

Conforme `payment-engine.md`, em `price_cents` (BRL):

| name | credits | price (R$) | `price_cents` | `currency` | `active` |
|------|---------|------------|---------------|------------|----------|
| Starter | 10 | 19,90 | `1990` | `BRL` | `true` |
| Profissional | 50 | 69,90 | `6990` | `BRL` | `true` |
| Avançado | 100 | 119,90 | `11990` | `BRL` | `true` |
| Elite | 250 | 249,90 | `24990` | `BRL` | `true` |
| Empresarial | 500 | 449,90 | `44990` | `BRL` | `true` |

- **Implementação:** `app/db/seeds/credit_packages.py` (idempotente — `INSERT ... ON CONFLICT (name) DO NOTHING` ou check por `name` antes de inserir), executado pelo runner de seeds existente; **ou** migration de dados Alembic. **Decisão:** seed idempotente em script (não migration), para poder re-rodar em dev sem duplicar; rodar no bootstrap/`make seed`. Registrar `name` como chave lógica do upsert.
- **Idempotência do seed:** garantir que rodar 2× não cria duplicatas (sem UNIQUE em `name` na tabela por ora — o seed checa existência por `name`; se preferir reforço, adicionar `UNIQUE(name)` é aceitável, mas opcional — ver §10).

---

## 7. Configuração (variáveis de ambiente)

Adicionar em **`backend/app/core/config.py`** (classe `Settings`) e em **`backend/.env.example`** (e replicar no `.env.example` da raiz se o projeto mantiver os dois sincronizados):

```python
# app/core/config.py — ADIÇÕES (bloco "Pagamentos / Fase 6")
PAYMENT_PROVIDER: str = "dev"                  # dev | mercadopago | stripe ...
PAYMENT_WEBHOOK_SECRET: str = "troque-este-webhook-secret-em-producao"  # HMAC do webhook
PAYMENT_CURRENCY: str = "BRL"                  # moeda padrão dos pacotes/pedidos
PAYMENT_DEV_CHECKOUT_BASE: str = "http://localhost:3000/credits"  # base da URL fake de checkout (dev)
# Futuro (NÃO usados pelo DevPaymentProvider; documentados p/ provedores reais):
# MP_ACCESS_TOKEN: str = ""
# MP_WEBHOOK_SECRET: str = ""
# STRIPE_API_KEY: str = ""
# STRIPE_WEBHOOK_SECRET: str = ""
```

```dotenv
# .env.example — ADIÇÕES
# Pagamentos (Fase 6)
PAYMENT_PROVIDER=dev
PAYMENT_WEBHOOK_SECRET=troque-este-webhook-secret-em-producao
PAYMENT_CURRENCY=BRL
PAYMENT_DEV_CHECKOUT_BASE=http://localhost:3000/credits
# Provedores reais (futuro — manter comentado no MVP):
# MP_ACCESS_TOKEN=
# MP_WEBHOOK_SECRET=
# STRIPE_API_KEY=
# STRIPE_WEBHOOK_SECRET=
```

> `Settings` já usa `extra="ignore"` e `case_sensitive=False` — as novas variáveis carregam direto. Em produção, `PAYMENT_WEBHOOK_SECRET` é obrigatório e forte; nunca usar o default.

---

## 8. Frontend (`/credits` — comprar créditos)

> Next.js 14 (App Router), TS, Tailwind, Shadcn, React Query, Zustand, RHF, Zod (mesma stack das Fases 2–5). A rota `/credits` **já existe** (`src/app/credits/page.tsx`) com `balance-card.tsx`/`transaction-list.tsx`. Esta fase **acrescenta** a aba/sessão "Comprar créditos".

### 8.1 Módulo `src/modules/payments/`
```
src/modules/payments/
├── api.ts          # chamadas tipadas: getPackages, createOrder, getOrder, devConfirm, listOrders
├── hooks.ts        # React Query: usePackages, useCreateOrder, useOrder(id), useDevConfirm
├── schemas.ts      # Zod espelhando PaymentOrderCreate (package_id)
├── types.ts        # CreditPackage, PaymentOrder, PaymentOrderStatus (espelham *Read do backend)
└── components/
    ├── package-card.tsx        # nome, créditos, preço formatado (price_cents/100), botão "Comprar"
    ├── package-grid.tsx        # lista de pacotes ativos (GET /payments/packages)
    ├── order-dialog.tsx        # modal pós-criação: mostra pix_code (copiar) / checkout_url
    └── dev-confirm-button.tsx  # SÓ em modo dev: "Confirmar pagamento (simulado)"
```

### 8.2 Comportamento da tela `/credits`
1. **Saldo** no topo (`balance-card.tsx` existente — `GET /credits/balance`).
2. **Vitrine de pacotes**: `package-grid` consome `GET /payments/packages` (ativos). Cada card mostra `name`, `credits`, **preço formatado** (`price_cents/100` → `R$ 19,90`, `Intl.NumberFormat('pt-BR', {style:'currency', currency})`).
3. **Comprar**: clicar "Comprar" → `POST /payments/orders {package_id}` → abre `order-dialog` com o `pix_code` (botão **copiar**) e/ou link `checkout_url`, e o `status` (`pending`).
4. **Modo dev** (detectado por `NEXT_PUBLIC_PAYMENT_PROVIDER === "dev"`): o dialog mostra o botão **"Confirmar pagamento (simulado)"** → `POST /payments/dev/confirm/{order_id} {event:"paid"}`. Ao sucesso:
   - **invalidar** as queries: `['credits','balance']`, `['credits','history']`, `['payments','orders']`;
   - fechar o dialog e exibir toast "Créditos adicionados!";
   - o `balance-card` re-busca e mostra o **novo saldo** (notificação de saldo do fluxo).
5. **Histórico de pedidos** (opcional na mesma página): `GET /payments/orders` paginado, com status (badge `pending|paid|failed|refunded|cancelled`).
6. Em **produção** (`PAYMENT_PROVIDER != dev`): o botão simulado **não** aparece; o usuário paga no `checkout_url`/PIX e o saldo atualiza quando o webhook confirmar (front pode fazer polling do `GET /payments/orders/{id}` até `paid`, ou refetch ao voltar à aba).

### 8.3 Variável de ambiente do front
- `NEXT_PUBLIC_PAYMENT_PROVIDER=dev` (espelha o backend; só controla a exibição do botão simulado). Documentar no `.env.example` do front.

### 8.4 Princípios
- Backend é a fonte da verdade do preço/créditos; o front **nunca** envia `amount`/`credits` — só `package_id`.
- React Query: mutations de compra/confirmação **invalidam** saldo+histórico+pedidos.
- Formatar dinheiro sempre a partir de `price_cents` (inteiro); nunca somar/exibir float cru.

---

## 9. Segurança / Auditoria e Simplificações do MVP

### 9.1 Segurança (obrigatório — payment-engine §Segurança)
- **Webhook assinado:** HMAC-SHA256 do **corpo cru** com `PAYMENT_WEBHOOK_SECRET`, comparação `hmac.compare_digest`. Assinatura inválida/ausente → `401`. O caminho dev passa pela mesma verificação.
- **Idempotência:** `UNIQUE(external_reference)` + `UNIQUE(provider_event_id)` + checagem de `status` sob `FOR UPDATE` (§2.4 / §5.3). Mesmo evento nunca credita 2×.
- **Atomicidade:** crédito + transição de status no mesmo `commit` (§5.2).
- **RBAC/ownership:** criar/listar pedidos só `professional`; ver pedido só o **dono**; refund só `admin`; `dev/confirm` só dono ou admin **e** só em `PAYMENT_PROVIDER=dev`.
- **Mass assignment / IDOR:** cliente só envia `package_id` (e `event`/`reason`); `user_id`/`amount_cents`/`credits`/`status`/`external_reference` derivados do servidor; sempre usar `current_user`, nunca id do corpo.
- **Crédito só no `paid`:** nunca creditar na criação do pedido (regra fechada do enunciado).
- **Reembolso só em créditos:** nunca dinheiro (payment-engine).
- **Dinheiro em centavos (int):** sem float em valores monetários.

### 9.2 Auditoria
- **Trilha financeira imutável:** todo crédito gera `CreditTransaction` append-only (já garantido por `apply_movement`); `payment_orders` nunca é apagado (transições de status, com `paid_at`/`refunded_at`/`failed_reason`).
- **`AUDIT_LOGS` (tabela canônica do doc 04):** registrar ações administrativas (refund) com `user_id`/`action`/`entity=payment_order`/`entity_id`/`ip_address`/`user_agent` **se** a infra de audit log já existir; caso não exista no backend atual, **registrar como pendência** (não criar a tabela nesta fase — está fora do escopo). O payment-engine pede `usuário/valor/data/IP/origem/resultado`: o mínimo viável é o par `payment_orders` + `credit_transactions` (com `reference_id`/`credit_transaction_id` correlacionando). IP/User-Agent na auditoria de refund ficam para a fase de segurança se o audit log ainda não estiver pronto.

### 9.3 Simplificações assumidas no MVP
1. **Provedor DEV** (`PAYMENT_PROVIDER=dev`): cobrança fake (pix_code/checkout_url sintéticos), confirmação via `POST /payments/dev/confirm/{order_id}`. Sem chaves externas, sem rede.
2. **Sem provedores reais** (MP/Stripe): apenas a interface e a documentação de plug-in. Trocar provedor = nova classe + `PAYMENT_PROVIDER` + chaves.
3. **Idempotência sem tabela `payment_events` nem Redis:** unicidade no `payment_orders` (`external_reference`, `provider_event_id`) + lock + checagem de status.
4. **PIX/cartão não diferenciados** no dev: o pedido carrega `pix_code` **e** `checkout_url` fakes; o "método" não é modelado nesta fase (campo de método de pagamento é futuro).
5. **Sem cancelamento pelo usuário:** `cancelled` existe no enum mas não há endpoint de cancelamento do próprio pedido; reservado para transição via provedor/admin.
6. **Sem chargeback** (bloqueio de créditos/suspensão/fila) — citado, não implementado.
7. **Sem painel financeiro admin** (relatórios/MRR/ARR/LTV) — apenas refund pontual + listagem do próprio histórico.
8. **Notificação de saldo = payload + invalidação de cache** no front; push/email é fase de notificações.
9. **Refund = devolução simples em créditos** (`amount>0`); clawback/estorno para baixo (saldo já gasto) fora do escopo.
10. **Audit log dedicado** (IP/UA/origem) só se a tabela `audit_logs` já existir; caso contrário, a trilha é `payment_orders` + `credit_transactions` e fica registrada a pendência.

---

## 10. Decisões tomadas neste contrato (registro)

1. **`credit_packages.price` → `price_cents` (int, centavos)** + `currency`, `created_at`, `updated_at`. Dinheiro nunca em float. (Extensão do doc 04.)
2. **`payment_orders`: `gateway` → `provider`; `amount` → `amount_cents`**; + `credits`, `currency` (snapshots do pacote), `provider_event_id` (UNIQUE — idempotência), `pix_code`, `checkout_url`, `refunded_at`, `failed_reason`, `credit_transaction_id` (rastreio da movimentação), `updated_at`. Enum ganha `cancelled`. (Extensão do doc 04.)
3. **Idempotência sem tabela extra e sem Redis:** `UNIQUE(external_reference)` + `UNIQUE(provider_event_id)` + `SELECT ... FOR UPDATE` + checagem de `status`. (Decisão explícita pedida no enunciado.)
4. **`PaymentProvider`** (interface) + **`DevPaymentProvider`** ativo por `PAYMENT_PROVIDER=dev`; factory por config; MP/Stripe documentados, não implementados.
5. **Pasta `app/services/payments/`** (provedores + `service.py` `PaymentService`), evitando colisão arquivo↔pacote. Rotas em `app/api/payments/routes.py` (dir já existe). Uma linha no agregador `_FEATURE_ROUTERS`.
6. **Crédito só no `paid`**, via `credits.apply_movement(transaction_type=purchase, reference_id=order.id)`, **dentro da mesma transação** da transição de status (atomicidade).
7. **`dev/confirm` passa pela mesma verificação HMAC** do webhook real (assina internamente) e só é montado quando `PAYMENT_PROVIDER=dev`.
8. **Refund admin** = `apply_movement(type=refund, amount=+order.credits)` + `order.refunded_at` + `status=refunded`; sempre em créditos.
9. **Seed idempotente** de 5 pacotes (Starter→Empresarial) em `price_cents`, chave lógica `name`. `UNIQUE(name)` na tabela é **opcional** (reforço) — pedir OK se quiser adicionar.
10. **Frontend** acrescenta módulo `src/modules/payments/` e a aba "Comprar créditos" na `/credits` existente; botão simulado gated por `NEXT_PUBLIC_PAYMENT_PROVIDER=dev`.

> **Pendências para aprovação (não improvisar):** (a) `UNIQUE(name)` em `credit_packages` (opcional); (b) integração com `audit_logs` para o refund (depende da tabela já existir); (c) confirmar se o `.env.example` da raiz deve espelhar as novas variáveis ou só o do backend.
