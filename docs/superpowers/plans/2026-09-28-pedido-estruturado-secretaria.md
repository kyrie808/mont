# Pedido estruturado da secretária — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o pedido em texto livre da secretária de WhatsApp por estado estruturado no banco, com ferramentas de mutação validadas contra o catálogo real.

**Architecture:** Duas tabelas novas (`wa_pedido`, `wa_pedido_item`) com FK para `produtos` — a garantia contra produto inventado sai do prompt e vai para o banco. A resolução "o que o cliente escreveu → qual produto" é função pura em `packages/shared`, testada. A Edge Function ganha quatro ferramentas de mutação no lugar de `registrar_pedido_intencao`. O W3 é religado para usá-las e um W4 novo detecta pedido abandonado.

**Tech Stack:** Supabase (Postgres + Edge Functions em Deno), n8n 2.33.7, Evolution API, pnpm + Turborepo, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-pedido-estruturado-secretaria-design.md`

## Global Constraints

- **Regra de Ouro #3:** mudança de schema exige backup (`.\supabase\scripts\dump-prod.ps1`) **e** migration versionada, mesmo aplicando direto na produção.
- **Regra de Ouro #1:** zero `as any`.
- **Regra de Ouro #7:** credenciais nunca no git.
- **Lógica pura mora em `packages/shared/src/`** — é a única pasta que o runtime Deno da Edge Function e o Vitest do interno alcançam. Sem dependências externas.
- **Testes de regressão de bug crítico vêm ANTES do fix** (skill `tdd-mont-pragmatico`).
- **`supabase/config.toml` já tem `[functions.whatsapp-secretaria] verify_jwt = false`** — não remover. Deploy sem essa entrada mata o chamador em silêncio.
- **A secretária continua na gaiola** (`SECRETARIA_MODO=dev`, `SECRETARIA_ALLOWLIST=5511980017732`) durante todo o plano. Tirar da gaiola é decisão do diretor, depois.
- **Nunca criar venda.** O pedido confirmado grava em `interacoes` e avisa o grupo; não toca `vendas` nem `cat_pedidos`.
- **Estoque nunca recusa.** Produto com `estoque_atual <= 0` não é sugerido por iniciativa dela, mas é aceito se o cliente pedir pelo nome, e o aviso ao grupo carrega alerta.
- **Valores monetários em reais** (numeric), zero centavos.

## Estrutura de arquivos

| arquivo | responsabilidade |
|---|---|
| `supabase/migrations/20260928120000_wa_pedido.sql` | tabelas, índices, RLS |
| `supabase/migrations/20260928120100_produtos_apelido_sinonimos.sql` | troca os apelidos de código por sinônimos |
| `packages/shared/src/catalogo.ts` | **criar** — resolução de termo e renderização de pedido. Puro |
| `packages/shared/src/index.ts` | reexporta o novo módulo |
| `apps/interno/src/utils/__tests__/catalogo.spec.ts` | **criar** — testes da resolução e da renderização |
| `supabase/functions/whatsapp-secretaria/index.ts` | as 4 ferramentas + `rascunhos_abandonados`; remove as ações velhas |
| `infra/crm/workflows/w3-secretaria.json` | tools novas, prompt novo |
| `infra/crm/workflows/w4-abandono.json` | **criar** — cron do abandono |

`catalogo.ts` é arquivo novo em vez de crescer `secretaria.ts` porque é outra responsabilidade: `secretaria.ts` trata de *como ela se comporta* (tempo de digitação, gaiola, prioridade humana) e `catalogo.ts` trata de *o que existe para vender*.

---

### Task 1: Resolução de termo — o núcleo puro

**Files:**
- Create: `packages/shared/src/catalogo.ts`
- Create: `apps/interno/src/utils/__tests__/catalogo.spec.ts`
- Modify: `packages/shared/src/index.ts:48-56`

> ⚠️ O tipo se chama `ProdutoVendavel` e **não** `ProdutoCatalogo`: esse nome já existe em
> `packages/shared/src/types.ts:40` como a view pública `vw_catalogo_produtos`, consumida
> por 14 arquivos de `apps/catalogo`. Nome repetido dá `TS2300 Duplicate identifier` e
> quebra o build do site em produção — medido, 39 erros.

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface ProdutoVendavel { id: string; nome: string; apelido: string | null; preco: number; estoqueAtual: number }`
  - `type Resolucao = { tipo: 'resolvido'; produto: ProdutoVendavel } | { tipo: 'ambiguo'; opcoes: ProdutoVendavel[] } | { tipo: 'nao_encontrado'; opcoes: ProdutoVendavel[] }`
  - `function resolverTermo(termo: string, catalogo: ProdutoVendavel[]): Resolucao`

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/interno/src/utils/__tests__/catalogo.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolverTermo, type ProdutoVendavel, type Resolucao } from '@mont/shared'

// Catálogo real da Mont em 28/09/2026. Os apelidos são os sinônimos curados.
const CATALOGO: ProdutoVendavel[] = [
    { id: 'pq-1k-25', nome: 'Pão de Queijo 1kg - 25gr', apelido: 'pão de queijo, pao de queijo, pdq, congelado', preco: 30, estoqueAtual: -103 },
    { id: 'pq-1k-100', nome: 'Pão de Queijo 1kg - 100gr', apelido: 'pão de queijo, pao de queijo, pdq, congelado', preco: 30, estoqueAtual: 4 },
    { id: 'pq-2k-50', nome: 'Pão de Queijo 2kg - 50gr', apelido: 'pão de queijo, pao de queijo, pdq, congelado', preco: 60, estoqueAtual: -27 },
    { id: 'chipa-1k', nome: 'Chipa 1kg', apelido: 'chipa, chipinha', preco: 40, estoqueAtual: -243 },
    { id: 'chipa-2k', nome: 'Chipa 2kg', apelido: 'chipa, chipinha', preco: 80, estoqueAtual: -21 },
    { id: 'palito-1k', nome: 'Palito de Queijo 1kg', apelido: 'palito, palito de queijo', preco: 40, estoqueAtual: -426 },
    { id: 'palito-2k', nome: 'Palito de Queijo 2kg', apelido: 'palito, palito de queijo', preco: 80, estoqueAtual: -30 },
    { id: 'massa-1k', nome: 'Massa Pão de Queijo 1kg', apelido: 'baldinho, massa, massa crua, resfriado', preco: 30, estoqueAtual: -323 },
    { id: 'massa-4k', nome: 'Massa Pão de Queijo 4kg', apelido: 'balde, baldão, massa, resfriado', preco: 75, estoqueAtual: -228 },
]

