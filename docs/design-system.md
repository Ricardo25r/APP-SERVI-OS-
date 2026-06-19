# 🎨 Design System — FazTudo

> **Fonte única da verdade visual.** Mude aqui (e nos tokens em `frontend/src/app/globals.css`) e **todas as telas mudam juntas**. Nenhum componente deve usar cor "hardcoded" — sempre tokens.

## Cores da marca

| Token | Uso | Light | Dark |
|-------|-----|-------|------|
| `--primary` (azul) | botões principais, links, foco, destaque | `222 75% 44%` (~#1C4FC9) | `217 80% 56%` |
| `--brand` (laranja) | acento da marca, CTAs secundários, "Tudo" do logo | `25 92% 54%` (~#F57C24) | `25 90% 55%` |
| `--brand-foreground` / `--primary-foreground` | texto sobre cor | branco | branco |
| `--ring` | anel de foco | = azul | = azul |

Paleta vinda do logo: **azul royal + laranja**.

## Como funciona (o "comando global")

1. As cores vivem como **CSS variables (HSL)** em [`frontend/src/app/globals.css`](../frontend/src/app/globals.css), em `:root` (light) e `.dark` (dark).
2. O [`tailwind.config.ts`](../frontend/tailwind.config.ts) mapeia cada variável para uma cor Tailwind: `primary`, `brand`, `secondary`, `accent`, `destructive`, `muted`, `card`, `border`, `ring`, etc.
3. Os componentes usam **só classes de token**: `bg-primary text-primary-foreground`, `bg-brand`, `text-brand`, `border-input`, `bg-card`, `text-muted-foreground`, etc.

➡️ **Trocar a cor de TODOS os botões primários** = mudar 1 linha: `--primary` em `globals.css`.
➡️ **Trocar o laranja da marca em todo o sistema** = mudar `--brand`.

## Regras

- ❌ Nunca usar hex/RGB direto em componente (ex.: `style={{color:'#1C4FC9'}}`, `bg-[#f57c24]`). Sempre token.
- ✅ Botão padrão = `<Button>` (já usa `bg-primary`). Para CTA laranja: `className="bg-brand text-brand-foreground hover:bg-brand/90"`.
- ✅ Cantos: `--radius` (em `globals.css`) controla o arredondamento global.
- ✅ Dark mode: todo token tem versão em `:root` e `.dark` — sempre defina as duas.

## Componentes base (shadcn) em `frontend/src/components/ui/`

`button`, `input`, `label`, `card`, `select`, `textarea`, `badge`. Novos componentes devem seguir o mesmo padrão (cva + `cn` + tokens).

## Wordmark

"**Faz**" em `text-primary` (azul) + "**Tudo**" em `text-brand` (laranja), `font-extrabold` — ver `site-header.tsx` e `page.tsx`.

## Logo

Colocar o arquivo do logo em `frontend/public/logo.png` (ou `logo.svg`) e referenciar com `<Image src="/logo.png" .../>`. *(Pendente: subir o arquivo do logo.)*

---

> 📌 Quando o **design system oficial** for enviado, atualizar os valores dos tokens aqui e em `globals.css`/`tailwind.config.ts` — a estrutura já está pronta para receber (tipografia, espaçamentos e mais cores entram como novos tokens no mesmo padrão).
