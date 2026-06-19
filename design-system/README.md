# 🎨 FazTudo — Design System (DIRETRIZ PRINCIPAL)

> **Este é o guia de marca oficial do FazTudo. A partir de agora ele é a diretriz principal e deve ser seguido à risca em toda mudança visual.**

## Arquivos

| Arquivo | O que é |
|---------|---------|
| [`FazTudo-Design-System.html`](FazTudo-Design-System.html) | **Guia visual oficial** (abra no navegador): marca, cores, tipografia, componentes, espaçamento. Fonte da verdade. |
| [`tokens.css`](tokens.css) | **Tokens oficiais** (cores, fonte, raios) extraídos do guia. Mapeados no app em `frontend/src/app/globals.css`. |
| `assets/` | Logos, símbolo, wordmark e mascotes (azul + laranja). Cópia usável em `frontend/public/brand/`. |
| `support.js` | Script do visualizador do HTML. |

## Marca (resumo)

- **Cores núcleo:** Azul Royal `#0D47A1` (primária/confiança) · Azul Marinho `#0A357D`/`#082A5E` (profundidade) · Laranja `#FF6D00` (ação/CTA — usar com parcimônia).
- **Tipografia:** **Montserrat** (400–800; itálico para o "Tudo").
- **Wordmark:** "Faz" + "*Tudo*" (o "Tudo" em itálico, laranja).
- **Símbolo:** casa + aperto de mãos. Mascotes "Faz" (masculino) e "Tudo" (feminino).
- **Tema:** claro, sobre `#F5F7FA`, cards brancos, bordas `#E8EDF3`.
- **Tom de voz:** confiança + "profissionais de confiança".

## Como aplicar (regra de ouro)

1. **Nunca** usar cor/fonte hardcoded em componente. Sempre **token** (`bg-primary`, `bg-brand`, `text-brand`, `bg-background`, `text-muted-foreground`, escalas `blue-*`/`orange-*`).
2. Os tokens vivem em `frontend/src/app/globals.css` (semânticos shadcn em HSL) + `tailwind.config.ts` (escalas). Mudar 1 token muda o app inteiro.
3. Antes de qualquer mudança de UI, **abrir/reler** `FazTudo-Design-System.html` e conferir aderência.

---

## ⚠️ Observação importante (conflito no material recebido)

O `.zip` enviado continha, além do design system do FazTudo, um **segundo design system de OUTRA marca**: *"Inova Comunicação Visual"* (preto + dourado metálico, fachadas/ACM/letreiros), na subpasta `_ds/` do zip. **Esse material NÃO foi aplicado** ao FazTudo (são marcas diferentes). Se o FazTudo deveria, na verdade, usar o tema preto+dourado, me avise — mas todos os indícios (logo, mascotes, nome do arquivo, paleta azul/laranja) apontam que o FazTudo é **azul + laranja**.
