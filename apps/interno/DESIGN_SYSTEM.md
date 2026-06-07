# Design System — Mont Interno (Jarvis)

> Referência de cores e padrões de UI do app `apps/interno`. Leia antes de mexer em qualquer estilo.
>
> Em junho/2026 o app inteiro passou por uma **campanha de tokenização**: trocamos ~500+ cores hardcoded (`zinc/emerald/gray/white/black/violet…`) por **tokens semânticos**. O objetivo: **coesão** (nada parece "outro sistema") + **theming** (trocar a cor da marca numa linha) + **suporte real a light/dark**. Esta doc registra o que ficou, por quê, e os **anti-padrões que NÃO devem voltar**.

---

## 1. Como funciona

O design system é baseado em **CSS variables + Tailwind**:

- **`src/index.css`** define os tokens como CSS vars HSL, em dois temas:
  - `:root` → tema claro **"Stitch"** (fundo branco, texto verde-quase-preto).
  - `.dark` → tema escuro **"Tactical"** (fundo verde-petróleo `#0a100d`, cards `#1a2620`).
  - No topo do arquivo há um **cheat-sheet semântico** em comentário — mantenha sincronizado com esta doc.
- **`tailwind.config.js`** mapeia cada var para uma cor Tailwind com suporte a opacidade: `primary: "hsl(var(--primary) / <alpha-value>)"`. Isso gera as utilities `bg-primary`, `text-muted-foreground`, `border-border` etc.
- **Tema é classe no `<html>`** (`darkMode: 'class'`). Trocado por `src/contexts/ThemeContext.tsx` (`ThemeToggle`), default `system`, persistido em `localStorage['vite-ui-theme']`.

**Consequência prática:** as utilities (`bg-card`, `text-foreground`…) são iguais nos dois temas — o **valor** muda sozinho conforme o tema ativo. Trocar `--primary` no `index.css` re-tematiza o app inteiro.

> ⚠️ `success` tem o **mesmo valor de `primary`** (verde neon `#13ec13`) nos dois temas — positivo = verde-marca. Não estranhe que "entrada/receita" e "CTA" pareçam idênticos: é proposital. Diferencie pela **função**, não pela cor.

---

## 2. Regra de ouro

**Mapeie pela FUNÇÃO, não pelo tom.** Não pergunte "que cor é essa?", pergunte "o que isso significa?".

`emerald` num valor de receita → `success`. `emerald` numa decoração → fica. `gray` num label → `muted-foreground`. `gray` numa borda → `border`. Find-replace cego quebra; tokenização exige julgamento semântico.

---

## 3. Tabela de tokens

Cada token tem variante `-foreground` (cor do texto/ícone que vai **em cima** dele). Use via `bg-<token>` / `text-<token>` / `border-<token>`.

| Token | Função | Classes típicas | Light / Dark |
|---|---|---|---|
| `primary` | Marca / CTA principal (Nova Venda, Salvar, ação primária) | `bg-primary text-primary-foreground`, `text-primary` | verde neon `#13ec13` (igual nos 2) |
| `success` | Positivo / entrada / receita / quitado / status ok | `text-success`, `bg-success/10` | = primary (verde neon) |
| `destructive` | Negativo / perigo / saída / erro / **excluir** | `text-destructive`, `bg-destructive/10` | vermelho `#ef4444` |
| `warning` | Atenção leve / amarelo | `text-warning`, `bg-warning/10` | âmbar `#eab308` |
| `warning-strong` | Atenção forte / pendente / a receber / fiado | `text-warning-strong` | laranja `#f97316`-ish |
| `accent` | Destaque secundário (= amarelo, mesmo valor de warning) | `bg-accent text-accent-foreground` | âmbar |
| `muted` / `muted-foreground` | Superfície secundária / texto secundário, **labels**, ícones neutros, placeholders | `bg-muted`, `text-muted-foreground` | cinza-esverdeado |
| `foreground` / `background` | Texto principal / superfície base | `text-foreground`, `bg-background` | quase-preto/branco ⇄ branco/preto |
| `card` | Superfície de cards (adapta sozinho ao tema) | `bg-card`, `border + bg-card` | branco / `#1a2620` |
| `popover` | Superfície de popovers/menus | `bg-popover text-popover-foreground` | = card |
| `secondary` | Superfície sutil alternativa (raro) | `bg-secondary` | quase-branco / verde-escuro |
| `border` | Borda padrão | `border border-border` | cinza claro / verde-escuro |
| `input` | Borda de campos de formulário | `border border-input` | = border |
| `ring` | Anel de foco | `focus-visible:ring-2 focus-visible:ring-ring` | verde neon |

