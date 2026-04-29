# DESIGN_SYSTEM.md — Sistema de Design MassasCRM

> Documentação completa do design system atual. A fonte da verdade é o código — `tailwind.config.js`, `src/index.css`, e `src/components/ui/`. Se houver conflito entre este documento e o código, **o código prevalece**.

---

## 1. Fundação

### Tipografia

**Fonte única:** [Lexend](https://fonts.google.com/specimen/Lexend) — importada via Google Fonts em `src/index.css`.

```css
font-family: 'Lexend', system-ui, -apple-system, sans-serif;
```

Lexend foi escolhida por legibilidade superior em telas pequenas e em contextos de uso rápido (mobile commerce). Variantes carregadas: 300, 400, 500, 600, 700.

#### Escala tipográfica

| Classe Tailwind | Tamanho | Peso recomendado | Uso |
|---|---|---|---|
| `text-xs` | 12px | `font-medium` | Labels, badges, metadados, captions |
| `text-sm` | 14px | `font-medium` | Texto de suporte, descrições |
| `text-base` | 16px | `font-normal` | Texto de corpo (mínimo para inputs) |
| `text-lg` | 18px | `font-bold` | Títulos de seção, títulos de modal |
| `text-xl` | 20px | `font-bold` | Valores monetários em destaque |
| `text-2xl` | 24px | `font-bold` | KPIs, números grandes |
| `text-4xl` | 36px | `font-extrabold` | Totais de relatório, hero numbers |

#### Pesos

| Classe | Valor | Uso |
|---|---|---|
| `font-normal` | 400 | Texto de corpo |
| `font-medium` | 500 | Labels, botões pequenos |
| `font-semibold` | 600 | Títulos de card, subtítulos |
| `font-bold` | 700 | **Padrão do sistema** — títulos, valores, botões |
| `font-extrabold` | 800 | Hero numbers (KPIs) |

> ⚠️ `font-black` (900) é **proibido**. O peso máximo é `font-extrabold`.

#### Tracking (letter-spacing)

- `tracking-tight` — títulos de header (h1 com `text-lg font-bold`)
- `tracking-wide` — labels em uppercase (`text-xs uppercase font-bold tracking-wide`)
- `tracking-wider` — labels de seção de alta ênfase

---

## 2. Paleta de Cores

O sistema usa **exclusivamente tokens semânticos CSS** definidos como variáveis HSL no `src/index.css`. Os tokens são mapeados no `tailwind.config.js` e ficam disponíveis como classes Tailwind.

### 2.1 Tokens — Tema Claro (Light)

| Token CSS | Valor HSL | Hex aproximado | Descrição |
|---|---|---|---|
| `--background` | `0 0% 100%` | `#ffffff` | Background da app |
| `--foreground` | `120 36% 10%` | `#102210` | Texto principal |
| `--card` | `0 0% 100%` | `#ffffff` | Background de cards/painéis |
| `--card-foreground` | `120 36% 10%` | `#102210` | Texto dentro de cards |
| `--primary` | `118 86% 50%` | `#13ec13` | Verde neon — cor principal da marca |
| `--primary-foreground` | `120 28% 14%` | `~#192c19` | Texto escuro **sobre** primary |
| `--secondary` | `120 10% 97%` | `#f6f8f6` | Fundo secundário, botão secondary |
| `--secondary-foreground` | `120 36% 10%` | `#102210` | Texto sobre secondary |
| `--muted` | `120 10% 97%` | `#f6f8f6` | Fundo de baixo contraste |
| `--muted-foreground` | `120 5% 45%` | `~#6e756e` | Texto secundário, labels |
| `--accent` | `45 93% 47%` | `#eab308` | Amarelo/dourado — alertas, ranking |
| `--accent-foreground` | `120 36% 10%` | `#102210` | Texto sobre accent |
| `--destructive` | `0 84% 60%` | `#ef4444` | Vermelho — erros, ações destrutivas |
| `--destructive-foreground` | `0 0% 98%` | `#fafafa` | Texto sobre destructive |
| `--success` | `118 86% 50%` | `#13ec13` | Verde — confirmações (= primary) |
| `--success-foreground` | `120 28% 14%` | `~#192c19` | Texto sobre success |
| `--warning` | `45 93% 47%` | `#eab308` | Amarelo — alertas (= accent) |
| `--warning-foreground` | `0 0% 100%` | `#ffffff` | Texto sobre warning |
| `--border` | `120 10% 90%` | `~#e2e8e2` | Bordas de cards, separadores |
| `--input` | `120 10% 90%` | `~#e2e8e2` | Borda de inputs |
| `--ring` | `118 86% 50%` | `#13ec13` | Focus ring (= primary) |
| `--radius` | `1rem` | `16px` | Border-radius base do sistema |

### 2.2 Tokens — Tema Escuro (Dark — Tactical)

| Token CSS | Valor HSL | Hex aproximado |
|---|---|---|
| `--background` | `156 20% 5%` | `#0a100d` |
| `--foreground` | `0 0% 98%` | `#fafafa` |
| `--card` | `150 19% 13%` | `#1a2620` |
| `--primary` | `118 86% 50%` | `#13ec13` (igual ao light) |
| `--muted` | `120 28% 14%` | `~#192c19` |
| `--muted-foreground` | `120 5% 65%` | `~#9ca89c` |
| `--border` | `120 28% 14%` | `~#192c19` |

### 2.3 Como usar os tokens nas classes Tailwind

```tsx
// Backgrounds
className="bg-background"   // página
className="bg-card"          // card, painel
className="bg-muted"         // fundo sutil, hover
className="bg-primary"       // ação primária
className="bg-success"       // confirmação
className="bg-warning"       // alerta
className="bg-destructive"   // erro, perigo

// Com modificador de opacidade (muito útil para backgrounds sutis)
className="bg-primary/10"      // fundo verde muito sutil
className="bg-destructive/10"  // fundo vermelho sutil (error state)
className="bg-warning/10"      // fundo amarelo sutil
className="bg-success/10"      // fundo verde sutil

// Textos
className="text-foreground"           // texto principal
className="text-muted-foreground"     // texto secundário
className="text-primary"              // texto verde (links, ícones de ação)
className="text-primary-foreground"   // texto escuro sobre bg-primary
className="text-success"             // texto verde (positivo)
className="text-warning"             // texto amarelo (alerta)
className="text-destructive"         // texto vermelho (erro)

// Bordas
className="border-border"   // borda padrão — use em TODO lugar
className="border-input"    // borda de input (mesmo valor, contexto semântico)

// Border com opacidade (separadores sutis)
className="border-border/50"
className="border-primary/20"
className="border-destructive/20"
```

### 2.4 Cores estáticas — quando são aceitáveis

As seguintes classes `text-gray-*` são aceitáveis e convencionais no sistema:

```tsx
// Texto de alta ênfase com dark mode explícito
"text-gray-900 dark:text-white"      // títulos principais
"text-gray-900 dark:text-gray-100"   // títulos secundários
"text-gray-600 dark:text-gray-400"   // texto auxiliar
"text-gray-500 dark:text-gray-400"   // texto desabilitado, captions
"text-gray-400"                       // ícones de placeholder

// Fundos neutros
"bg-gray-100 dark:bg-gray-800"       // fundo neutro alternativo
```

Não use `text-zinc-*`, `text-slate-*`, `text-stone-*` — o sistema usa `gray` como família de cinzas.

### 2.5 Cores semânticas estáticas

Definidas no `tailwind.config.js` para casos onde o token semântico não se aplica:

```tsx
"text-semantic-green"    // #22c55e — verde tailwind padrão (checkmarks, confirmações visuais)
"text-semantic-yellow"   // #eab308 — amarelo tailwind padrão
"text-semantic-red"      // #ef4444 — vermelho tailwind padrão
```

Prefira os tokens `success`, `warning`, `destructive`. Use os semânticos estáticos apenas para ícones de estado que precisam de uma cor fixa independente do tema.

---

## 3. Escala de Border-Radius

A variável `--radius: 1rem` define a base. O Tailwind usa:

| Classe | Valor | Uso |
|---|---|---|
| `rounded-sm` | `calc(1rem - 4px)` = 12px | Elementos pequenos (badges internos) |
| `rounded-md` | `calc(1rem - 2px)` = 14px | Botões pequenos (`size="sm"`) |
| `rounded-lg` | `1rem` = 16px | Botões padrão, inputs |
| `rounded-xl` | `12px` (Tailwind default) | **Padrão para cards** |
| `rounded-2xl` | `16px` | Containers de seção, checkout cards |
| `rounded-full` | 9999px | Avatares, FABs, badges pill |

> **Regra principal:** Cards usam `rounded-xl`. O componente `Card` já tem isso embutido. Nunca aplique `rounded-3xl` em cards.

---

## 4. Escala de Espaçamento

O sistema usa o espaçamento de 4pt/8dp do Material Design via Tailwind.

### Espaçamento de página
```tsx
// Variáveis CSS
--page-x: 1rem   // padding horizontal de página
--page-y: 1.5rem // padding vertical de página

// Classes Tailwind equivalentes
"px-4"  // 16px — padding horizontal de página (mais usado)
"py-6"  // 24px — padding vertical de página
"p-4"   // 16px — padding interno de card padrão
```

### Padrões recorrentes
```tsx
"space-y-4"       // gap entre cards em uma lista
"space-y-3"       // gap menor (widgets do dashboard)
"gap-4"           // grid de cards 2-col
"gap-3"           // grid de KPIs 3-col
"gap-2"           // botões lado a lado
"mb-6"            // separação entre seções
"pb-24"           // OBRIGATÓRIO em pages — evita overlap com BottomNav (96px)
```

---

## 5. Escala de Shadows

Definidas como variáveis CSS e mapeadas no `tailwind.config.js`:

| Classe | Valor | Uso |
|---|---|---|
| `shadow-card` | `0 1px 3px 0 rgb(0 0 0 / 0.08)` | Cards em repouso |
| `shadow-elevated` | `0 4px 16px 0 rgb(0 0 0 / 0.12)` | Cards com hover, painéis elevados |
| `shadow-modal` | `0 24px 64px 0 rgb(0 0 0 / 0.22)` | Modais, drawers |

Em dark mode as shadows são mais pronunciadas:
- `shadow-card` dark: `rgb(0 0 0 / 0.20)`
- `shadow-elevated` dark: `rgb(0 0 0 / 0.35)`
- `shadow-modal` dark: `rgb(0 0 0 / 0.55)`

---

## 6. Escala de Z-Index

Definida no `tailwind.config.js` e usada como classes Tailwind:

| Camada | Classe | Valor numérico |
|---|---|---|
| Header sticky | `z-header` | 40 |
| Tooltip | `z-tooltip` | 45 |
| Overlay/backdrop leve | `z-overlay` | 50 |
| Modal (Tailwind config) | `z-modal` | 60 |
| Toast (Tailwind config) | `z-toast` | 100 |
| FABs portaled | `z-[9997]` | 9997 |
| Backdrop de modal portaled | `z-[9998]` | 9998 |
| Modal portaled + Toast portaled | `z-[9999]` | 9999 |

> O Modal e Toast usam `createPortal` e valores arbitrários `z-[9998]`/`z-[9999]` para garantir que fiquem acima de qualquer coisa no DOM, incluindo o Header e qualquer widget com `z-header`.

---

## 7. Catálogo de Componentes

### 7.1 Button

**Arquivo:** `src/components/ui/Button.tsx`

```tsx
import { Button } from '@/components/ui'
// ou
import { Button } from '../components/ui'
```

#### Variants

| Variant | Background | Uso |
|---|---|---|
| `primary` / `default` | `bg-primary` | Ação principal da tela |
| `secondary` | `bg-secondary` | Ação secundária, alternativa |
| `outline` | `border border-input bg-background` | Ação terciária, cancelar |
| `ghost` | transparent, hover `bg-accent` | Botões sem destaque |
| `link` | texto com underline | Links inline |
| `accent` | `bg-accent` | Destaque dourado |
| `success` | `bg-success` | Confirmar, salvar, quitar |
| `warning` | `bg-warning` | Ação de atenção |
| `danger` / `destructive` | `bg-destructive` | Excluir, ação irreversível |

#### Sizes

| Size | Altura | Uso |
|---|---|---|
| `default` / `md` | 48px | **Padrão** — todas as ações principais |
| `sm` | 36px | Botões dentro de cards, ações compactas |
| `lg` | 56px | CTAs de destaque em telas de login/onboarding |
| `icon` | 44×44px | Botões de ícone único |

#### Props completas
```tsx
interface ButtonProps {
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' |
            'link' | 'accent' | 'success' | 'warning' | 'danger' | 'destructive'
  size?: 'default' | 'md' | 'sm' | 'lg' | 'icon'
  isLoading?: boolean     // mostra Loader2 animado e desabilita
  leftIcon?: ReactNode    // ícone antes do texto (com mr-2 automático)
  rightIcon?: ReactNode   // ícone depois do texto (com ml-2 automático)
  asChild?: boolean       // render como filho via Radix Slot
  disabled?: boolean      // opacidade 50%, cursor not-allowed
  // + todos os atributos de <button>
}
```

#### Exemplos
```tsx
// Ação primária da tela
<Button variant="primary" onClick={handleSave}>Salvar</Button>

// Com loading
<Button variant="success" isLoading={isSaving} onClick={handleConfirm}>
  Confirmar Recebimento
</Button>

// Com ícone
<Button variant="outline" leftIcon={<Plus className="h-4 w-4" />}>
  Novo Pedido
</Button>

// Disabled com condição
<Button variant="primary" disabled={!isFormValid}>
  Próximo
</Button>

// Botão destrutivo
<Button variant="danger" size="sm" onClick={handleDelete}>
  Excluir
</Button>
```

---

### 7.2 Badge

**Arquivo:** `src/components/ui/Badge.tsx`

```tsx
import { Badge } from '@/components/ui'
```

#### Variants

| Variant | Background | Uso |
|---|---|---|
| `default` / `primary` | `bg-primary` | Status padrão, destaque positivo |
| `secondary` | `bg-secondary` | Status neutro |
| `success` | `bg-success` | Entregue, pago, em dia |
| `warning` | `bg-warning` | Pendente, próximo, aguardando |
| `danger` / `destructive` | `bg-destructive` | Vencido, erro, atrasado |
| `outline` | `border border-border` | Tags sem preenchimento |
| `gray` | `bg-secondary` | Alias semântico para neutro |

#### Exemplos
```tsx
<Badge variant="success">Entregue</Badge>
<Badge variant="warning">Aguardando Vínculo</Badge>
<Badge variant="danger">Vencido (3d)</Badge>
<Badge variant="default">Novo</Badge>

// Com className adicional
<Badge variant="warning" className="text-[10px] uppercase tracking-wide">
  Recompra
</Badge>
```

---

### 7.3 Card

**Arquivo:** `src/components/ui/Card.tsx`

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui'
```

O `Card` base é um `div` com `rounded-xl border bg-card text-card-foreground shadow`.

#### Sub-componentes

| Componente | Padding padrão | Uso |
|---|---|---|
| `Card` | nenhum | Wrapper externo |
| `CardHeader` | `p-6` | Área do título |
| `CardTitle` | — | `<h3>` semântico |
| `CardDescription` | — | Subtítulo em `text-muted-foreground` |
| `CardContent` | `p-6 pt-0` | Corpo do card |
| `CardFooter` | `p-6 pt-0` | Rodapé com flex |

#### Prop hover
```tsx
// Card clicável com micro-animação
<Card hover onClick={handleClick} className="cursor-pointer active:scale-95">
  conteúdo
</Card>
```

#### Padrão de uso mais comum
```tsx
// Card simples com padding manual
<Card className="p-4">
  <h3 className="font-bold text-gray-900 dark:text-white">Título</h3>
  <p className="text-sm text-muted-foreground">Subtítulo</p>
</Card>

// Card com header de seção e cor de fundo muted
<Card className="p-0 overflow-hidden">
  <div className="flex items-center justify-between px-4 py-3 bg-muted">
    <span className="font-semibold text-sm">Cabeçalho</span>
    <Badge variant="success">Pago</Badge>
  </div>
  <div className="p-4">
    conteúdo
  </div>
</Card>
```

---

### 7.4 Modal e ModalActions

**Arquivo:** `src/components/ui/Modal.tsx`

```tsx
import { Modal, ModalActions } from '@/components/ui'
```

#### Props
```tsx
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'
  showCloseButton?: boolean  // default: true
  children: ReactNode
}
```

#### Comportamentos embutidos
- Fecha com tecla Escape
- Bloqueia scroll do body quando aberto
- Renderiza via `createPortal` no `document.body`
- Backdrop com `bg-black/50 backdrop-blur-sm` em z-[9998]
- Painel em z-[9999] com `max-h-[85vh] overflow-y-auto`
- Animação de entrada: `fade-in zoom-in-95 duration-300`

#### Exemplo completo
```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Vincular Pedido"
  size="md"
