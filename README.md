# TrampoJá

**Marketplace Inteligente de Prestadores de Serviços Locais.**

Conecta contratantes que precisam de um serviço a profissionais disponíveis na sua região.
Não é um catálogo — é um **marketplace de oportunidades (leads)**: o profissional usa créditos para acessar oportunidades qualificadas.

> ⚠️ **Estágio atual:** fase de **documentação**. Nenhum código de aplicação foi escrito ainda.

---

## 📚 Documentação

Toda a especificação do produto está em [`docs/`](docs/).

👉 **Comece pelo [Checklist de Execução](docs/00-CHECKLIST-EXECUCAO.md)** e pelo [índice da documentação](docs/README.md).

| Tema | Documento |
|------|-----------|
| Visão geral + fases | [master-task](docs/01-projeto/master-task.md) |
| Arquitetura | [marketplace-architecture](docs/03-arquitetura/marketplace-architecture.md) |
| Banco de dados | [database-schema](docs/04-banco-de-dados/database-schema.md) |
| Motores | [lead](docs/02-lead-engine/lead-engine.md) · [payment](docs/05-payment-engine/payment-engine.md) · [matching](docs/06-matching-engine/matching-engine.md) · [reputation](docs/07-reputation-engine/reputation-engine.md) · [gamification](docs/08-gamification-engine/gamification-engine.md) |
| Specs complementares | [admin](docs/09-admin-panel/admin-panel-spec.md) · [notification](docs/10-notification-engine/notification-engine.md) · [chat](docs/11-chat-engine/chat-engine.md) · [search](docs/12-search-engine/search-engine.md) · [analytics](docs/13-analytics/analytics-spec.md) · [referral](docs/14-referral-engine/referral-engine.md) · [verification](docs/15-verification-engine/verification-engine.md) · [support](docs/16-support-center/support-center-spec.md) · [security](docs/17-security/security-spec.md) · [future-ai](docs/18-future-ai-engine/future-ai-engine.md) |

---

## 🏗️ Stack planejada

- **Frontend:** Next.js · TypeScript · TailwindCSS · Shadcn UI · React Query · Zustand
- **Backend:** FastAPI · Python · SQLAlchemy · Alembic · Pydantic
- **Banco:** PostgreSQL · **Cache:** Redis · **Storage:** S3-compatible (MinIO em dev, Cloudflare R2 em produção)

## 🗺️ Roadmap de alto nível

Versão **WEB** primeiro (10 fases — ver [checklist](docs/00-CHECKLIST-EXECUCAO.md)), depois apps **Android/iOS**, e por fim camada de **IA** (recomendações, ranking inteligente, antifraude).
