# Fluxo de serviço — casos, riscos e resolução (anti no-show / confiança)

Documento vivo. Mapeia as variáveis dos **dois lados** (profissional e contratante)
no ciclo do lead → desbloqueio → contato → chegada → conclusão, e as decisões de
produto para resolver cada uma. Atualizar os status à medida que implementamos.

**Legenda:** ✅ feito · 🔜 em andamento · ⬜ pendente · 💬 decisão de produto.

---

## Princípio central

O **código de chegada** resolve "o profissional mente que foi". Mas cria o
espelho: o **cliente** pode mentir, sumir ou não estar em casa, punindo um
profissional honesto. Como o profissional é quem **paga**, perder a confiança
dele esvazia o app. Por isso o eixo é **justiça nos dois lados + provas**.

---

## Decisões de produto (💬)

- **D1 — Prova de presença por GPS.** Quando o profissional não consegue o código
  (cliente ausente/recusou), ele faz um *check-in* com a localização. Se estiver
  perto do local do serviço (≤ `PRESENCE_TOLERANCE_METERS`, default 500 m), a
  presença é **comprovada automaticamente**: a vaga reabre, o crédito é
  **devolvido** ao profissional e o **cliente** leva um não-comparecimento. Sem
  GPS / fora do raio / lead sem coordenadas → orientar a abrir chamado no Suporte
  (sem reembolso automático, sem punir o profissional). Evita auto-reembolso
  exploável (o profissional precisa estar fisicamente no local).
- **D2 — Reputação dos dois lados.** Profissional tem `no_show_count`; cliente
  passa a ter `client_no_show_count` (sumiço/ausência/recusa comprovada).
- **D3 — Chegada ≠ conclusão.** Confirmar chegada (código) não fecha o serviço; o
  cliente confirma a **conclusão** depois, e isso libera a **avaliação mútua**.
- **D4 — Agendamento define o prazo.** A data/hora combinada no app define o prazo
  de reabertura automática (em vez de 7 dias fixos).
- **D5 — Disputa via Suporte (MVP).** Enquanto não há arbitragem dedicada, casos
  não resolvidos automaticamente vão para o Suporte (admin decide: devolver
  crédito / remover nota injusta).

---

## Checklist por bloco

### Bloco 0 — Base já no ar ✅
- ✅ Código de chegada (cliente mostra; profissional digita).
- ✅ Cliente marca "não compareceu" → reabre, sem reembolso, +1 no_show do pro.
- ✅ Worker reabre sozinho após o prazo sem chegada.

### Bloco 1 — Proteção do profissional (cliente ausente/recusou) ✅
- ✅ Backend: `User.client_no_show_count`; endpoint `POST /lead-purchases/{id}/cliente-ausente`
  com prova de presença (GPS ≤ `PRESENCE_TOLERANCE_METERS`=500 m do local) →
  reembolsa + reabre + marca o cliente (D1, D2).
- ✅ Frontend: botão "Cliente não estava / recusou o código" (captura a localização).
- ✅ Fallback Suporte quando a presença não pode ser comprovada (fora do raio / sem GPS / lead sem coordenadas) (D5).

### Bloco 2 — Conclusão + avaliação mútua ✅
- ✅ Cliente confirma "serviço concluído" (`POST /lead-purchases/lead/{id}/concluir`)
  → fecha o lead (`closed`) e notifica o profissional (D3).
- ✅ Avaliação mútua **já existia** (POST `/reviews`, tela `/avaliacoes`,
  recalcula reputação de pro **e** cliente). Confirmado que fechar o lead **não**
  bloqueia avaliações (os reviews não filtram por status).
- ✅ Telas: botão "Confirmar conclusão" + "Avaliar profissional" no detalhe da
  solicitação (cliente).

### Bloco 3 — Cancelamento e agendamento ✅
- ✅ Profissional "desistir" (`POST /lead-purchases/{id}/desistir`) → libera a
  vaga (sem reembolso, **sem** marca de no-show — desistir é melhor que sumir).
- ✅ Cliente cancela (`POST /lead-purchases/lead/{id}/cancelar`) → **reembolsa** o
  profissional e encerra (`cancelled`).
- ✅ Data/hora combinada (`POST /lead-purchases/{id}/agendar`, coluna
  `scheduled_at`, migration `fase 19`) → redefine o prazo de reabertura
  (`scheduled_at` + `NO_SHOW_GRACE_HOURS`) (D4).
- ⬜ Código só aparece perto do horário — adiado p/ o Bloco 6 (polimento).

### Bloco 4 — Reputação, consequências e disputa ✅ (parcial)
- ✅ Consequência do `no_show_count`: acima de `MARKETPLACE_MAX_NO_SHOWS` (5) o
  profissional fica **suspenso da compra** (403 "fale com o suporte").
- ✅ Reputação do cliente visível ao profissional (`customer_no_show_count` no
  `LeadRead` + alerta na tela da oportunidade).
- ⬜ Preservar a conversa ao reabrir → **adiado** (exige trocar o `UNIQUE` de
  `conversations`; baixo ganho enquanto não houver disputa formal).
- ✅ Contestação/disputa via **Suporte** (`/suporte` já existe → admin decide) — D5.

### Bloco 5 — Qualidade do lead e anti-fraude
- ⬜ Admin marca lead como inválido/falso → reembolsa os profissionais.
- ⬜ Profissional reporta lead suspeito.
- ⬜ Limite de criação de leads (anti-spam).

### Bloco 6 — Brechas do código de chegada
- ⬜ Aviso "só mostre o código em pessoa" (texto na UI).
- ⬜ Expirar/rotacionar o código.

---

## Histórico de implementação

- ✅ **Bloco 1** — "cliente ausente/recusou o código" com prova de presença por
  GPS: reembolsa o profissional, reabre a vaga e marca o cliente. Backend +
  frontend + migration `fase 18` (`users.client_no_show_count`) + testes (135 no
  total). No ar.
- ✅ **Bloco 2** — conclusão do serviço (cliente fecha o lead) + avaliação mútua
  (já existia; validada com o lead fechado). Backend + frontend, sem migration
  (usa o status `closed`). 137 testes. No ar.
- ✅ **Bloco 3** — desistência (pro), cancelamento (cliente, com reembolso) e
  agendamento (`scheduled_at` define o prazo). Backend + frontend + migration
  `fase 19`. 140 testes. No ar.
- ✅ **Bloco 4** (parcial) — suspensão por excesso de no-show + reputação do
  cliente visível ao profissional; disputa via Suporte. Sem migration. 141 testes.
- ➡ Próximo: **Bloco 5** (qualidade do lead/anti-fraude), **Bloco 6** (brechas
  do código) + auditoria final.