>
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Selecione o contato...</p>
    {/* conteúdo */}
  </div>
  <ModalActions>
    <Button variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>
      Cancelar
    </Button>
    <Button variant="primary" className="flex-1" onClick={handleConfirm}>
      Confirmar
    </Button>
  </ModalActions>
</Modal>
```

`ModalActions` aplica `flex justify-end gap-3 mt-6 pt-4 border-t border-border` automaticamente.

---

### 7.5 Input

**Arquivo:** `src/components/ui/Input.tsx`

```tsx
import { Input } from '@/components/ui'
```

#### Props
```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string      // renderiza <label> com htmlFor correto
  error?: string      // mensagem abaixo do input, estilo vermelho
  helperText?: string // mensagem abaixo do input, estilo muted
}
```

#### Comportamentos embutidos
- Gera `id` automático se não fornecido
- `aria-describedby` e `aria-invalid` configurados quando há `error`
- Required indicator (`*` vermelho) quando `required={true}`
- Altura: `h-12` (48px — touch-friendly)

#### Exemplos
```tsx
// Básico
<Input label="Nome" placeholder="Digite o nome" />

// Com validação
<Input
  label="E-mail"
  type="email"
  required
  error={errors.email?.message}
  {...register('email')}
/>

// Com helper text
<Input
  label="Telefone"
  helperText="Somente números. Ex: (11) 99999-8888"
  type="tel"
