# TrampoJá — Frontend

Esqueleto do frontend do **TrampoJá**: Next.js 14 (App Router) + TypeScript + TailwindCSS + Shadcn UI (base) + React Query + Zustand + React Hook Form + Zod.

## Pré-requisitos

- Node 20+

## Setup

```bash
npm install
cp .env.local.example .env.local   # define NEXT_PUBLIC_API_URL
```

## Scripts

```bash
npm run dev        # ambiente de desenvolvimento (http://localhost:3000)
npm run build      # build de produção
npm run start      # serve o build de produção
npm run lint       # eslint (next/core-web-vitals)
npm run typecheck  # tsc --noEmit
```

## Estrutura

```
src/
├── app/              # App Router (layout, page, providers, globals.css)
├── components/ui/    # base shadcn (button.tsx)
├── modules/          # módulos de negócio (auth, dashboard, leads, ...)
├── hooks/            # hooks compartilhados
├── services/         # cliente HTTP (api.ts) usando NEXT_PUBLIC_API_URL
├── store/            # estado global (zustand)
├── types/            # tipos compartilhados
└── lib/utils.ts      # cn() helper
```