**Inversão** (hero, tooltip, FAB neutro, badge escuro): `bg-foreground text-background` — fundo "tinta", texto "papel", nos dois temas.

### Tokens não-cor (também no design system)

| Categoria | Tokens | Uso |
|---|---|---|
| Sombra | `shadow-card`, `shadow-elevated`, `shadow-modal` | elevação (adapta ao tema — mais forte no dark) |
| Raio | `rounded-lg`/`md`/`sm` (base `--radius: 1rem`) | cantos |
| z-index | `z-tooltip` `z-header` `z-overlay` `z-modal` `z-toast` | camadas nomeadas (use estas, não números mágicos) |
| Espaço | `p-page-x` (`1rem`), `p-page-y` (`1.5rem`) | padding de página |
| Toque | `touch-target` (44×44px mín.) | alvos de toque mobile |
| Fonte | `font-sans` / `font-display` (**Lexend**) | tipografia |

---

## 4. Como usar — modificadores de opacidade

Todos os tokens de cor aceitam opacidade (têm `<alpha-value>`):

```tsx
bg-primary/10        // fundo de marca a 10% (tints de seleção/destaque)
border-destructive/30
text-success/80
bg-foreground/[0.04] // valor arbitrário p/ tints sutis theme-aware (ver §6)
```

### Padrão de input/formulário (copie isto)

```tsx
const inputBase =
  "w-full rounded-xl border border-input bg-background text-foreground " +
  "placeholder:text-muted-foreground/60 ring-offset-background " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-50"
```

- Label de campo → `text-sm font-medium text-foreground` (ou `text-muted-foreground` p/ label secundário).
- Erro de campo → `text-destructive`.

---

## 5. Convenções semânticas estabelecidas

| Situação | Token |
|---|---|
| Entrada / receita / pago / quitado | `success` |
| Saída / despesa / erro / excluir / cancelar (destrutivo) | `destructive` |
| Pendente / a receber / fiado / "atenção" | `warning-strong` |
| Transferência / criação / ação neutra | `foreground` neutro |
| **Total de custo/despesa** (ex.: pedido de compra) | `foreground` neutro — **NÃO `success`** (verde de "entrada" seria errado pra dinheiro saindo) |
| Saldo devedor / restante a pagar | `destructive` (espelha o PaymentSidebar) |
| Botão "+" / CTA | `primary` |
| WhatsApp / contato | `primary` |

Quando duas telas mostram o mesmo conceito, use o mesmo token (ex.: "Saldo" devedor é `destructive` na venda e no pedido).

---

## 6. Padrão theme-aware para superfícies translúcidas (lição do Relacionamento)

Telas "táticas" escuras usavam `bg-white/[0.04]` e `border-white/[0.06]` (hairlines/painéis sutis). Isso **só funciona no dark** — no light vira invisível/errado.

**Regra:** translucência neutra usa `foreground`, não `white`/`black`. `foreground` inverte por tema (claro no dark, escuro no light), então o efeito fica correto nos dois:

| ❌ Dark-only | ✅ Theme-aware |
|---|---|
| `bg-white/[0.04]` | `bg-foreground/[0.04]` |
| `border-white/[0.06]` | `border-border` |
| `hover:bg-white/[0.06]` | `hover:bg-muted` |
| `bg-black/25` (painel recuado) | `bg-background` |

Exceção: **scrims de modal** (`bg-black/50` atrás de um dialog) ficam pretos de propósito — são overlays, corretos nos dois temas.

---

## 7. ❌ Anti-padrões — NÃO faça

### 7.1 Classes que NÃO existem neste projeto (renderizam SEM estilo)

Estes foram bugs reais encontrados e corrigidos. **Nunca** use:

| ❌ Classe inexistente | ✅ Use |
|---|---|
| `primary-50`…`primary-900` (só existe `primary` DEFAULT) | `primary` + opacidade: `bg-primary/10`, `text-primary` |
| `danger-50`…`danger-500` | `destructive` |
| `text-semantic-violet`, `text-semantic-orange` | token real (`text-primary`, `text-warning-strong`…) |