/>
```

---

### 7.6 Select

**Arquivo:** `src/components/ui/Select.tsx`

```tsx
import { Select } from '@/components/ui'
```

#### Props
```tsx
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}
```

#### Exemplo
```tsx
<Select
  label="Conta de Destino"
  value={selectedContaId}
  onChange={(e) => setSelectedContaId(e.target.value)}
  options={contas.map(ct => ({ value: ct.id, label: ct.nome }))}
  placeholder="Selecione uma conta..."
/>
```

---

### 7.7 Toast

**Arquivo:** `src/components/ui/Toast.tsx`

```tsx
import { useToast } from '@/components/ui'

const toast = useToast()
```

#### Métodos
| Método | Duração padrão | Ícone |
|---|---|---|
| `toast.success(msg)` | 2500ms | CheckCircle2 verde |
| `toast.error(msg)` | 4000ms | AlertCircle vermelho |
| `toast.warning(msg)` | 2500ms | AlertTriangle âmbar |
| `toast.info(msg)` | 2500ms | Info azul |

Todos aceitam segundo argumento `duration` em ms para sobrescrever o padrão.

O `<ToastContainer />` já está em `AppLayout.tsx` — **não adicione em outros lugares**.

---

### 7.8 EmptyState

**Arquivo:** `src/components/ui/EmptyState.tsx`

```tsx
import { EmptyState } from '@/components/ui'
```

#### Props
```tsx
interface EmptyStateProps {
  icon?: ReactNode    // use h-12 w-12 text-muted-foreground
  title: string
  description?: string
  action?: ReactNode  // geralmente um <Button>
}
```

---

### 7.9 Loading — PageSkeleton e WidgetSkeleton

```tsx
import { PageSkeleton, WidgetSkeleton } from '@/components/ui'

