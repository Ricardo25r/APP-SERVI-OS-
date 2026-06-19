# 📚 Documentação — TrampoJá

> Marketplace Inteligente de Prestadores de Serviços Locais.
> Repositório: https://github.com/Ricardo25r/APP-SERVI-OS-

Esta pasta reúne toda a documentação estratégica e de produto do projeto.
Os documentos são organizados por tema.

👉 **Comece pelo [Checklist de Execução](00-CHECKLIST-EXECUCAO.md)** — é o nosso mapa para não nos perdermos.

---

## Índice

### 🧭 Coordenação

| # | Documento | Descrição |
|---|-----------|-----------|
| 00 | [Checklist de Execução](00-CHECKLIST-EXECUCAO.md) | Mapa do projeto: status da documentação, pendências de schema/conflitos e as 10 fases de implementação com checkboxes. |

### 📐 Documentos-fonte (enviados pelo cliente — fonte da verdade)

| # | Documento | Descrição |
|---|-----------|-----------|
| 01 | [Projeto / Master Task](01-projeto/master-task.md) | Visão geral, objetivo, perfis, MVP, arquitetura, segurança e as 10 fases de implementação. |
| 02 | [Lead Engine](02-lead-engine/lead-engine.md) | Motor de monetização e gamificação: leads, créditos, XP, níveis, medalhas, ranking, anti-fraude e KPIs. |
| 03 | [Arquitetura do Marketplace](03-arquitetura/marketplace-architecture.md) | Arquitetura oficial: stack, módulos, estrutura de pastas (backend/frontend), APIs, permissões, segurança e roadmap. |
| 04 | [Schema do Banco de Dados](04-banco-de-dados/database-schema.md) | Fonte oficial de modelagem: todas as tabelas, campos, constraints, índices e regras de integridade. |
| 05 | [Payment Engine](05-payment-engine/payment-engine.md) | Motor financeiro: fontes de receita, pacotes de créditos, premium, verificado, gateways, reembolsos, chargeback e auditoria. |
| 06 | [Matching Engine](06-matching-engine/matching-engine.md) | Distribuição de leads: elegibilidade, filtros, score, distribuição justa, fila, escassez, notificações e métricas. |
| 07 | [Reputation Engine](07-reputation-engine/reputation-engine.md) | Motor de reputação: score 0–1000, componentes e pesos, selos, anti-manipulação, antifraude e impacto no matching. |
| 08 | [Gamification Engine](08-gamification-engine/gamification-engine.md) | Motor de gamificação: XP, níveis, medalhas, missões, desafios, ranking, recompensas, temporadas e anti-abuso. |

### 🧩 Specs complementares (gerados a partir da fonte da verdade)

| # | Documento | Descrição |
|---|-----------|-----------|
| 09 | [Admin Panel](09-admin-panel/admin-panel-spec.md) | Painel administrativo: dashboard, gestão de usuários/leads/financeiro/créditos, moderação, KYC, auditoria, RBAC admin, relatórios. |
| 10 | [Notification Engine](10-notification-engine/notification-engine.md) | Notificações: in-app, email, push, sms, whatsapp (futuro), templates, eventos, antiflood, preferências, filas, retry. |
| 11 | [Chat Engine](11-chat-engine/chat-engine.md) | Chat interno: conversas por lead, abertura automática, permissões, anexos, bloqueios, moderação, retenção, tempo real. |
| 12 | [Search Engine](12-search-engine/search-engine.md) | Busca: profissionais, categorias, filtros, ordenação, relevância, cache Redis, indexação, geolocalização (futuro). |
| 13 | [Analytics](13-analytics/analytics-spec.md) | Métricas e KPIs: negócio, operacional, financeiro, retenção, cohort, funis, indicadores de marketplace. |
| 14 | [Referral Engine](14-referral-engine/referral-engine.md) | Programa de indicação: códigos, bônus, antifraude, limites, validações, campanhas, métricas (fator-k, CAC). |
| 15 | [Verification Engine](15-verification-engine/verification-engine.md) | Verificação de identidade / KYC: documento, selfie, validação manual e automática (futuro), bloqueios, LGPD. |
| 16 | [Support Center](16-support-center/support-center-spec.md) | Central de ajuda: tickets, SLA, categorias, anexos, escalonamento, base de conhecimento, atendimento, métricas. |
| 17 | [Security](17-security/security-spec.md) | Segurança: OWASP Top 10, IDOR, RBAC, JWT/refresh, rate limit, multi-tenant, soft delete, proteção financeira, LGPD. |
| 18 | [Future AI Engine](18-future-ai-engine/future-ai-engine.md) | IA futura (V3+): assistentes, recomendações, previsão de conversão, ranking inteligente, antifraude por IA. |

### ⚠️ Documento referenciado, porém ausente

| # | Documento | Situação |
|---|-----------|----------|
| — | `anti-fraud-engine.md` | Citado como fonte da verdade em vários documentos, mas **nunca enviado**. Pendência registrada no [Checklist](00-CHECKLIST-EXECUCAO.md). |

---

## Estrutura das pastas

```
docs/
├── README.md                          ← este índice
├── 00-CHECKLIST-EXECUCAO.md           ← mapa do projeto (começar aqui)
├── 01-projeto/master-task.md
├── 02-lead-engine/lead-engine.md
├── 03-arquitetura/marketplace-architecture.md
├── 04-banco-de-dados/database-schema.md
├── 05-payment-engine/payment-engine.md
├── 06-matching-engine/matching-engine.md
├── 07-reputation-engine/reputation-engine.md
├── 08-gamification-engine/gamification-engine.md
├── 09-admin-panel/admin-panel-spec.md
├── 10-notification-engine/notification-engine.md
├── 11-chat-engine/chat-engine.md
├── 12-search-engine/search-engine.md
├── 13-analytics/analytics-spec.md
├── 14-referral-engine/referral-engine.md
├── 15-verification-engine/verification-engine.md
├── 16-support-center/support-center-spec.md
├── 17-security/security-spec.md
└── 18-future-ai-engine/future-ai-engine.md
```

---

## Status

| Etapa | Situação |
|-------|----------|
| Coleta de documentação | ✅ concluída (18 documentos) |
| Specs complementares | ✅ gerados (09–18) |
| Documento `anti-fraud-engine.md` | ⛔ pendente (referenciado, não enviado) |
| Desenho técnico / decisões de schema | 🟡 pendências mapeadas no checklist |
| Implementação | ⛔ não iniciada |

> ⚠️ **Nenhum código de aplicação foi escrito ainda.** Esta fase é apenas de documentação.