> Existem **apenas** `semantic-red`, `semantic-yellow`, `semantic-green` (hex fixos, **não** theme-aware — usados só nos trends do dashboard). Não crie `semantic-*` novos; prefira os tokens de tema.

### 7.2 Light-only (quebra no dark)

Não use cores cruas de um tema só. `bg-white`, `text-gray-700`, `bg-gray-100` sem `dark:` → no tema escuro fica fundo branco / texto invisível.

| ❌ | ✅ |
|---|---|
| `bg-white` | `bg-card` (superfície) ou `bg-background` (base) |
| `text-gray-700` / `text-gray-900` | `text-foreground` |
| `text-gray-400` / `text-gray-500` | `text-muted-foreground` |
| `border-gray-200` / `border-gray-300` | `border-border` / `border-input` |
| `bg-gray-100 dark:bg-gray-800` | `bg-muted` |

### 7.3 Borda "bare" (cor default cinza, quebra no dark)

`border`, `border-b`, `border-t` **sem cor** usam o cinza default do Tailwind (`gray-200`) → errado no dark. **Sempre** dê a cor:

```tsx
// ❌  <div className="border-b p-4">
// ✅  <div className="border-b border-border p-4">
```

---

## 8. ✅ Cores hardcoded que são INTENCIONAIS (decorativas — deixe quietas)

Nem tudo vira token. Cor **decorativa/ilustrativa** (que codifica identidade ou categoria, não função semântica) fica:

- **Medalhas / pódio** (`PodiumCard.tsx`): gradientes ouro/prata/bronze (`from-yellow-300…`, `from-gray-300…`, `from-orange-300…`). Um pódio É ouro/prata/bronze — universal, não tematiza.
- **StoryFilter** (`components/ui/StoryFilter.tsx`): anéis de categoria (cliente=verde, lead=laranja, VIP=roxo, inativo=ciano). Código de cor funcional por categoria.
- **Timeline de relacionamento**: dots por tipo de evento (`tag`=azul, `ponto_contato`=esmeralda). Idem categórico. (`movimentacao`=primary, `feedback`=warning já são tokens.)
- **Toast `info`**: azul (`text-blue-600`) — não existe token "info"; verde colidiria com `success`.
- **Scrims de modal/drawer**: `bg-black/50` — overlay escuro proposital.
- **VendaReceipt**: brilho neon no dark (`dark:text-primary` + `drop-shadow` neon) — identidade visual do recibo. (É decorativo mas usa `primary`, então segue themeable.)
- **Mapa "tático"** do `ContatoIntel`: fundo escuro fixo.

Regra de bolso: se a cor distingue **categorias** ou é **identidade visual**, fica; se representa um **estado/função** (ok/erro/atenção/secundário), tokeniza.

---

## 9. Acessibilidade (padrões adotados)

- **Botão só-ícone** precisa de `aria-label`. Toggle/expansível: `aria-pressed` / `aria-expanded`.
- **Foco visível**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`.
- **Números** (moeda, contadores) → `tabular-nums` (alinhamento).
- `color-scheme` já setado por tema no `index.css` (form controls nativos seguem o tema).
- Label associado ao input via `htmlFor`/`id` (já no `Input`/`Select` primitivos).
- Reticências `…` (não `...`); evite `transition-all` (prefira `transition-colors`/`transition-transform`).

---

## 10. Re-tematizar (trocar a cor da marca)

Edite **uma linha** em `src/index.css` (nos dois blocos, `:root` e `.dark`):

```css
--primary: 118 86% 50%;   /* HSL sem vírgula, sem hsl() */
```

Tudo que usa `primary`/`ring`/`success` (que casa com primary) acompanha. Mesma lógica para `--destructive`, `--warning-strong` etc.

---

## 11. Próximo passo: Tailwind v3 → v4

A tokenização foi feita **de propósito antes** da migração v4. As utilities (`bg-card`, `text-muted-foreground`…) são **idênticas** em v3 e v4 — só a **definição** dos tokens (as CSS vars + o mapeamento) muda de sintaxe, num lugar só (`index.css` + config → `@theme`). Ou seja: o diff do v4 vira "portar tokens", não "consertar 500 cores". Depois do v4 vem a adoção da lib de UI (Watermelon own-the-code + ReUI como suplemento).

---

*Mantenha esta doc viva: ao adicionar um token ou estabelecer uma convenção nova, atualize aqui **e** o cheat-sheet no topo de `src/index.css`.*