// Página inteira
<PageSkeleton rows={5} showHeader showCards={false} />
<PageSkeleton rows={4} showHeader showCards />  // grid de cards

// Widget/seção menor
<WidgetSkeleton height="h-40" lines={2} />
<WidgetSkeleton height="h-24" lines={1} />
```

---

### 7.10 Tabs

**Arquivo:** `src/components/ui/Tabs.tsx`

```tsx
import { Tabs, TabsList, TabsTrigger } from '@/components/ui'
```

Implementação própria (não Radix). Tem `role="tablist"`, `role="tab"` e `aria-selected` corretos.

```tsx
const [tab, setTab] = useState<'receita' | 'despesa'>('receita')

<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="receita">Receitas</TabsTrigger>
    <TabsTrigger value="despesa">Despesas</TabsTrigger>
  </TabsList>
</Tabs>
```

Active: `bg-card text-foreground shadow-card`. Inactive: `text-muted-foreground hover:text-foreground`.

---

### 7.11 ConfirmDialog

```tsx
import { ConfirmDialog } from '@/components/ui'

<ConfirmDialog
  open={!!itemToDelete}
  title="Excluir Pagamento"
  message="Tem certeza? Esta ação não pode ser desfeita."
  confirmLabel="Excluir"
  cancelLabel="Cancelar"
  variant="danger"    // 'danger' | 'default'
  isLoading={isDeleting}
  onConfirm={handleDelete}
  onCancel={() => setItemToDelete(null)}