describe('resolverTermo', () => {
    // `expect()` nao estreita tipo para o TypeScript: acessar `r.opcoes` direto num union
    // que inclui `resolvido` nao compila. Este helper estreita e falha com mensagem util.
    function opcoesDe(r: Resolucao, tipo: 'ambiguo' | 'nao_encontrado'): string[] {
        if (r.tipo !== tipo) throw new Error(`esperava ${tipo}, veio ${r.tipo}`)
        return r.opcoes.map((p) => p.id).sort()
    }

    it('peso que a família não tem → nao_encontrado com as opções DELA', () => {
        // O defeito de 26/09: ela anotou "500 g de chipa", que não existe.
        const r = resolverTermo('500g de chipa', CATALOGO)
        expect(opcoesDe(r, 'nao_encontrado')).toEqual(['chipa-1k', 'chipa-2k'])
    })

    it('família + peso com mais de um tamanho → ambiguo', () => {
        const r = resolverTermo('1 kg de pão de queijo', CATALOGO)
        expect(opcoesDe(r, 'ambiguo')).toEqual(['pq-1k-100', 'pq-1k-25'])
    })

    it('família + peso com um tamanho só → resolvido', () => {
        const r = resolverTermo('2 kg de pão de queijo', CATALOGO)
        expect(r.tipo).toBe('resolvido')
        expect(r).toMatchObject({ produto: { id: 'pq-2k-50' } })
    })

    it('sinônimo resolve sozinho quando a família tem um peso só naquele nome', () => {
        const r = resolverTermo('baldinho', CATALOGO)
        expect(r.tipo).toBe('resolvido')
        expect(r).toMatchObject({ produto: { id: 'massa-1k' } })
    })

    it('família sem peso → ambiguo com os pesos', () => {
        expect(opcoesDe(resolverTermo('chipa', CATALOGO), 'ambiguo')).toEqual(['chipa-1k', 'chipa-2k'])
    })

    it('"pão de queijo" NÃO traz a massa crua', () => {
        // Substring pegaria os 5 (inclui "Massa Pão de Queijo"). A curadoria evita
        // ela perguntar "pronto ou cru?" numa conversa em que ele quis o pronto.
        const r = resolverTermo('pão de queijo', CATALOGO)
        const ids = r.tipo === 'resolvido' ? [r.produto.id] : r.opcoes.map((p) => p.id)
        expect(ids).not.toContain('massa-1k')
        expect(ids).not.toContain('massa-4k')
    })

    it('ignora acento e caixa', () => {
        expect(resolverTermo('PAO DE QUEIJO 2kg', CATALOGO).tipo).toBe('resolvido')
    })

    it('sinônimo casa como palavra inteira, não como pedaço', () => {
        // "baldinho" contém "balde". Busca por substring devolveria os dois baldes.
        const r = resolverTermo('baldinho', CATALOGO)
        expect(r).toMatchObject({ tipo: 'resolvido', produto: { id: 'massa-1k' } })
    })

    it('peso da UNIDADE também resolve, não só o da embalagem', () => {
        // "me vê o de 100g" fala do tamanho do pão, não do pacote — e existe.
        const r = resolverTermo('pão de queijo de 100g', CATALOGO)
        expect(r).toMatchObject({ tipo: 'resolvido', produto: { id: 'pq-1k-100' } })
    })

    it('pontuação não atrapalha — cliente escreve com "!" e ","', () => {
        const r = resolverTermo('me vê 2kg de pão de queijo, por favor!', CATALOGO)
        expect(r).toMatchObject({ tipo: 'resolvido', produto: { id: 'pq-2k-50' } })
    })

    it('KG maiúsculo também é peso', () => {
        expect(resolverTermo('2KG de chipa', CATALOGO)).toMatchObject({
            tipo: 'resolvido', produto: { id: 'chipa-2k' },
        })
    })

    it('termo que não é produto nenhum → nao_encontrado sem opções', () => {
        expect(opcoesDe(resolverTermo('coxinha', CATALOGO), 'nao_encontrado')).toEqual([])
    })

    it('catálogo vazio → nao_encontrado, nunca explode', () => {
        expect(resolverTermo('chipa', []).tipo).toBe('nao_encontrado')
    })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter interno exec vitest run src/utils/__tests__/catalogo.spec.ts`
Expected: FAIL com `resolverTermo is not a function`.

- [ ] **Step 3: Implementar**

Criar `packages/shared/src/catalogo.ts`:

```typescript
/**
 * Catálogo da secretária: transformar o que o cliente escreveu em produto real.
 *
 * Mora aqui pelo mesmo motivo de `secretaria.ts`: é a única pasta que o runtime Deno da
 * Edge Function E o Vitest do interno alcançam. Sem dependências.
 *
 * Existe porque em 26/09/2026 a agente anotou "500 g de chipa" — embalagem que a Mont não
 * vende. Quatro tentativas de proibir isso por prompt falharam. A regra passa a ser código.
 */

export interface ProdutoVendavel {
    id: string
    nome: string
    /** Sinônimos curados, separados por vírgula. É como o CLIENTE chama o produto. */
    apelido: string | null
    preco: number
    estoqueAtual: number
}

export type Resolucao =
    | { tipo: 'resolvido'; produto: ProdutoVendavel }
    | { tipo: 'ambiguo'; opcoes: ProdutoVendavel[] }
    | { tipo: 'nao_encontrado'; opcoes: ProdutoVendavel[] }

/**
 * Min\u00fasculas, sem acento, sem pontua\u00e7\u00e3o, espa\u00e7o \u00fanico.
 *
 * A pontua\u00e7\u00e3o vira espa\u00e7o em vez de sumir: cliente escreve "me v\u00ea 1kg de chipa!" e
 * "chipa!" precisa continuar casando com o sin\u00f4nimo "chipa".
 */
function normalizar(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

/**
 * Peso que o cliente pediu, em gramas: "1kg" → 1000, "500g" → 500.
 *
 * Trabalha sobre o termo em minúsculas mas COM pontuação, porque "2,5kg" precisa do
 * separador decimal — `normalizar` o trocaria por espaço.
 */
function pesoPedido(termo: string): number | null {
    const t = termo.toLowerCase()
    const kg = t.match(/(\d+(?:[.,]\d+)?)\s*kg\b/)
    if (kg) return Math.round(parseFloat(kg[1].replace(',', '.')) * 1000)
    const g = t.match(/(\d+)\s*(?:g|gr|gramas?)\b/)
    if (g) return parseInt(g[1], 10)
    return null
}

/**
 * Pesos que o NOME do produto declara. "Pão de Queijo 1kg - 100gr" tem dois números: a
 * embalagem (1kg) e o tamanho da unidade (100gr). O primeiro é a embalagem.
 */
function pesosDoNome(nome: string): { embalagem: number | null; unidade: number | null } {
    const n = normalizar(nome)
    const kg = n.match(/(\d+(?:[.,]\d+)?)\s*kg\b/)
    const g = n.match(/(\d+)\s*(?:g|gr)\b/)
    return {
        embalagem: kg ? Math.round(parseFloat(kg[1].replace(',', '.')) * 1000) : null,
        unidade: g ? parseInt(g[1], 10) : null,
    }
}

function sinonimos(p: ProdutoVendavel): string[] {
    return (p.apelido ?? '')
        .split(',')
        .map(normalizar)
        .filter(Boolean)
}

/**
 * Sinônimo tem que casar como PALAVRA INTEIRA, não como pedaço.
 *
 * "baldinho".includes("balde") é `true`, então busca por substring faria "baldinho" casar
 * com o Balde 4kg e voltar ambíguo — quando o cliente foi específico.
 *
 * Emoldurar com espaço resolve sem regex: `normalizar` já colapsou espaços e trocou
 * pontuação por espaço, então " baldinho " não contém " balde ", e " 1 kg de chipa "
 * contém " chipa ". Sem regex também não há o que escapar quando o apelido tiver
 * parêntese ou acento.
 */
function contemSinonimo(texto: string, sinonimo: string): boolean {
    return ` ${texto} `.includes(` ${sinonimo} `)
}

/**
 * `termo` é o que o cliente escreveu, cru. Devolve sempre um dos três resultados —
 * nunca escolhe no lugar dele quando há mais de uma possibilidade.
 */
export function resolverTermo(termo: string, catalogo: ProdutoVendavel[]): Resolucao {
    const t = normalizar(termo)

    // 1. A FAMÍLIA vem do sinônimo curado, não de pedaço do nome. "pão de queijo" está
    //    dentro de "Massa Pão de Queijo", e a massa é produto cru — outra coisa.
    const familia = catalogo.filter((p) => sinonimos(p).some((s) => contemSinonimo(t, s)))
    if (familia.length === 0) return { tipo: 'nao_encontrado', opcoes: [] }

    // 2. Sem peso declarado, a escolha é do cliente.
    const peso = pesoPedido(termo)
    if (peso === null) {
        return familia.length === 1
            ? { tipo: 'resolvido', produto: familia[0] }
            : { tipo: 'ambiguo', opcoes: familia }
    }

    // 3. Com peso: casa contra a EMBALAGEM primeiro — é o que o cliente diz mais vezes.
    const naEmbalagem = familia.filter((p) => pesosDoNome(p.nome).embalagem === peso)
    if (naEmbalagem.length === 1) return { tipo: 'resolvido', produto: naEmbalagem[0] }
    if (naEmbalagem.length > 1) {
        // Mesma embalagem, tamanhos de unidade diferentes: o cliente escolhe.
        return { tipo: 'ambiguo', opcoes: naEmbalagem }
    }

    // 4. Nenhuma embalagem com esse peso. Antes de dizer que não existe, tentar o TAMANHO
    //    DA UNIDADE: "me vê o de 100g" fala da unidade, não do pacote, e o produto existe.
    const naUnidade = familia.filter((p) => pesosDoNome(p.nome).unidade === peso)
    if (naUnidade.length === 1) return { tipo: 'resolvido', produto: naUnidade[0] }
    if (naUnidade.length > 1) return { tipo: 'ambiguo', opcoes: naUnidade }

    // 5. Nem embalagem nem unidade: a Mont não vende esse peso. As opções são as DA
    //    FAMÍLIA — "chipa só tem 1kg ou 2kg" —, nunca o catálogo inteiro.
    return { tipo: 'nao_encontrado', opcoes: familia }
}
```

- [ ] **Step 4: Exportar de `packages/shared/src/index.ts`**

Depois do bloco `} from './secretaria'`, acrescentar:

```typescript
// Catálogo da secretária — resolver o que o cliente escreveu em produto real
export { resolverTermo } from './catalogo'
export type { ProdutoVendavel, Resolucao } from './catalogo'
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm --filter interno exec vitest run src/utils/__tests__/catalogo.spec.ts`
Expected: PASS, 13 testes.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/catalogo.ts packages/shared/src/index.ts apps/interno/src/utils/__tests__/catalogo.spec.ts
git commit -m "feat(secretaria): resolucao de termo do cliente contra o catalogo real"
```

---

### Task 2: Renderização do pedido

**Files:**
- Modify: `packages/shared/src/catalogo.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/interno/src/utils/__tests__/catalogo.spec.ts`

**Interfaces:**
- Consumes: `ProdutoVendavel` da Task 1.
- Produces:
  - `interface ItemPedido { produtoId: string; nome: string; quantidade: number; precoUnitario: number; semEstoque: boolean }`
  - `function renderizarPedido(itens: ItemPedido[]): string`
  - `function totalPedido(itens: ItemPedido[]): number`

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar `renderizarPedido`, `totalPedido` e `type ItemPedido` ao import que já existe
no topo de `catalogo.spec.ts` (não criar um segundo import do mesmo módulo), e acrescentar
ao fim do arquivo:

```typescript
describe('renderizarPedido', () => {
    const itens: ItemPedido[] = [
        { produtoId: 'pq-1k-100', nome: 'Pão de Queijo 1kg - 100gr', quantidade: 1, precoUnitario: 30, semEstoque: false },
        { produtoId: 'chipa-1k', nome: 'Chipa 1kg', quantidade: 2, precoUnitario: 40, semEstoque: true },
    ]

    it('lista item, quantidade e subtotal', () => {
        const txt = renderizarPedido(itens)
        expect(txt).toContain('1× Pão de Queijo 1kg - 100gr')
        expect(txt).toContain('R$ 30,00')
        expect(txt).toContain('2× Chipa 1kg')
        expect(txt).toContain('R$ 80,00')
    })

    it('marca o que está sem estoque — a equipe confere antes de separar', () => {
        expect(renderizarPedido(itens)).toContain('⚠️')
    })

    it('não marca nada quando tudo tem estoque', () => {
        const ok = itens.map((i) => ({ ...i, semEstoque: false }))
        expect(renderizarPedido(ok)).not.toContain('⚠️')
    })

    it('pedido vazio tem texto próprio, não string vazia', () => {
        expect(renderizarPedido([])).toBe('(nenhum item)')
    })
})

describe('totalPedido', () => {
    it('soma quantidade × preço', () => {
        expect(totalPedido([
            { produtoId: 'a', nome: 'A', quantidade: 2, precoUnitario: 40, semEstoque: false },
            { produtoId: 'b', nome: 'B', quantidade: 1, precoUnitario: 30, semEstoque: false },
        ])).toBe(110)
    })

    it('pedido vazio soma zero', () => {
        expect(totalPedido([])).toBe(0)
    })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter interno exec vitest run src/utils/__tests__/catalogo.spec.ts`
Expected: FAIL com `renderizarPedido is not a function`.

- [ ] **Step 3: Implementar**

Acrescentar em `packages/shared/src/catalogo.ts`:

```typescript
export interface ItemPedido {
    produtoId: string
    nome: string
    quantidade: number
    /** Preço no momento em que ela FALOU com o cliente, não o de hoje. */
    precoUnitario: number
    semEstoque: boolean
}

function reais(v: number): string {
    return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export function totalPedido(itens: ItemPedido[]): number {
    return itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0)
}

/**
 * O pedido em texto, para a agente repetir ao cliente e para o aviso interno.
 *
 * A agente NUNCA monta esse texto: ela recebe daqui. Foi ela escrevendo o pedido de
 * cabeça que produziu "4 kg" a partir de um pedido de 2 kg somado com o da véspera.
 */
export function renderizarPedido(itens: ItemPedido[]): string {
    if (itens.length === 0) return '(nenhum item)'

    return itens
        .map((i) => {
            const alerta = i.semEstoque ? ' ⚠️ sem estoque no sistema' : ''
            return `${i.quantidade}× ${i.nome} — ${reais(i.quantidade * i.precoUnitario)}${alerta}`
        })
        .join('\n')
}
```

- [ ] **Step 4: Exportar**

Em `packages/shared/src/index.ts`, trocar o bloco do catálogo por:

```typescript
export { resolverTermo, renderizarPedido, totalPedido } from './catalogo'
export type { ProdutoVendavel, Resolucao, ItemPedido } from './catalogo'
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm --filter interno exec vitest run src/utils/__tests__/catalogo.spec.ts`
Expected: PASS, 19 testes.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/catalogo.ts packages/shared/src/index.ts apps/interno/src/utils/__tests__/catalogo.spec.ts
git commit -m "feat(secretaria): renderizacao do pedido — a agente nunca escreve o total"
```

---

### Task 3: Migration das tabelas

**Files:**
- Create: `supabase/migrations/20260928120000_wa_pedido.sql`

**Interfaces:**
- Consumes: `public.contatos(id)`, `public.produtos(id)`, `public.interacoes(id)`, `public.is_admin()`.
- Produces: tabelas `public.wa_pedido` e `public.wa_pedido_item`.

- [ ] **Step 1: Backup da produção**

Run: `Set-Location 'D:\3. DEV\mont'; .\supabase\scripts\dump-prod.ps1`
Expected: dois arquivos em `supabase/backups/dumps/`. **Obrigatório pela Regra de Ouro #3.**

- [ ] **Step 2: Escrever a migration**

Criar `supabase/migrations/20260928120000_wa_pedido.sql`:

```sql
-- Pedido que a secretária monta com o cliente, como DADO e não como frase.
--
-- Até 26/09/2026 o pedido era um texto que o próprio modelo escrevia. Três defeitos em
-- produção saíram disso: somar o pedido da véspera ("4 kg" a partir de 2 kg), gravar
-- antes de o cliente confirmar, e anotar "500 g de chipa" — embalagem que não existe.
-- Quatro tentativas de proibir por prompt falharam.
--
-- A garantia agora é a FK: item sem produto real não entra, nem que o modelo queira.

CREATE TABLE IF NOT EXISTS public.wa_pedido (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id    uuid NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  telefone_wa   text NOT NULL,
  status        text NOT NULL DEFAULT 'rascunho'
                CHECK (status IN ('rascunho','confirmado','abandonado')),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  confirmado_em timestamptz,
  interacao_id  uuid REFERENCES public.interacoes(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.wa_pedido IS
  'Pedido em construcao na conversa da secretaria de IA. Nao e venda: quem fecha e humano.';

-- No maximo UM rascunho por contato. Sem isto, duas execucoes simultaneas do W3 (o
-- debounce ja produziu isso em campo) criam dois rascunhos paralelos do mesmo cliente.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wa_pedido_aberto
  ON public.wa_pedido (contato_id) WHERE status = 'rascunho';

CREATE INDEX IF NOT EXISTS idx_wa_pedido_status
  ON public.wa_pedido (status, atualizado_em DESC);

CREATE TABLE IF NOT EXISTS public.wa_pedido_item (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid NOT NULL REFERENCES public.wa_pedido(id) ON DELETE CASCADE,
  produto_id      uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade      integer NOT NULL CHECK (quantidade > 0),
  preco_unitario  numeric NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.wa_pedido_item.preco_unitario IS
  'Preco que a agente FALOU para o cliente. Nao re-consultar: e promessa feita.';

-- Um produto aparece uma vez por pedido. "mais 1 kg de chipa" e alteracao de quantidade,
-- nunca segunda linha — acaba a ambiguidade "somar ou substituir" que gerou o 4 kg.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wa_pedido_item
  ON public.wa_pedido_item (pedido_id, produto_id);

-- Escrita: so service_role (a Edge Function). Leitura: admin, para auditoria.
ALTER TABLE public.wa_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_pedido_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ler wa_pedido" ON public.wa_pedido;
CREATE POLICY "Admins podem ler wa_pedido"
  ON public.wa_pedido FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins podem ler wa_pedido_item" ON public.wa_pedido_item;
CREATE POLICY "Admins podem ler wa_pedido_item"
  ON public.wa_pedido_item FOR SELECT TO authenticated USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 3: Aplicar na produção**

Aplicar o conteúdo da migration via MCP `apply_migration` com o nome `wa_pedido`.

- [ ] **Step 4: Provar que a FK recusa produto inventado**

Esta é a evidência de aceitação da tarefa — a garantia que a feature inteira compra.
Rodar via MCP `execute_sql`:

```sql
DO $$
DECLARE v_contato uuid; v_pedido uuid; v_falhou boolean := false;
BEGIN
  SELECT id INTO v_contato FROM public.contatos LIMIT 1;
  INSERT INTO public.wa_pedido (contato_id, telefone_wa) VALUES (v_contato, '0000') RETURNING id INTO v_pedido;
  BEGIN
    INSERT INTO public.wa_pedido_item (pedido_id, produto_id, quantidade, preco_unitario)
    VALUES (v_pedido, gen_random_uuid(), 1, 40);
  EXCEPTION WHEN foreign_key_violation THEN v_falhou := true;
  END;
  IF NOT v_falhou THEN RAISE EXCEPTION 'FK NAO PROTEGEU: produto inexistente foi aceito'; END IF;
  RAISE EXCEPTION 'OK — a FK recusou produto inexistente (rollback proposital)';
END $$;
```

Expected: erro `OK — a FK recusou produto inexistente (rollback proposital)`. O `RAISE
EXCEPTION` final garante rollback: nada fica gravado.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260928120000_wa_pedido.sql
git commit -m "feat(secretaria): tabelas do pedido estruturado com FK para produtos"
```

---

### Task 4: Migration dos sinônimos

**Files:**
- Create: `supabase/migrations/20260928120100_produtos_apelido_sinonimos.sql`

**Interfaces:**
- Consumes: `public.produtos`.
- Produces: `produtos.apelido` contendo sinônimos por vírgula nos 9 produtos vendáveis.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/20260928120100_produtos_apelido_sinonimos.sql`:

```sql
-- `produtos.apelido` muda de significado.
--
-- Guardava codigos de uma letra (X, P, C, B) para o ProductNicknamesModal do modulo de
-- pedidos de compra, que o diretor confirmou nao usar mais. Passa a guardar os SINONIMOS
-- do cliente, separados por virgula — e o cliente nunca escreve "Massa Pao de Queijo 1kg",
-- escreve "baldinho".
--
-- Por que sinonimo curado e nao busca por pedaco do nome: "pao de queijo" aparece em cinco
-- produtos, dois deles massa CRUA. Substring devolveria os cinco e a agente perguntaria se
-- ele quer pronto ou cru numa conversa em que ele claramente quis o pronto.
--
-- ATENCAO: produto novo cadastrado SEM apelido some do vocabulario da agente sem erro
-- nenhum — ela responde que a Mont nao vende aquilo. Ver a secao de riscos da spec.

UPDATE public.produtos SET apelido = 'pão de queijo, pao de queijo, pdq, congelado'
 WHERE nome IN ('Pão de Queijo 1kg - 25gr', 'Pão de Queijo 1kg - 100gr', 'Pão de Queijo 2kg - 50gr');

UPDATE public.produtos SET apelido = 'baldinho, massa, massa crua, resfriado'
 WHERE nome = 'Massa Pão de Queijo 1kg';

UPDATE public.produtos SET apelido = 'balde, baldão, massa, resfriado'
 WHERE nome = 'Massa Pão de Queijo 4kg';

UPDATE public.produtos SET apelido = 'chipa, chipinha'
 WHERE nome IN ('Chipa 1kg', 'Chipa 2kg');

UPDATE public.produtos SET apelido = 'palito, palito de queijo'
 WHERE nome IN ('Palito de Queijo 1kg', 'Palito de Queijo 2kg');

COMMENT ON COLUMN public.produtos.apelido IS
  'Sinonimos do cliente, separados por virgula. Usado pela secretaria de IA para resolver o que o cliente escreveu em produto real.';
```

- [ ] **Step 2: Aplicar na produção**

Aplicar via MCP `apply_migration` com o nome `produtos_apelido_sinonimos`.

- [ ] **Step 3: Conferir que os 9 vendáveis têm sinônimo**

Rodar via MCP `execute_sql`:

```sql
SELECT nome, apelido FROM public.produtos
WHERE ativo AND visivel_catalogo ORDER BY nome;
```

Expected: 9 linhas, nenhuma com `apelido` nulo, vazio ou de uma letra só.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260928120100_produtos_apelido_sinonimos.sql
git commit -m "feat(secretaria): apelido vira sinonimo do cliente, nao codigo interno"
```

---

### Task 5: As ferramentas na Edge Function

**Files:**
- Modify: `supabase/functions/whatsapp-secretaria/index.ts`

**Interfaces:**
- Consumes: `resolverTermo`, `renderizarPedido`, `totalPedido`, `ProdutoVendavel`, `ItemPedido` das Tasks 1–2; as tabelas da Task 3.
- Produces: ações `adicionar_item`, `alterar_quantidade`, `remover_item`, `confirmar_pedido`, `rascunhos_abandonados`. Remove `registrar_pedido_intencao`, `intencoes_a_avisar`, `pedidoVigente`/`lerIntencoes`.

- [ ] **Step 1: Trocar o leitor de catálogo**

`lerCatalogo` hoje devolve só `{ nome, preco }`. As ferramentas precisam de `id`, `apelido`
e `estoque_atual`. Substituir a função inteira (linhas 85–94) por:

```typescript
async function lerCatalogo(admin: SupabaseClient): Promise<ProdutoVendavel[]> {
  const { data } = await admin
    .from('produtos')
    .select('id, nome, apelido, preco, estoque_atual')
    .eq('ativo', true)
    .eq('visivel_catalogo', true)
    .order('nome')

  return (data ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    apelido: (p.apelido ?? null) as string | null,
    preco: Number(p.preco ?? 0),
    estoqueAtual: Number(p.estoque_atual ?? 0),
  }))
}
```

E trocar o import do topo para incluir o módulo novo:

```typescript
import {
  resolverTermo,
  renderizarPedido,
  totalPedido,
  type ProdutoVendavel,
  type ItemPedido,
} from '../../../packages/shared/src/catalogo.ts'
```

Remover a interface local `ItemCatalogo` (agora é `ProdutoVendavel`).

- [ ] **Step 2: Escrever os helpers do pedido**

Acrescentar antes de `Deno.serve`:

```typescript
/** O rascunho aberto do contato, ou `null`. Nunca cria. */
async function lerRascunho(admin: SupabaseClient, contatoId: string) {
  const { data } = await admin
    .from('wa_pedido')
    .select('id, status, interacao_id')
    .eq('contato_id', contatoId)
    .eq('status', 'rascunho')
    .maybeSingle()
  return data
}

/**
 * Por quanto tempo depois de confirmar o cliente ainda esta no MESMO pedido.
 *
 * "Ah, esqueci, poe mais 1 kg" dois minutos depois e a mesma compra; um pedido novo na
 * semana seguinte nao e. Sem esse prazo, ou toda mensagem reabriria o pedido antigo para
 * sempre, ou a equipe receberia dois CONFIRMADO para uma entrega so.
 */
const JANELA_REABERTURA_MS = 2 * 60 * 60 * 1000

/**
 * O pedido em que os itens devem entrar: o rascunho aberto, ou o confirmado ha pouco
 * REABERTO, ou um novo.
 *
 * A reabertura preserva `interacao_id` — e ele que faz a confirmacao seguinte ATUALIZAR a
 * linha da timeline em vez de criar outra, e o aviso sair como ATUALIZADO em vez de um
 * segundo CONFIRMADO.
 */
async function abrirRascunho(admin: SupabaseClient, contatoId: string, telefoneWa: string) {
  const existente = await lerRascunho(admin, contatoId)
  if (existente) return existente

  const desde = new Date(Date.now() - JANELA_REABERTURA_MS).toISOString()
  const { data: recemConfirmado } = await admin
    .from('wa_pedido')
    .select('id, status, interacao_id')
    .eq('contato_id', contatoId)
    .eq('status', 'confirmado')
    .gte('confirmado_em', desde)
    .order('confirmado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recemConfirmado) {
    await admin.from('wa_pedido').update({ status: 'rascunho' }).eq('id', recemConfirmado.id)
    return { ...recemConfirmado, status: 'rascunho' }
  }

  const { data, error } = await admin
    .from('wa_pedido')
    .insert({ contato_id: contatoId, telefone_wa: telefoneWa })
    .select('id, status, interacao_id')
    .single()

  if (error) throw new Error(`nao foi possivel abrir o pedido: ${error.message}`)
  return data
}

/** Itens do pedido, já com o alerta de estoque resolvido contra o catálogo. */
async function lerItens(
  admin: SupabaseClient,
  pedidoId: string,
  catalogo: ProdutoVendavel[],
): Promise<ItemPedido[]> {
  const { data } = await admin
    .from('wa_pedido_item')
    .select('produto_id, quantidade, preco_unitario')
    .eq('pedido_id', pedidoId)
    .order('criado_em')

  return (data ?? []).map((i) => {
    const p = catalogo.find((c) => c.id === i.produto_id)
    return {
      produtoId: i.produto_id as string,
      nome: p?.nome ?? '(produto removido do catálogo)',
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.preco_unitario),
      semEstoque: (p?.estoqueAtual ?? 0) <= 0,
    }
  })
}

/**
 * Resposta padrão de toda mutação: o pedido INTEIRO, renderizado.
 *
 * A agente nunca soma nem formata — ela repete isto. Foi ela escrevendo o pedido de
 * cabeça que somou o pedido da véspera e anotou 4 kg onde o cliente pediu 2 kg.
 */
async function responderPedido(admin: SupabaseClient, pedidoId: string, catalogo: ProdutoVendavel[]) {
  const itens = await lerItens(admin, pedidoId, catalogo)
  await admin.from('wa_pedido').update({ atualizado_em: new Date().toISOString() }).eq('id', pedidoId)

  return {
    ok: true,
    pedido: renderizarPedido(itens),
    total: totalPedido(itens),
    itens: itens.length,
  }
}

/**
 * Traduz a resolução do termo em resposta para a agente.
 *
 * União discriminada de propósito: com `{ produto, resposta }` o TypeScript não consegue
 * provar que `produto` não é nulo depois de checar `resposta`, e a saída seria um `as`
 * — proibido pela Regra de Ouro #1.
 */
type Traduzido =
  | { tipo: 'segue'; produto: ProdutoVendavel }
  | { tipo: 'responde'; corpo: Record<string, unknown> }

function respostaDaResolucao(termo: string, catalogo: ProdutoVendavel[]): Traduzido {
  const r = resolverTermo(termo, catalogo)

  if (r.tipo === 'resolvido') return { tipo: 'segue', produto: r.produto }

  const opcoes = r.opcoes.map((p) => ({ id: p.id, nome: p.nome, preco: p.preco }))

  if (r.tipo === 'ambiguo') {
    return {
      tipo: 'responde',
      corpo: {
        ok: false,
        motivo: 'ambiguo',
        opcoes,
        instrucao: 'Pergunte ao cliente qual destes ele quer. NAO escolha por ele. NAO grave nada. Se o cliente citou MAIS DE UM produto na mesma frase, chame a ferramenta uma vez por produto em vez de perguntar.',
      },
    }
  }

  return {
    tipo: 'responde',
    corpo: {
      ok: false,
      motivo: 'nao_encontrado',
      opcoes,
      instrucao: opcoes.length > 0
        ? 'A Mont nao vende essa embalagem. Diga ao cliente quais existem, listadas em opcoes.'
        : 'A Mont nao vende esse produto. Diga isso ao cliente. NAO ofereca substituto que nao esteja no catalogo.',
    },
  }
}
```

- [ ] **Step 3: Escrever as quatro ações**

⚠️ **`rascunhos_abandonados` é GLOBAL** — varre todos os contatos e não recebe `jid` nem
`telefone_wa`. O guard `if (!telefoneWa) return json({ error: ... }, 400)` mataria a
chamada, então o bloco dela vai **antes desse guard**, logo depois do `createClient`. As
outras três ficam onde estão, junto das demais ações.

Substituir o bloco inteiro de `if (body.acao === 'registrar_pedido_intencao') { ... }` e o
de `if (body.acao === 'intencoes_a_avisar') { ... }` por:

```typescript
    if (
      body.acao === 'adicionar_item' ||
      body.acao === 'alterar_quantidade' ||
      body.acao === 'remover_item'
    ) {
      const termo = typeof body.termo === 'string' ? body.termo : ''
      const produtoIdDireto = typeof body.produto_id === 'string' ? body.produto_id : ''
      if (!termo && !produtoIdDireto) return json({ error: 'termo ou produto_id e obrigatorio' }, 400)

      const { data: contato } = await admin
        .from('contatos').select('id').eq('telefone_wa', telefoneWa).maybeSingle()
      if (!contato) return json({ error: 'contato_nao_casado' }, 404)

      const catalogo = await lerCatalogo(admin)

      // `produto_id` vem de uma resposta `ambiguo` anterior: o cliente ja escolheu, nao ha
      // o que resolver de novo.
      let produto = produtoIdDireto ? catalogo.find((p) => p.id === produtoIdDireto) : undefined
      if (!produto) {
        const r = respostaDaResolucao(termo, catalogo)
        if (r.tipo === 'responde') return json(r.corpo, 200)
        produto = r.produto
      }

      const pedido = await abrirRascunho(admin, contato.id, telefoneWa)

      if (body.acao === 'remover_item') {
        await admin.from('wa_pedido_item').delete()
          .eq('pedido_id', pedido.id).eq('produto_id', produto.id)
        return json(await responderPedido(admin, pedido.id, catalogo), 200)
      }

      const quantidade = Number(body.quantidade)
      if (!Number.isInteger(quantidade) || quantidade < 1) {
        return json({ error: 'quantidade deve ser inteiro maior que zero' }, 400)
      }

      // `upsert` pelo indice unico (pedido_id, produto_id): adicionar de novo o mesmo
      // produto ALTERA a quantidade em vez de criar segunda linha. As duas acoes se
      // comportam igual de proposito — e a unica representacao possivel no banco.
      const { error } = await admin.from('wa_pedido_item').upsert(
        {
          pedido_id: pedido.id,
          produto_id: produto.id,
          quantidade,
          preco_unitario: produto.preco,
        },
        { onConflict: 'pedido_id,produto_id' },
      )
      if (error) return json({ error: error.message }, 400)

      return json(await responderPedido(admin, pedido.id, catalogo), 200)
    }

    if (body.acao === 'confirmar_pedido') {
      const { data: contato } = await admin
        .from('contatos').select('id, nome').eq('telefone_wa', telefoneWa).maybeSingle()
      if (!contato) return json({ error: 'contato_nao_casado' }, 404)

      const pedido = await lerRascunho(admin, contato.id)
      if (!pedido) return json({ ok: false, motivo: 'sem_pedido_aberto' }, 200)

      const catalogo = await lerCatalogo(admin)
      const itens = await lerItens(admin, pedido.id, catalogo)
      if (itens.length === 0) return json({ ok: false, motivo: 'pedido_vazio' }, 200)

      const texto = renderizarPedido(itens)
      const observacao = `[pedido confirmado] ${itens.map((i) => `${i.quantidade}x ${i.nome}`).join(' + ')}`

      // Reabertura: ATUALIZA a linha da timeline que ja existe, em vez de criar outra.
      // O perfil do cliente mostra o pedido, nao tres versoes dele se montando.
      let interacaoId = pedido.interacao_id as string | null
      if (interacaoId) {
        await admin.from('interacoes').update({ observacao }).eq('id', interacaoId)
      } else {
        const { data: pendentes } = await admin
          .from('mensagens_whatsapp').select('message_id')
          .eq('telefone_wa', telefoneWa).is('processado_em', null).eq('historico', false)

        const { data: novaId } = await admin.rpc('rpc_registrar_interacao_ia', {
          p_telefone_wa: telefoneWa,
          p_payload: { tipo: 'ponto_contato', sentido: 'entrada', resultado: 'aceitou', observacao },
          p_message_ids: (pendentes ?? []).map((m) => m.message_id),
        })
        interacaoId = novaId as string | null
      }

      await admin.from('wa_pedido').update({
        status: 'confirmado',
        confirmado_em: new Date().toISOString(),
        interacao_id: interacaoId,
      }).eq('id', pedido.id)

      return json({
        ok: true,
        atualizacao: pedido.interacao_id !== null,
        pedido: texto,
        total: totalPedido(itens),
        contato: contato.nome,
        telefone_wa: telefoneWa,
      }, 200)
    }

    // Consultada pelo W4. Rascunho parado, com item, em conversa que nenhum humano tocou.
    if (body.acao === 'rascunhos_abandonados') {
      const minutos = typeof body.minutos === 'number' ? body.minutos : 30
      const limite = new Date(Date.now() - minutos * 60_000).toISOString()

      const { data: parados } = await admin
        .from('wa_pedido')
        .select('id, contato_id, telefone_wa')
        .eq('status', 'rascunho')
        .lt('atualizado_em', limite)

      const catalogo = await lerCatalogo(admin)
      const saida: unknown[] = []

      for (const p of parados ?? []) {
        const itens = await lerItens(admin, p.id, catalogo)
        if (itens.length === 0) continue

        // Guarda: humano atendendo nao vira alerta de abandono. Sem isto o robo avisaria
        // o grupo sobre um cliente que o Gilmar ja esta atendendo.
        const { data: msgs } = await admin
          .from('mensagens_whatsapp')
          .select('message_id, direcao, enviada_em')
          .eq('telefone_wa', p.telefone_wa).eq('historico', false)
          .order('enviada_em', { ascending: false }).limit(MAX_MENSAGENS_CONTEXTO)

        const { data: envios } = await admin
          .from('wa_envios').select('message_id').eq('telefone_wa', p.telefone_wa)
        const idsDaAgente = new Set((envios ?? []).map((e) => e.message_id))

        const humano = (msgs ?? []).some(
          (m) => m.direcao === 'saida' && !idsDaAgente.has(m.message_id),
        )

        if (humano) {
          await admin.from('wa_pedido').update({ status: 'abandonado' }).eq('id', p.id)
          continue
        }

        const { data: c } = await admin
          .from('contatos').select('nome').eq('id', p.contato_id).maybeSingle()

        await admin.from('wa_pedido').update({ status: 'abandonado' }).eq('id', p.id)

        saida.push({
          telefone_wa: p.telefone_wa,
          contato: c?.nome ?? 'Cliente',
          pedido: renderizarPedido(itens),
          total: totalPedido(itens),
        })
      }

      return json({ ok: true, abandonados: saida }, 200)
    }
```

- [ ] **Step 4: Limpar o que morreu**

Remover de `index.ts`:
- a função `lerIntencoes` inteira
- o import de `pedidoVigente`, `JANELA_PEDIDO_MS` e `IntencaoRegistrada`
- a linha `pedido_atual: pedidoVigente(...)` de `montarContexto`

E acrescentar no retorno de `montarContexto`, no lugar dela:

```typescript
    // O rascunho vai como FATO, derivado das linhas. A agente nao deduz pedido da conversa.
    pedido_atual: await (async () => {
      const r = await lerRascunho(admin, contato.id)
      if (!r) return null
      const cat = await lerCatalogo(admin)
      return renderizarPedido(await lerItens(admin, r.id, cat))
    })(),
```

Atualizar a lista de ações válidas no final do arquivo para:

```typescript
      acoes: [
        'contexto', 'registrar_envio', 'consultar_produto', 'consultar_frete',
        'adicionar_item', 'alterar_quantidade', 'remover_item', 'confirmar_pedido',
        'rascunhos_abandonados', 'preparar_envio', 'destino_aviso',
      ],
```

- [ ] **Step 5: Deployar**

Run: `npx supabase functions deploy whatsapp-secretaria --project-ref herlvujykltxnwqmwmyx`
Expected: `Deployed Functions on project herlvujykltxnwqmwmyx: whatsapp-secretaria`

- [ ] **Step 6: Sondar as três respostas contra a produção**

Com `INGESTOR_SECRET` de `infra/crm/.env` e o número da allowlist (`5511980017732`):

```bash
U="https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/whatsapp-secretaria"
J='5511980017732@s.whatsapp.net'
post() { curl -s -X POST "$U" -H "x-ingestor-secret: $S" -H 'Content-Type: application/json' -d "$1"; }

post "{\"acao\":\"adicionar_item\",\"jid\":\"$J\",\"termo\":\"500g de chipa\",\"quantidade\":1}"
post "{\"acao\":\"adicionar_item\",\"jid\":\"$J\",\"termo\":\"1 kg de pão de queijo\",\"quantidade\":1}"
post "{\"acao\":\"adicionar_item\",\"jid\":\"$J\",\"termo\":\"2 kg de pão de queijo\",\"quantidade\":1}"
```

Expected, em ordem: `motivo: nao_encontrado` com as duas chipas; `motivo: ambiguo` com os
dois de 1 kg; e `ok: true` com o pedido renderizado.

- [ ] **Step 7: Limpar o rascunho da sondagem**

```sql
DELETE FROM public.wa_pedido
 WHERE telefone_wa = '5511980017732' AND status = 'rascunho';
```

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/whatsapp-secretaria/index.ts
git commit -m "feat(secretaria): ferramentas de mutacao no lugar do resumo em texto livre"
```

---

### Task 6: Religar o W3

**Files:**
- Modify: `infra/crm/workflows/w3-secretaria.json`

**Interfaces:**
- Consumes: as ações da Task 5.
- Produces: W3 com 4 tools novas, prompt novo e ramo de aviso ligado ao `confirmar_pedido`.

- [ ] **Step 1: Trocar as tools**

No workflow, remover o nó `registrar_pedido_intencao` e criar quatro
`n8n-nodes-base.httpRequestTool` typeVersion 4.4, todos com a credencial da Edge Function e
`$fromAI()` nos parâmetros. Modelo de um (repetir para os outros três):

```
nome: adicionar_item
toolDescription: "Adiciona UM produto ao pedido do cliente. Use assim que ele disser o que
  quer. Se ele pedir dois produtos na mesma frase, chame esta ferramenta duas vezes — um
  item por chamada. Se a resposta vier com motivo 'ambiguo' ou 'nao_encontrado', NADA foi
  gravado: siga a instrucao que veio junto e fale com o cliente."
jsonBody: ={{ JSON.stringify({
    acao: 'adicionar_item',
    jid: $('Extrair mensagem').first().json.jid,
    termo: $fromAI('termo', 'O que o cliente escreveu, cru. Ex: "1 kg de chipa"', 'string'),
    quantidade: $fromAI('quantidade', 'Quantas unidades daquela embalagem', 'number'),
    produto_id: $fromAI('produto_id', 'So quando o cliente ja escolheu entre opcoes de uma resposta ambigua. Senao deixe vazio', 'string')
  }) }}
```

Os outros três, por extenso — o executor pode estar lendo esta tarefa fora de ordem:

```
nome: alterar_quantidade
toolDescription: "Muda a quantidade de um produto que JA esta no pedido. Mesma resposta de
  adicionar_item: se vier 'ambiguo' ou 'nao_encontrado', nada foi gravado."
jsonBody: ={{ JSON.stringify({
    acao: 'alterar_quantidade',
    jid: $('Extrair mensagem').first().json.jid,
    termo: $fromAI('termo', 'Qual produto o cliente quer mudar, como ele escreveu', 'string'),
    quantidade: $fromAI('quantidade', 'A quantidade NOVA, nao a diferenca', 'number'),
    produto_id: $fromAI('produto_id', 'So quando o cliente ja escolheu entre opcoes de uma resposta ambigua. Senao deixe vazio', 'string')
  }) }}

nome: remover_item
toolDescription: "Tira um produto do pedido. Use quando o cliente cancelar um item
  especifico. Devolve o pedido que sobrou."
jsonBody: ={{ JSON.stringify({
    acao: 'remover_item',
    jid: $('Extrair mensagem').first().json.jid,
    termo: $fromAI('termo', 'Qual produto sai, como o cliente escreveu', 'string'),
    produto_id: $fromAI('produto_id', 'So quando o cliente ja escolheu entre opcoes de uma resposta ambigua. Senao deixe vazio', 'string')
  }) }}

nome: confirmar_pedido
toolDescription: "Fecha o pedido e avisa a equipe. Chame SOMENTE depois de o cliente
  confirmar que pode fechar. Antes disso a equipe nao sabe de nada."
jsonBody: ={{ JSON.stringify({
    acao: 'confirmar_pedido',
    jid: $('Extrair mensagem').first().json.jid
  }) }}
```

- [ ] **Step 2: Reescrever a seção de pedido do prompt**

Remover do `systemMessage` **todas** as regras de pedido: o bloco "QUANDO É PEDIDO",
"QUANDO REGISTRAR PEDIDO", a regra da janela, o "na dúvida registre", o "não repita a
pergunta" e o "não chame nenhuma ferramenta de registro". Colocar no lugar:

```
PEDIDO
- Voce nao anota pedido escrevendo texto. Voce usa as ferramentas: adicionar_item,
  alterar_quantidade, remover_item, confirmar_pedido.
- Se a mensagem diz QUANTO de QUAL produto, chame adicionar_item na hora.
- UM item por chamada. Se ele pedir "1 kg de chipa e 2 de palito", sao duas chamadas.
- A ferramenta pode responder 'ambiguo' (mais de um produto serve) ou 'nao_encontrado'
  (a Mont nao vende aquilo). Nos dois casos NADA foi gravado. Leia a instrucao que veio
  na resposta e fale com o cliente.
- Quando vier 'ambiguo' por tamanho, nao liste tudo como menu de robo: chute o provavel e
  confirme junto, numa frase so. Ex: "O pao de queijo congelado, ne? De qual grama voce
  vai preferir?" Se voce errar o chute, ele corrige.
- Toda resposta de sucesso traz o pedido inteiro montado, no campo `pedido`. REPITA ele
  para o cliente, com as quantidades. Nunca escreva o pedido de cabeca, nunca some nada.
- Quando o cliente terminar, pergunte se pode fechar. So depois do sim dele chame
  confirmar_pedido. Antes disso a equipe nao e avisada de nada.
- Depois de confirmado, se ele acrescentar algo, e so usar as ferramentas de novo: o
  pedido reabre sozinho.
- O catalogo que voce recebe traz `estoqueAtual`. Produto com estoque zero ou negativo
  voce NAO oferece por conta propria: nao sugere, nao cita como alternativa. Mas se o
  cliente pedir por ele, ACEITE normalmente — quem sabe o que tem no freezer e a equipe,
  nao voce, e recusar venda por causa de numero errado e pior que avisar.
- NUNCA fale de estoque com o cliente. Nem "temos", nem "acabou", nem "esta em falta".
```

- [ ] **Step 3: Ligar o aviso ao `confirmar_pedido`**

Hoje o ramo de aviso pende de `Liberar presença` → `Houve intenção de compra?`. Remover
esses nós (`Houve intenção de compra?`, `Tem intenção?`, `Redis: já avisei esta?`,
`Aviso novo?`, `Redis: marcar avisada`) e ligar `Destino do aviso (intenção)` diretamente à
saída da tool `confirmar_pedido`, com o texto:

```
={{ JSON.stringify({ number: $json.jid.split('@')[0], text:
  `🛒 PEDIDO ${$('confirmar_pedido').first().json.atualizacao ? 'ATUALIZADO' : 'CONFIRMADO'} — ${$('confirmar_pedido').first().json.contato} (${$('confirmar_pedido').first().json.telefone_wa})\n${$('confirmar_pedido').first().json.pedido}\nProdutos: R$ ${$('confirmar_pedido').first().json.total.toFixed(2).replace('.',',')} (sem frete)\n${$('confirmar_pedido').first().json.atualizacao ? '⚠️ Ja tinha sido avisado antes. Confira se nao foi separado.' : 'Alguem precisa fechar.'}`,
  delay: 0, linkPreview: false }) }}
```

O dedup em Redis sai junto: `confirmar_pedido` só dispara quando o cliente confirma, então
não há repetição para deduplicar.

- [ ] **Step 4: Subir e espelhar**

Fazer `PUT` em `http://127.0.0.1:5678/api/v1/workflows/JAibLGIwNDLJN0Ym` com
`X-N8N-API-KEY`, depois reler e gravar em `infra/crm/workflows/w3-secretaria.json`.

Expected: `active: true`, e as quatro tools presentes na leitura de volta.

- [ ] **Step 5: Commit**

```bash
git add infra/crm/workflows/w3-secretaria.json
git commit -m "feat(secretaria): W3 usa as ferramentas de pedido e avisa so na confirmacao"
```

---

### Task 7: W4 — o relógio do abandono

**Files:**
- Create: `infra/crm/workflows/w4-abandono.json`

**Interfaces:**
- Consumes: ação `rascunhos_abandonados` da Task 5; `destino_aviso` (já existe).
- Produces: workflow n8n novo, ativo.

- [ ] **Step 1: Montar o workflow**

Cinco nós:

1. `Schedule Trigger` — `minutes`, intervalo 10.
2. `httpRequest` **Buscar abandonados** — POST na Edge Function,
   `{"acao":"rascunhos_abandonados","minutos":30}` com a credencial do ingestor.
   ⚠️ Esta ação **não** recebe `jid`: ela varre todos os contatos. A Edge Function aceita
   `telefone_wa` ou `jid` para as outras ações, mas esta é global — o handler dela roda
   antes da exigência de telefone.
3. `Code` **Um por vez** — `return $json.abandonados.map(a => ({ json: a }))`.
4. `httpRequest` **Destino do aviso** — `{"acao":"destino_aviso","jid": <jid do abandonado>}`.
5. `httpRequest` **Avisar abandono** — `sendText` na Evolution:

```
⏳ NAO CONFIRMADO — {contato} ({telefone})
Montou isto e parou de responder ha 30 min:
{pedido}
Produtos: R$ {total}
Ninguem confirmou. Vale um empurrao?
```

- [ ] **Step 2: Conferir que a ação global responde sem `jid`**

A Task 5 já posicionou `rascunhos_abandonados` antes do guard de telefone. Confirmar com
uma chamada sem `jid`:

```bash
curl -s -X POST "https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/whatsapp-secretaria"   -H "x-ingestor-secret: $S" -H 'Content-Type: application/json'   -d '{"acao":"rascunhos_abandonados","minutos":30}'
```

Expected: `{"ok":true,"abandonados":[...]}` — **não** um 400 de telefone obrigatório. Se
vier 400, o bloco ficou no lugar errado na Task 5: mover e redeployar.

- [ ] **Step 3: Provar que o W4 funciona sem esperar 30 minutos**

Criar um rascunho velho à mão e rodar o workflow manualmente:

```sql
-- rascunho com item, envelhecido 40 minutos
WITH p AS (
  INSERT INTO public.wa_pedido (contato_id, telefone_wa, atualizado_em)
  SELECT id, telefone_wa, now() - interval '40 minutes'
    FROM public.contatos WHERE telefone_wa = '5511980017732'
  RETURNING id
)
INSERT INTO public.wa_pedido_item (pedido_id, produto_id, quantidade, preco_unitario)
SELECT p.id, pr.id, 1, pr.preco FROM p, public.produtos pr WHERE pr.nome = 'Chipa 1kg';
```

Executar o W4 pela UI do n8n. Expected: aviso `⏳ NAO CONFIRMADO` no grupo, e o rascunho
com `status = 'abandonado'`.

- [ ] **Step 4: Commit**

```bash
git add infra/crm/workflows/w4-abandono.json supabase/functions/whatsapp-secretaria/index.ts
git commit -m "feat(secretaria): W4 avisa pedido montado e abandonado"
```

---

### Task 8: Fechamento

**Files:**
- Modify: `packages/shared/src/secretaria.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/interno/src/utils/__tests__/secretaria.spec.ts`

- [ ] **Step 1: Remover `pedidoVigente` e `JANELA_PEDIDO_MS`**

Substituídos pelo `status` do pedido. Remover a função, a constante, a interface
`IntencaoRegistrada`, os reexports em `index.ts` e o bloco `describe('pedidoVigente')` do
arquivo de teste.

- [ ] **Step 2: Rodar a suíte inteira**

Run: `pnpm --filter interno exec vitest run --exclude "**/*.integration.test.ts"`
Expected: PASS. A contagem cai 6 (os de `pedidoVigente`) e sobe 19 (os de `catalogo`).

- [ ] **Step 3: Typecheck nos dois apps**

Run: `pnpm --filter interno exec tsc --noEmit` e `pnpm --filter catalogo exec tsc --noEmit`
Expected: exit 0 nos dois.

- [ ] **Step 4: Commit**

```bash
git add packages/shared apps/interno/src/utils/__tests__/secretaria.spec.ts
git commit -m "refactor(secretaria): remover a janela de pedido, substituida pelo status"
```

- [ ] **Step 5: Roteiro de conversa para o diretor validar**

Do número da allowlist, uma mensagem por vez:

| # | mensagem | esperado |
|---|---|---|
| 1 | `me vê 500g de chipa` | diz que só tem 1kg e 2kg; **nada gravado** |
| 2 | `então 1 kg de chipa` | anota e repete o pedido |
| 3 | `quero pão de queijo também` | chuta congelado e pergunta a grama, numa frase |
| 4 | `o de 100g` | anota; pedido tem os dois |
| 5 | `na verdade só 1 kg do pão de queijo` | altera só o pão de queijo, chipa intacta |
| 6 | `pode fechar` | 🛒 PEDIDO CONFIRMADO no grupo, com total |
| 7 | `esqueci, põe 1 kg de palito` | reabre; 🛒 PEDIDO ATUALIZADO com o alerta |

Conferir no banco ao final:

```sql
SELECT p.status, pr.nome, i.quantidade, i.preco_unitario
  FROM public.wa_pedido p
  JOIN public.wa_pedido_item i ON i.pedido_id = p.id
  JOIN public.produtos pr ON pr.id = i.produto_id
 WHERE p.telefone_wa = '5511980017732'
 ORDER BY p.criado_em DESC, i.criado_em;
```

---

## Notas de execução

**A ordem importa.** Tasks 1–2 são puras e não tocam nada em produção. Task 3 mexe em
schema e exige o backup. Task 5 depende de 1–4. Task 6 depende de 5. Task 7 depende de 5 e
6. Não paralelizar 5 com 6: as duas mexem no caminho que a agente usa ao vivo.

**A gaiola fica fechada o plano inteiro.** Todo teste é com o número do diretor.

**O que não está aqui, de propósito:** tela no Mont Interno, estoque como trava, pedido
virando venda, sugerir tamanho por histórico. Estão na seção "Fora de escopo" da spec.
