# 📱 FazTudo — Telas de Referência (UI/UX) — DIRETRIZ VISUAL

> Mockups oficiais do app. **Toda adaptação de interface deve seguir estas telas + os tokens do design system** (`../tokens.css`). Fluxo completo de telas em [`FLUXO-TELAS.md`](FLUXO-TELAS.md).
> ⚠️ As referências são **mobile-first** (consumer/profissional) e **desktop** (admin). O frontend é web responsivo → adaptar a linguagem, mobile-first.

## Linguagem visual (extraída dos mockups)

- **Cores:** header/topo **azul `#0D47A1`** (texto branco); corpo **`#F5F7FA`**; cards **brancos** arredondados (raio ~16–18px) com sombra suave; **laranja `#FF6D00`** para CTAs, FAB e destaques; **verde** (`--success`) para positivo/concluído; badges de status em pílula (aberto/em andamento/finalizado/verificado).
- **Navegação mobile:** **bottom tab bar** fixa com 5 itens — **Início · Solicitações(Leads) · FAB laranja "＋" (centro) · Mensagens(badge) · Perfil**. Ícones lucide; item ativo em azul.
- **Header do app:** barra azul com título centralizado (telas internas) OU logo `FazTudo` + sino de notificações + avatar (home).
- **Componentes recorrentes:**
  - **IconChip:** quadrado arredondado com fundo tonal (azul/laranja/verde claro) + ícone colorido — usado em listas e categorias.
  - **Cards de lista:** ícone-chip + título + subtítulo + chevron/ação à direita.
  - **StatCard:** rótulo pequeno + número grande (ex.: créditos comprados/usados).
  - **BalanceCard:** card azul/gradiente com saldo grande (créditos + R$) e ações.
  - **Avatar** com inicial/foto; **estrelas** de avaliação; **badge "Verificado"**.
  - **SectionHeader:** título + link "Ver todas".
  - **Busca:** input com lupa; **CTA laranja** grande ("Criar solicitação agora", "Comprar créditos").
  - **Grid de categorias:** chips com ícone + nome.
  - **Abas/segmented:** (ex.: Notificações: Todas/Não lidas/Leads/Sistema).
  - **EmptyState** e **estados de loading/erro** sempre presentes.

## Mapeamento Telas → rotas web (existentes vs a construir)

| Telas (fluxo) | Rota web | Status |
|---|---|---|
| 25 Splash · 26 Onboarding | `/` (landing) | redesenhar p/ herói + mascotes |
| 09 Login/Cadastro · 27 Recuperar senha · 10 Escolha de perfil | `/login` `/register` | redesenhar |
| 01 Home Contratante · 36 Dashboard | `/` autenticado (customer) | criar home logada |
| 12 Categorias · 02 Nova Solicitação · 13 Minhas Solicitações · 14 Detalhes | `/leads`, `/leads/new`, `/leads/[id]` | redesenhar |
| 31 Propostas · 32 Contratar · 33 Serviço andamento · 30 Histórico | (parcial — pós-MVP) | futuro |
| 03 Home Profissional · 04 Detalhes Lead · 05 Comprar Créditos · 20 Carteira | `/marketplace`, `/credits` | redesenhar |
| 06 Chat · 15 Lista de Conversas | `/conversas`, `/conversas/[id]` | redesenhar |
| 18 Avaliar · (reviews) | `/avaliacoes` | redesenhar |
| 24 Gamificação · ranking | `/gamificacao`, `/ranking` | redesenhar |
| 16/07 Perfil · 21 Configurações · 22 Suporte | `/profile` (+ /configuracoes, /suporte) | redesenhar |
| 19 Notificações · 38 Notif. avançadas | `/notificacoes` (criar) | criar |
| 08 Dashboard Admin · 34 Financeiro · 35 Moderação | `/admin/*` | refinar (desktop) |
| 17 Cadastro Profissional · 28 KYC · 29 Aprovação | (perfil prof. + futuro KYC) | parcial/futuro |
| 23 Mapa | (futuro — geo é V2) | futuro |

## Checklist de adaptação visual (UI)

- [ ] **Fundação:** app-shell (AppHeader azul + BottomNav mobile) + primitivos (IconChip, StatCard, BalanceCard, SectionHeader, StatusBadge, Avatar, EmptyState, SearchInput).
- [ ] Landing/onboarding (herói + mascotes + CTA).
- [ ] Login / Cadastro / Recuperar senha (visual das telas 09/27).
- [ ] Home logada (contratante e profissional / dashboard 36).
- [ ] Leads: lista, nova solicitação, detalhes (telas 13/02/14) + categorias (12).
- [ ] Marketplace profissional + Detalhes do lead (03/04).
- [ ] Créditos / Carteira (05/20) — BalanceCard + histórico.
- [ ] Conversas + Chat (15/06).
- [ ] Avaliações (18) · Gamificação/Ranking (24).
- [ ] Perfil · Configurações · Suporte (16/07/21/22).
- [ ] Notificações (19/38).
- [ ] Admin desktop refinado (08/34/35).
- [ ] Responsividade (mobile bottom-nav ↔ desktop), a11y, estados loading/erro/vazio.

> Regra: **somente tokens** (sem cor hardcoded), Montserrat, PT-BR, `next/image` para mascotes/ícones PNG. Manter funcionalidade/rotas existentes — só a camada visual muda.