/>
```

---

### 7.12 Header

**Arquivo:** `src/components/layout/Header.tsx`

```tsx
import { Header } from '../components/layout/Header'
```

#### Props
```tsx
interface HeaderProps {
  title: string
  showBack?: boolean      // botão ArrowLeft que chama navigate(-1)
  showMenu?: boolean      // botão Menu hambúrguer (só em top-level)
  onMenuClick?: () => void
  rightAction?: ReactNode // slot à direita
  centerTitle?: boolean   // OBRIGATÓRIO com showBack
  transparent?: boolean   // header sem background
  className?: string
}
```

#### Padrões por nível

**Nível 1** (telas principais — Dashboard, Contatos, Vendas, Ranking):
```tsx
<Header
  title="Gestão de Clientes"
  centerTitle
  showMenu
  onMenuClick={openDrawer}
  rightAction={<Button size="icon" variant="default"><Plus /></Button>}
/>
```

**Nível 2** (sub-páginas — todo o resto):
```tsx
// Sem ação à direita
<Header title="Detalhe da Venda" showBack centerTitle />

// Com ação à direita
<Header
  title="Pedidos de Compra"
  showBack
  centerTitle
  rightAction={
    <div className="flex gap-2">
      <button onClick={handleSettings} className="p-2 rounded-full"><Settings /></button>
      <button onClick={handleNew} className="p-2 rounded-full text-success"><Plus /></button>
    </div>
  }
/>
```

**Sticky:** O header usa `sticky top-0 z-header` (z-40). O conteúdo da página começa imediatamente abaixo.

---

## 8. Padrões de Dark Mode

O dark mode é ativado via classe `.dark` no elemento `<html>`. O `AppLayout` não controla isso diretamente — é gerenciado pelo sistema operacional ou por uma toggle no sistema.

### Regras de dark mode

1. **Nunca duplique estilos** com `dark:bg-* dark:text-*` se um token semântico resolve:
   ```tsx
   // ❌ Redundante
   className="bg-white dark:bg-gray-800"
   // ✅ O token cuida do dark mode automaticamente
   className="bg-card"
   ```

2. **Use** `dark:*` apenas para casos sem token equivalente:
   ```tsx
   // ✅ Necessário — tom de texto específico sem token
   className="text-gray-900 dark:text-white"
   className="text-gray-500 dark:text-gray-400"
   ```

3. **Shadows** ficam automaticamente mais pronunciadas no dark mode via variáveis CSS.

4. **Borders** no dark mode: `--border` em dark é mais escuro que o card — bordas ficam quase invisíveis propositalmente (design Tactical Dark usa separação por elevação, não por borda).

---

## 9. Padrões de Layout

### AppLayout

```
<AppLayout>
  ┌─────────────────────────────────────┐
  │ <NavigationDrawer> (portaled)       │
  │ <ToastContainer> (portaled)         │
  │ <PwaUpdateToast> (portaled)         │
  │                                     │
  │  max-w-7xl centered                 │
  │  ┌───────────────────────────────┐  │
  │  │ <Outlet /> (lazy-loaded page) │  │
  │  └───────────────────────────────┘  │
  │                                     │
  │ <BottomNav> (fixed bottom)          │
  └─────────────────────────────────────┘
```

### PageContainer

```tsx
import { PageContainer } from '../components/layout/PageContainer'

// Uso padrão
<PageContainer className="pt-0 pb-24 bg-transparent px-4">
  {/* conteúdo */}
