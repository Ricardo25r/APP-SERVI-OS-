# Site institucional FazTudo — Design/Spec

> Brainstorm de 2026-07-20. Base visual: mockup do Claude Design em
> `Downloads/FazTudo Site.dc.html` (7 páginas, mobile + desktop).

## Objetivo

Site institucional público (não é a "cara de app"), servido pelo mesmo Next.js.
Dois públicos: **contratante** e **profissional**. Canal de captação + apresentação
da marca. Compra de crédito **não** aparece no site público (fica na área logada).

## Decisões

- **Sitemap:** Home, Para contratantes, Para profissionais, Categorias, Sobre,
  Contato/Suporte, Baixar o app. (Termos/Privacidade reaproveitados do app; Blog depois.)
- **Sem preço** em nenhuma página pública.
- **Download em "Em breve":** app ainda não publicado nas lojas. Selos App Store /
  Google Play desabilitados + captura de e-mail ("Avise-me").
- **Detecção navegador × app:** usa `useIsNativeApp()`. No navegador, `/` mostra a
  home institucional; dentro do app nativo, `/` segue para `/splash` (fluxo do app).

## Arquitetura

- Grupo de rotas `frontend/src/app/(site)/` com `layout.tsx` próprio
  (`MarketingShell` = header + footer de marketing).
- `SiteHeader` (app) e `AppChrome` (bottom-nav) do `layout.tsx` global se ocultam
  nas rotas de marketing.
- Componentes em `frontend/src/modules/site/`: `marketing-header`, `marketing-footer`,
  `marketing-shell`, `app-store-badges`, `notify-me-form`, `site-config`, seções da home.
- **Tokens do design system** (regra nº1 do CLAUDE.md): nada hardcoded — mapear as
  cores do mockup para `bg-primary`, `bg-brand`, `blue-*`, `orange-*`, `bg-background`,
  `border`, `text-muted-foreground`, `text-success`.
- Assets reais de `public/brand/`: `symbol.png`, `wordmark.png`, `mascote-faz.png`,
  `mascote-tudo.png` (já existem).
- Páginas = Server Components (com `metadata` p/ SEO); partes interativas = client.
- Formulários (`avise-me`, contato) fazem `apiPost` para a API (build é export estático).

## Melhorias sobre o mockup

- Depoimentos fictícios removidos → seção honesta de confiança (sem nomes/notas falsos).
- Dados de contato centralizados em `site-config.ts` (placeholders marcados TODO até ter reais).
- HTML semântico, `alt`, aria-labels, foco/acessibilidade.

## Fases

1. Fundação + Home (grupo de rotas, shell, header/footer, badges, avise-me, tokens) + wiring `/`.
2. Páginas: Para contratantes, Para profissionais, Categorias, Sobre, Contato, Baixar.
3. Backend: endpoints `waitlist` (avise-me) e contato + migration.

## Pendências para o dono

- Dados reais de contato (WhatsApp, e-mail, cidade — provavelmente Ariquemes-RO).
- Decidir depoimentos (reais ou manter seção de confiança sem depoimentos).
