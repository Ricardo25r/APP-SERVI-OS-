# FazTudo — Instruções do Projeto

Marketplace de prestadores de serviços locais (leads pagos por créditos). Monorepo: `backend/` (FastAPI), `frontend/` (Next.js 14), `infra/` (Docker), `docs/`, `design-system/`.

---

## 🎨 DIRETRIZ PRINCIPAL — DESIGN SYSTEM (seguir à risca)

> **ANTES de QUALQUER mudança visual/UI/frontend, LEIA o design system em [`design-system/`](design-system/) e siga-o à risca.**
> Fonte da verdade: [`design-system/FazTudo-Design-System.html`](design-system/FazTudo-Design-System.html) + [`design-system/tokens.css`](design-system/tokens.css).

**Regras inegociáveis:**
1. **Nunca** usar cor, fonte ou raio hardcoded em componente. **Sempre via token** (`bg-primary`, `bg-brand`, `text-brand`, `bg-background`, `text-muted-foreground`, escalas `blue-*`/`orange-*`). Os tokens vivem em `frontend/src/app/globals.css` + `frontend/tailwind.config.ts`.
2. **Marca FazTudo:** Azul Royal `#0D47A1` (primária) · Azul Marinho `#0A357D`/`#082A5E` · **Laranja `#FF6D00`** (acento/CTA, com parcimônia). Tipografia **Montserrat**. Tema **claro** sobre `#F5F7FA`, cards brancos, bordas `#E8EDF3`.
3. **Wordmark:** "Faz" + "*Tudo*" (o "Tudo" em itálico, na cor laranja).
4. Para mudar a identidade visual, mude **o token** (1 lugar) — nunca componente por componente.
5. Logos/mascotes em `frontend/public/brand/` (e `design-system/assets/`).
6. PT-BR em toda a UI. Sem emoji na UI.

> ⚠️ O zip do design system trouxe também um material da marca **"Inova Comunicação Visual"** (preto+dourado) — **ignorar**, não é o FazTudo. Ver `design-system/README.md`.

---

## ⚙️ Como rodar / verificar

- Ambiente: `docker compose --profile full up -d` (db/redis/minio/backend) + `npm --prefix frontend run dev` (frontend :3000). App: http://localhost:3000 · API: http://localhost:8000.
- **Alembic SEMPRE dentro do container**: `docker exec faztudo-backend python -m alembic ...` (o host→Postgres:5432 é bloqueado por firewall).
- Backend: `pytest` + `ruff` verdes antes de commitar. Frontend: `npm run build` + `npm run typecheck`.
- Migrations autogeradas no container; rodar `python -m app.seeds` para popular categorias/pacotes.

## 🧭 Método

- **Uma fase por vez** (ver `docs/00-CHECKLIST-EXECUCAO.md`). Cada fase: código + migrations + testes + documentação + checklist. Fases 1–6 concluídas; próxima: Fase 7 (Avaliações + Reputação).
- Identificadores de infra usam o slug `faztudo`. A pasta local no PC do dono é `C:\TrampoJa` (apenas o caminho).