</PageContainer>
```

### Bottom padding obrigatório

O `BottomNav` é fixo com altura ~64px. Todo conteúdo rolável precisa de `pb-24` (96px) para não ficar escondido.

---

## 10. Animações

O projeto usa Framer Motion para animações. Use com moderação.

### Padrões de animação do Tailwind (classe `animate-in` / Tailwind Animate plugin)

```tsx
// Entrada de elementos
className="animate-in fade-in slide-in-from-bottom-4 duration-500"
className="animate-in fade-in zoom-in-95 duration-300"
className="animate-in fade-in slide-in-from-right-4 duration-500"
```

### Micro-interações em botões

```tsx
// Press feedback
className="active:scale-95 transition-transform"
className="active:scale-[0.98] transition-all"
```

### Regra de reduced motion

`src/index.css` já tem a regra global:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Não é necessário fazer nada extra — animações CSS são suprimidas automaticamente. Para Framer Motion, use `useReducedMotion()`.

---

## 11. Exceções Documentadas e Justificadas

As seguintes exceções ao sistema de tokens são **intencionais e justificadas**. Não "corrija" esses casos.

### 11.1 RankingComprasWidget — Gradientes Ouro/Prata/Bronze

**Arquivo:** `src/components/dashboard/RankingComprasWidget.tsx`

```tsx
// Gradientes intencionais: ouro/prata/bronze têm semântica visual universal
// — não substituir por tokens semânticos
case 1: return "bg-gradient-to-r from-yellow-300 to-yellow-500 text-yellow-900 border-yellow-400"
case 2: return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900 border-gray-400"
case 3: return "bg-gradient-to-r from-orange-300 to-orange-400 text-orange-900 border-orange-400"
```

**Justificativa:** Ouro, prata e bronze são convenções universais de ranking que não têm equivalente em tokens semânticos. O sistema de cores da marca não representa metais.

### 11.2 DeliveryCard — Cores de Avatar

**Arquivo:** `src/components/features/entregas/DeliveryCard.tsx`

```tsx
// Cores de avatar intencionais: distinção visual por hash do nome
// — não substituir por tokens semânticos
const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500']
```

**Justificativa:** Avatares gerados por hash de nome precisam de um conjunto fixo de cores variadas para distinção visual. Tokens semânticos não têm quantidade suficiente para criar variação.

### 11.3 RelatorioFabrica — Gradiente de Resumo

**Arquivo:** `src/pages/RelatorioFabrica.tsx`

```tsx
{/* Gradiente intencional: identidade visual do card de resumo
    — não substituir por tokens semânticos */}
