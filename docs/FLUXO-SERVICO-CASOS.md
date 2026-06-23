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

### Bloco 3 — Cancelamento e agendamento
- ⬜ Profissional "desistir" da compra → libera a vaga (sem reembolso).
- ⬜ Cliente cancela a solicitação após desbloqueio → reembolsa o profissional.
- ⬜ Data/hora combinada no app define o prazo de reabertura (D4).
- ⬜ Código de chegada só aparece perto do horário combinado.

### Bloco 4 — Reputação, consequências e disputa
- ⬜ Consequências do `no_show_count` (aviso → ocultar do marketplace → suspender).
- ⬜ Reputação do cliente visível/consequente.
- ⬜ Preservar a conversa ao reabrir (hoje é apagada) → prova.
- ⬜ Contestação/disputa (via Suporte no MVP — D5).

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
- ➡ Próximo: **Bloco 3** (cancelamento + agendamento).