<div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-700"></div>
```

**Justificativa:** Card de "RESUMO TOTAL" usa um gradiente de marca forte para criar destaque visual no final do relatório. Indigo-violeta representa a identidade do sistema de relatórios.

### 11.4 AlertasRecompraWidget — Botão de Oferecer

**Arquivo:** `src/components/dashboard/AlertasRecompraWidget.tsx`

```tsx
className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-warning hover:bg-warning/90 ..."
```

Este botão usa `bg-warning` corretamente (não é uma exceção). Mencionado aqui porque é `<button>` raw (não `<Button>` component) — justificativa: é um botão dentro de um card de widget compacto onde o componente Button adicionaria complexidade desnecessária. O estilo usa tokens semânticos corretamente.

---

## 12. Utilitários CSS Customizados

Definidos em `tailwind.config.js` como plugin:

```tsx
// Garante área de toque mínima de 44×44px (Apple HIG)
className="touch-target"
// equivalente a:
// min-height: 44px; min-width: 44px;
```

Definidos em `src/index.css`:

```css
.no-scrollbar      /* oculta scrollbar mantendo scroll funcional */
.hide-scrollbar    /* alias de no-scrollbar */
.safe-bottom       /* padding-bottom: max(1rem, env(safe-area-inset-bottom)) */
.animate-slide-in-right /* slide desde a direita, 280ms, cubic-bezier natural */
```

---

## 13. Referência Rápida — Padrão de Página

```tsx
export function MinhaPagina() {
  const toast = useToast()
  const { data, isLoading, error } = useMinhaQuery()

  // Loading state
  if (isLoading) return <PageSkeleton rows={5} showHeader />

  // Error state
  if (error) return (
    <div className="p-4 text-center">
      <p className="text-destructive">{(error as Error).message}</p>
      <Button onClick={() => window.location.reload()} className="mt-4">
        Recarregar
      </Button>
    </div>
  )

  return (
    <>
      {/* Header — Nível 2 obrigatoriamente com showBack + centerTitle */}
      <Header title="Minha Página" showBack centerTitle />

      {/* Container com pb-24 OBRIGATÓRIO */}
      <div className="p-4 pb-24 space-y-4">

        {/* Empty state */}
        {data.length === 0 ? (
          <EmptyState
            icon={<Package className="h-12 w-12 text-muted-foreground" />}
            title="Nenhum item"
            description="Adicione o primeiro item para começar."
            action={<Button onClick={handleNew}>Adicionar</Button>}
          />
        ) : (
          // Lista de cards
          data.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {item.nome}
                </h3>
                <Badge variant="success">Ativo</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDate(item.criadoEm)} · {formatCurrency(item.valor)}
              </p>
            </Card>
          ))
        )}
      </div>
    </>
  )
}
```

---

## Convenções de banco de dados

### Nomenclatura

| Contexto | Convenção | Exemplo |
|---|---|---|
| Tabelas internas | `snake_case` singular em português | `vendas`, `contatos`, `lancamentos` |
| Tabelas do catálogo (compartilhadas) | prefixo `cat_` | `cat_pedidos`, `cat_itens_pedido`, `cat_imagens_produto` |
| Tabelas do sistema interno | prefixo `sis_` | `sis_imagens_produto` |
| Tabelas de pedidos de compra | inglês, sem prefixo | `purchase_orders`, `purchase_order_items`, `purchase_order_payments` |
| Views do dashboard | prefixo `view_` | `view_home_financeiro`, `view_home_operacional` |
| Views de CRM | prefixo `crm_view_` | `crm_view_monthly_sales` |
| Views analíticas (relatórios) | prefixo `rpt_` | `rpt_margem_por_sku`, `rpt_ltv_por_cliente` |
| Views de administração/catálogo | prefixo `vw_` | `vw_admin_dashboard`, `vw_catalogo_produtos` |
| Rankings | sem prefixo, nome descritivo | `ranking_compras`, `ranking_indicacoes` |
| RPCs públicas | prefixo `rpc_` ou `rpt_` | `rpc_marcar_venda_paga`, `rpt_churn` |
| Colunas | `snake_case` | `contato_id`, `data_prevista_pagamento` |
| Colunas de timestamp de criação | `criado_em` (interno) ou `created_at` (purchase_orders) | — |
| Colunas de timestamp de atualização | `atualizado_em` (interno) ou `updated_at` (purchase_orders) | — |

> **Atenção:** As tabelas `purchase_orders`, `purchase_order_items` e `purchase_order_payments` usam **inglês** nos nomes de colunas (`order_date`, `amount`, `payment_date`, `created_at`). Todas as outras tabelas usam português.

### Timestamps e tipos de data

- `criado_em` / `atualizado_em` — `timestamptz` com default `now()` ou `timezone('utc', now())`
- `data` em `vendas` e `lancamentos` — tipo `date` (sem hora), não `timestamptz`
- `data` em `pagamentos_venda` — tipo `timestamptz` (anomalia histórica; usar `::date` para comparações)
- Ao subtrair datas em SQL: `(pagamentos_venda.data::date - vendas.data)` retorna `integer` (dias). Não usar diretamente `timestamptz - date` pois retorna `interval`.

### Valores monetários

- Todas as tabelas internas usam `numeric` sem escala fixa (ex: `total numeric`, `valor numeric`)
- As tabelas do catálogo (`cat_pedidos`, `cat_itens_pedido`) usam **centavos como `integer`** (`total_centavos`, `preco_unitario_centavos`)
- No frontend, **nunca** use raw `numeric` diretamente — sempre passe por `formatCurrency()`

### Identificadores técnicos

A coluna `codigo TEXT UNIQUE` existe em:

- `plano_de_contas.codigo` — identifica categorias contábeis programaticamente. RPCs usam `codigo`, não `nome` (que é editável pelo usuário):
  - `RECEBIMENTO_VENDA` — receita de venda
  - `COMPRA_FABRICA` — despesa de compra da fábrica
  - `VENDAS_A_VISTA` — receita de vendas à vista
  - `DESPESA_BRINDE` — despesa de brinde
- `produtos.codigo` — código de produto único (ex: `PQJ-1KG`)
- `contas.codigo` — identificador de conta bancária/caixa

### Sistema de imagens de produto (dual-table)

Cada produto possui imagens em **duas tabelas simultaneamente**:

| Tabela | Relação | Uso |
|---|---|---|
| `sis_imagens_produto` | 1:1 com `produtos` (UNIQUE em `produto_id`) | Sistema interno |
| `cat_imagens_produto` | 1:N com `produtos` | Catálogo público |

**Regra:** nunca escreva diretamente nessas tabelas. Use os RPCs atômicos:
- `add_image_reference(p_produto_id, p_url)` — substitui imagem em ambas as tabelas
- `delete_image_reference(p_produto_id)` — remove de ambas

---

## Regras de negócio no banco

### Brinde (`forma_pagamento = 'brinde'`)

Vendas com `forma_pagamento = 'brinde'` são presentes/amostras sem valor comercial. Regras:

1. **Trigger `trigger_brinde_before_insert`** (BEFORE INSERT em `vendas`): força `pago = true` e `valor_pago = 0` automaticamente
2. **Exclusão de cálculos financeiros**: todo cálculo de faturamento, ticket médio, lucro e total a receber deve filtrar `forma_pagamento <> 'brinde'`
3. A categoria `DESPESA_BRINDE` em `plano_de_contas` é criada automaticamente pelo trigger ao entregar uma venda brinde

### Estoque (`produtos.estoque_atual`)

O estoque é controlado pelo trigger **`trigger_stock_on_status_change`** (AFTER UPDATE em `vendas`):

| Transição de status | Efeito no estoque |
|---|---|
| `pendente` → `entregue` | Debita `itens_venda.quantidade` de `produtos.estoque_atual` |
| `entregue` → `cancelada` | Devolve quantidade ao estoque |
| Outros | Nenhum efeito |

O recebimento de um pedido de compra (`receive_purchase_order`) **incrementa** o estoque via weighted average cost.

### Fluxo de pagamento de venda (3 caminhos)

```
Caminho 1 — Normal (RPC atômica):
  registrar_pagamento_venda(venda_id, valor, metodo, data, conta_id) [transação única]
    → INSERT pagamentos_venda
        → trigger_update_venda_pagamento (AFTER)
        → UPDATE vendas SET valor_pago, pago
    → INSERT lancamentos (origem='venda')
        → trigger tr_lancamentos_saldo (AFTER)
        → UPDATE contas SET saldo_atual

Caminho 2 — Quitação direta (RPC):
  rpc_marcar_venda_paga(venda_id, conta_id, data)
    → UPDATE vendas SET pago=true
    → INSERT lancamentos (tipo='entrada', origem='venda')

Caminho 3 — Migração histórica:
  INSERT lancamentos direto (origem='migracao_historica')
    → trigger tr_lancamentos_saldo (AFTER)
    → UPDATE contas SET saldo_atual
```

> **Atomicidade:** O Caminho 1 usa uma única RPC `SECURITY DEFINER`. Se o INSERT do lançamento falhar, o pagamento também é revertido — `vendas.pago` nunca fica `true` sem o respectivo registro no caixa.

### Saldo de conta (`contas.saldo_atual`)

Campo desnormalizado mantido por dois triggers:

- **`tr_lancamentos_saldo`** (INSERT/UPDATE/DELETE em `lancamentos`) → chama `update_conta_saldo_lancamento()`
- **`tr_po_payments_saldo`** (INSERT/UPDATE/DELETE em `purchase_order_payments`) → chama `update_conta_saldo_po_payment()`

Fórmula: `saldo_atual = saldo_inicial + Σ(entradas) - Σ(saídas) - Σ(pagamentos PO)`

### Campos desnormalizados em `vendas`

| Campo | Mantido por | Fórmula |
|---|---|---|
| `valor_pago` | `update_venda_pagamento_summary()` via trigger | `SUM(pagamentos_venda.valor)` |
| `pago` | `update_venda_pagamento_summary()` via trigger | `valor_pago >= total` |

**Nunca** calcule `valor_pago` ou `pago` no frontend — leia direto da tabela `vendas`.

### Integração catálogo → distribuidora

Pedidos criados no catálogo público viram vendas automaticamente:

1. **`tr_cat_pedidos_link_contato`** (BEFORE INSERT em `cat_pedidos`) — tenta vincular `contato_id` por telefone
2. **`tr_sync_cat_pedido_to_venda`** (AFTER UPDATE em `cat_pedidos`) — quando status muda para `'entregue'`, cria venda + itens_venda na distribuidora
3. Se a vinculação falha, um registro vai para `cat_pedidos_pendentes_vinculacao` com o motivo

### Status de pedido de compra (`purchase_orders.status`)

Enum com valores em **inglês**: `pending`, `received`, `cancelled`.
Nunca use os equivalentes em português — causará erro de cast de enum.

---

## Padrão de views de relatório (`rpt_`)

### Convenções

- **Prefixo `rpt_`** obrigatório para todas as views analíticas de relatório
- **`SECURITY INVOKER = true`** em todas as views (o RLS da tabela base é aplicado)
- Nenhuma view `rpt_` agrega dados em tempo real em loop — usa JOINs e CTEs
- RPCs analíticas parametrizadas usam **`SECURITY DEFINER` + `SET search_path = public`**

### Views de relatório disponíveis

| View | Descrição | Granularidade |
|---|---|---|
| `rpt_margem_por_sku` | Margem bruta por produto | Por produto (histórico total) |
| `rpt_break_even_mensal` | DRE simplificado com break-even | Por mês |
| `rpt_distribuicao_forma_pagamento` | Mix de formas de pagamento | Histórico total |
| `rpt_giro_estoque` | Giro e status de estoque por produto | Por produto |
| `rpt_projecao_recebimentos` | Contas a receber abertas com situação | Por venda |
| `rpt_ltv_por_cliente` | LTV, ticket médio e histórico por cliente | Por contato |
| `rpt_prazo_medio_recebimento` | Prazo médio de recebimento e faixas | Por mês |
| `rpt_faturamento_comparativo` | Faturamento MoM com variação percentual | Por mês |

### RPCs analíticas parametrizadas

| RPC | Parâmetros | Retorno |
|---|---|---|
| `rpt_churn(p_dias_threshold int DEFAULT 60)` | Limiar de inatividade em dias | Clientes inativos com histórico |
| `rpt_vendas_por_periodo(p_inicio date, p_fim date, p_agrupamento text DEFAULT 'month')` | Intervalo + agrupamento (day/week/month/year) | Série temporal de vendas |

### Regras de uso

1. Views `rpt_` são somente leitura — nunca referencie em INSERT/UPDATE
2. Todas excluem `forma_pagamento = 'brinde'` dos cálculos de receita
3. `rpt_giro_estoque` exclui `purchase_orders` com `status = 'cancelled'`
4. Para consumo no frontend: use React Query com `staleTime` alto (dados históricos mudam pouco)
5. Para exportação: use `rpt_vendas_por_periodo` como base, ajustando `p_agrupamento`
