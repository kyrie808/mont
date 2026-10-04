# Márcia — de secretária para vendedora: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a agente de WhatsApp de registradora de pedido em vendedora — persona comercial, vocabulário da Mont, contexto de turno (hora/primeiro contato/histórico de compra) e retomada ativa de cliente que parou de responder.

**Architecture:** Três camadas separadas por onde o modelo lê cada coisa. Identidade e voz no system prompt (~280 palavras). Mecânica de pedido dentro da `toolDescription` de cada ferramenta. Contexto do turno injetado pelo nó `Montar entrada do agente` a partir do que a ação `contexto` da Edge Function devolve. Toda renderização de texto é função pura em `packages/shared` — única pasta que o Deno da Edge Function e o Vitest do interno alcançam.

**Tech Stack:** Supabase Edge Function (Deno) + Postgres/migration versionada + n8n 2.33.7 (W3 agente, W4 cron) + Evolution API v2.3.7 + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-marcia-vendedora-design.md`

## Global Constraints

- **Zero `as any`.** Tipar corretamente sempre (CLAUDE.md Regra de Ouro #1).
- **A GAIOLA É INVIOLÁVEL.** Qualquer mensagem nova que vá para o **cliente** passa por `estaLiberado(telefoneWa, lerAllowlist(), lerModo())` antes de sair. Hoje a gaiola existe só em `contexto` — a ação `rascunhos_abandonados` é global e nunca falou com cliente. A Etapa 1 da retomada é o **primeiro** caminho que manda mensagem a cliente fora do W3; sem o filtro explícito, a primeira execução em modo `dev` escreve para todo cliente real com rascunho parado.
- **Não tocar** AuthGuard, policies RLS, validação Zod de boundary, sanitização de input (CLAUDE.md).
- **Migration:** rodar `.\supabase\scripts\dump-prod.ps1` ANTES e escrever arquivo versionado em `supabase/migrations/`, mesmo aplicando direto na prod (CLAUDE.md Regra #3).
- **Nenhum nó de envio ganha `onError: continueRegularOutput`.** Falha de envio tem que ficar vermelha. Em 30/09 esse flag no último nó do W4 transformou falha de envio em execução verde com o pedido já marcado `abandonado` — ninguém SABIA.
- **Lógica pura em `packages/shared/src/*.ts`**, exportada por `index.ts`, testada em `apps/interno/src/utils/__tests__/*.spec.ts`. É o padrão de `catalogo.ts`/`secretaria.ts`/`whatsapp.ts`: o Vitest roda com root em `apps/interno` e não enxerga teste dentro de `packages/`.
- **`Intl` não entra em string montada à mão** sem `formatToParts`. `formatCurrency` já mordeu este projeto colocando NBSP invisível no meio do texto.
- **Vocabulário da Mont, literal:** "pacote de 1 kg", "pacote de 2 kg", "pão de 25 g / 50 g / 100 g". **Nunca** "porções". **Nunca** "qual embalagem". Baldinho (1 kg) e Balde (4 kg) são **massa crua**.
- **Teto do prompt: ~300 palavras.** Passar disso é o sinal de que a dívida voltou.
- **A Edge Function `whatsapp-secretaria` já existe** e tem entrada em `supabase/config.toml`. É **redeploy**, não função nova. Não remover nem alterar a entrada do `config.toml`: sem ela o deploy liga `verify_jwt=true` e mata a chamada em silêncio (derrubou a CAPI por 3 dias em 08-10/08).
- **Nada de `⚠️ sem estoque no sistema` em texto que vai para o cliente.** `renderizarPedido` embute esse alerta, que é interno.

---

## Estrutura de arquivos

| arquivo | responsabilidade |
|---|---|
| `packages/shared/src/marcia.ts` *(novo)* | renderização do contexto do turno e do texto da retomada — funções puras |
| `apps/interno/src/utils/__tests__/marcia.spec.ts` *(novo)* | testes das puras acima |
| `packages/shared/src/catalogo.ts` | ganha `renderizarPedidoCliente` (sem o alerta interno) |
| `packages/shared/src/index.ts` | exporta o novo módulo |
| `supabase/migrations/20261005000000_wa_pedido_retomado_em.sql` *(novo)* | coluna `retomado_em` |
| `supabase/functions/whatsapp-secretaria/index.ts` | `contexto` enriquecido, `disponivel`, abandono em 2 etapas, ação `avisar_99` |
| `infra/crm/workflows/w3-secretaria.json` | prompt, descrições de ferramenta, injeção, ferramenta `avisar_99` |
| `infra/crm/workflows/w4-abandono.json` | duas etapas |
| `apps/interno/src/utils/__tests__/catalogo.spec.ts` | fixture de estoque corrigida + teste de `renderizarPedidoCliente` |

---

### Task 1: Renderização pura do contexto (`marcia.ts`)

**Files:**
- Create: `packages/shared/src/marcia.ts`
- Create: `apps/interno/src/utils/__tests__/marcia.spec.ts`
- Modify: `packages/shared/src/catalogo.ts` (adicionar `renderizarPedidoCliente`)
- Modify: `packages/shared/src/index.ts` (exports)
- Modify: `apps/interno/src/utils/__tests__/catalogo.spec.ts` (fixture + novo teste)

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces:
  - `formatarAgora(d: Date): string` → `"domingo, 04/10, 09:12"`
  - `diaEmSaoPaulo(d: Date): string` → `"2026-10-04"`
  - `interface HistoricoCompra { compras: number; produtosFrequentes: string[]; ultimaCompraEm: string | null }`
  - `renderizarHistorico(h: HistoricoCompra | null, agora: Date): string | null`
  - `montarRetomada(pedidoCliente: string): string`
  - `MIN_COMPRAS_PARA_HISTORICO: number`
  - `renderizarPedidoCliente(itens: ItemPedido[]): string` (em `catalogo.ts`)

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/interno/src/utils/__tests__/marcia.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
    formatarAgora,
    renderizarHistorico,
    montarRetomada,
    renderizarPedidoCliente,
    type HistoricoCompra,
    type ItemPedido,
} from '@mont/shared'

describe('formatarAgora', () => {
    // 04/10/2026 às 12:12 UTC = 09:12 em São Paulo (UTC-3), e é DOMINGO.
    it('formata no fuso de São Paulo, não em UTC', () => {
        expect(formatarAgora(new Date('2026-10-04T12:12:00Z'))).toBe('domingo, 04/10, 09:12')
    })

    // Sem fuso explícito, 02:30 UTC viraria "domingo" quando em São Paulo ainda é sábado
    // 23:30 — e a Márcia daria bom dia de domingo no sábado à noite.
    it('vira o dia pelo fuso de São Paulo, não pelo do servidor', () => {
        expect(formatarAgora(new Date('2026-10-05T02:30:00Z'))).toBe('domingo, 04/10, 23:30')
    })

    it('usa relógio de 24 horas', () => {
        expect(formatarAgora(new Date('2026-10-04T20:05:00Z'))).toBe('domingo, 04/10, 17:05')
    })

    // Byte-a-byte: `Intl.format()` insere caracteres invisíveis (NBSP) que já morderam
    // este projeto em formatCurrency. A montagem é à mão, via formatToParts.
    it('não contém caractere invisível', () => {
        expect(formatarAgora(new Date('2026-10-04T12:12:00Z'))).not.toMatch(/[   ]/)
    })
})

describe('renderizarHistorico', () => {
    const agora = new Date('2026-10-04T12:00:00Z')

    it('não diz nada para quem nunca comprou', () => {
        expect(renderizarHistorico(null, agora)).toBeNull()
    })

    // Uma compra só não é padrão de consumo — citar "costuma levar" com N=1 soa invasivo
    // e não ajuda a sugerir.
    it('não diz nada para quem comprou uma vez', () => {
        const h: HistoricoCompra = {
            compras: 1,
            produtosFrequentes: ['Chipa 1kg'],
            ultimaCompraEm: '2026-09-22',
        }
        expect(renderizarHistorico(h, agora)).toBeNull()
    })

    it('a partir da segunda compra, diz quantas e o que costuma levar', () => {
        const h: HistoricoCompra = {
            compras: 7,
            produtosFrequentes: ['Pão de Queijo 1kg - 100gr', 'Palito de Queijo 1kg'],
            ultimaCompraEm: '2026-09-22',
        }
        expect(renderizarHistorico(h, agora)).toBe(
            'Já comprou 7 vezes. Costuma levar: Pão de Queijo 1kg - 100gr, Palito de Queijo 1kg.\n' +
            'Última compra: 12 dias atrás.',
        )
    })

    it('diz "hoje" e "ontem" em vez de contar dias', () => {
        const base: HistoricoCompra = {
            compras: 3, produtosFrequentes: ['Chipa 1kg'], ultimaCompraEm: '2026-10-04',
        }
        expect(renderizarHistorico(base, agora)).toContain('Última compra: hoje.')
        expect(renderizarHistorico({ ...base, ultimaCompraEm: '2026-10-03' }, agora))
            .toContain('Última compra: ontem.')
    })

    it('omite a linha de data quando não há data', () => {
        const h: HistoricoCompra = { compras: 2, produtosFrequentes: ['Chipa 1kg'], ultimaCompraEm: null }
        expect(renderizarHistorico(h, agora)).toBe('Já comprou 2 vezes. Costuma levar: Chipa 1kg.')
    })

    it('omite "costuma levar" quando não há produto frequente', () => {
        const h: HistoricoCompra = { compras: 2, produtosFrequentes: [], ultimaCompraEm: '2026-10-03' }
        expect(renderizarHistorico(h, agora)).toBe('Já comprou 2 vezes.\nÚltima compra: ontem.')
    })
})

describe('renderizarPedidoCliente', () => {
    const itens: ItemPedido[] = [
        { nome: 'Chipa 1kg', quantidade: 1, precoUnitario: 40, semEstoque: false },
        { nome: 'Palito de Queijo 1kg', quantidade: 2, precoUnitario: 40, semEstoque: true },
    ]

    // O ⚠️ de `renderizarPedido` é recado para a EQUIPE. Mandar para o cliente seria
    // falar de estoque — justamente o que a Márcia é proibida de fazer.
    it('nunca vaza o alerta interno de estoque', () => {
        const texto = renderizarPedidoCliente(itens)
        expect(texto).not.toContain('⚠️')
        expect(texto).not.toContain('sem estoque')
    })

    // Uma linha: o texto entra no meio de uma frase de WhatsApp, e multilinha ali
    // quebraria a frase da retomada no meio.
    it('fica numa linha só, separado por vírgula', () => {
        expect(renderizarPedidoCliente(itens)).toBe(
            '1× Chipa 1kg — R$ 40,00, 2× Palito de Queijo 1kg — R$ 80,00',
        )
    })

    it('não quebra com pedido vazio', () => {
        expect(renderizarPedidoCliente([])).toBe('(nenhum item)')
    })
})

describe('montarRetomada', () => {
    it('cita o pedido vindo do banco', () => {
        expect(montarRetomada('1× Chipa 1kg — R$ 40,00')).toBe(
            'Oi! Ficou aqui o seu pedido: 1× Chipa 1kg — R$ 40,00. Quer que eu feche? 😊',
        )
    })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter interno exec vitest run src/utils/__tests__/marcia.spec.ts`
Expected: FAIL — `No "formatarAgora" export is defined on "@mont/shared"`

- [ ] **Step 3: Criar `packages/shared/src/marcia.ts`**

```ts
/**
 * O que a Márcia LÊ a cada turno, renderizado.
 *
 * Separado de `secretaria.ts` de propósito: lá mora a mecânica de ENTREGA (tempo de
 * digitação, partição da resposta, janela do humano, gaiola); aqui mora a montagem do
 * contexto que entra no prompt. Mesmo motivo de viver em `packages/shared`: é a única
 * pasta que o runtime Deno da Edge Function E o Vitest do interno alcançam.
 *
 * Por que isto é código testado e não template no nó do n8n: as duas regras de que o
 * prompt depende — "cumprimenta pelo horário" e "no primeiro contato diz seu nome" —
 * são instrução sobre dado que precisa CHEGAR. Enquanto o catálogo era devolvido pela
 * Edge Function e descartado pelo nó Code, cinco linhas do prompt falavam de
 * `estoqueAtual` que a agente nunca viu. Dado de contexto sem teste apodrece calado.
 */

const FUSO = 'America/Sao_Paulo'

/**
 * `YYYY-MM-DD` do instante dado, no fuso da Mont. `en-CA` é o locale que já dá ISO.
 *
 * Exportada porque a Edge Function também precisa dela (para decidir "primeiro contato
 * hoje"), e uma segunda cópia desta expressão dentro do `index.ts` seria a terceira-cópia
 * -da-regra que já custou um cliente a este projeto.
 */
export function diaEmSaoPaulo(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d)
}

/**
 * "domingo, 04/10, 09:12" — no fuso de São Paulo, sempre.
 *
 * O servidor da Edge Function roda em UTC. Sem fuso explícito, às 23:30 de sábado em
 * São Paulo a Márcia daria bom dia de domingo.
 *
 * Montado a partir de `formatToParts`, não de `format()`: `Intl` insere separadores
 * invisíveis (NBSP, narrow NBSP) que variam por runtime e por versão de ICU. Este
 * projeto já foi mordido exatamente assim em `formatCurrency`. Com as partes na mão, os
 * separadores são nossos e o resultado é byte-a-byte previsível no teste.
 */
export function formatarAgora(d: Date): string {
    const partes = new Intl.DateTimeFormat('pt-BR', {
        timeZone: FUSO,
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(d)

    const p = (tipo: Intl.DateTimeFormatPartTypes): string =>
        partes.find((x) => x.type === tipo)?.value ?? ''

    return `${p('weekday')}, ${p('day')}/${p('month')}, ${p('hour')}:${p('minute')}`
}

export interface HistoricoCompra {
    /** Dias distintos em que este cliente comprou. Brinde não conta. */
    compras: number
    /** Os produtos que ele leva mais vezes, já ordenados. No máximo dois. */
    produtosFrequentes: string[]
    /** `YYYY-MM-DD` da compra mais recente, ou null. */
    ultimaCompraEm: string | null
}

/** Mínimo de compras para o histórico entrar no prompt. Ver `renderizarHistorico`. */
export const MIN_COMPRAS_PARA_HISTORICO = 2

/**
 * Diferença em DIAS DE CALENDÁRIO, não em 24h corridas: "ontem" tem que ser ontem mesmo
 * quando a compra foi às 23h e agora é 1h da manhã.
 */
function diasEntre(dataIso: string, agora: Date): number {
    const compra = Date.UTC(
        Number(dataIso.slice(0, 4)), Number(dataIso.slice(5, 7)) - 1, Number(dataIso.slice(8, 10)),
    )
    const hojeSp = diaEmSaoPaulo(agora)
    const hoje = Date.UTC(
        Number(hojeSp.slice(0, 4)), Number(hojeSp.slice(5, 7)) - 1, Number(hojeSp.slice(8, 10)),
    )
    return Math.round((hoje - compra) / 86_400_000)
}

/**
 * O histórico de compra em duas linhas, ou `null` quando não vale dizer nada.
 *
 * É o que separa vendedora experiente de atendente: ela sugere com fundamento ("vai o
 * palito junto, como sempre?") em vez de oferecer no escuro.
 *
 * Entra a partir da SEGUNDA compra. Com uma compra só não existe padrão de consumo —
 * dizer "costuma levar" para quem comprou uma vez soa invasivo e não ajuda a sugerir.
 */
export function renderizarHistorico(h: HistoricoCompra | null, agora: Date): string | null {
    if (!h || h.compras < MIN_COMPRAS_PARA_HISTORICO) return null

    const linhas: string[] = []

    const frequentes = h.produtosFrequentes.length > 0
        ? ` Costuma levar: ${h.produtosFrequentes.join(', ')}.`
        : ''
    linhas.push(`Já comprou ${h.compras} vezes.${frequentes}`)

    if (h.ultimaCompraEm) {
        const dias = diasEntre(h.ultimaCompraEm, agora)
        const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `${dias} dias atrás`
        linhas.push(`Última compra: ${quando}.`)
    }

    return linhas.join('\n')
}

/**
 * A mensagem que a Márcia manda para o cliente que montou pedido e parou de responder.
 *
 * Template, não segunda chamada de modelo. O W4 é um cron que roda a cada 10 minutos
 * numa VPS que já derrubou 19 execuções por pressão de memória; pendurar uma chamada de
 * LLM nesse caminho adiciona modo de falha a uma rota que precisa ser confiável, e o
 * ganho seria uma frase. O pedido vem renderizado do BANCO — ela nunca escreve o pedido
 * de cabeça, nem aqui.
 */
export function montarRetomada(pedidoCliente: string): string {
    return `Oi! Ficou aqui o seu pedido: ${pedidoCliente}. Quer que eu feche? 😊`
}
```

- [ ] **Step 4: Adicionar `renderizarPedidoCliente` em `packages/shared/src/catalogo.ts`**

Logo depois de `renderizarPedido` (hoje terminando na linha 188), acrescentar:

```ts
/**
 * O pedido como o CLIENTE vê: uma linha, sem o alerta interno de estoque.
 *
 * `renderizarPedido` embute `⚠️ sem estoque no sistema`, que é recado para a equipe no
 * grupo interno. Mandar isso ao cliente seria falar de estoque — exatamente o que a
 * Márcia é proibida de fazer, e com um número que a contagem física de 28/09 mostrou
 * que era baseline nunca contado.
 *
 * Uma linha e não multilinha porque o texto entra no MEIO de uma frase de WhatsApp
 * (ver `montarRetomada`), e a quebra partiria a frase.
 */
export function renderizarPedidoCliente(itens: ItemPedido[]): string {
    if (itens.length === 0) return '(nenhum item)'

    return itens
        .map((i) => `${i.quantidade}× ${i.nome} — ${formatarReais(i.quantidade * i.precoUnitario)}`)
        .join(', ')
}
```

- [ ] **Step 5: Exportar em `packages/shared/src/index.ts`**

Acrescentar `renderizarPedidoCliente` à lista de exports do bloco `from './catalogo'` que **já existe** no arquivo (não criar um segundo bloco para o mesmo módulo), e acrescentar um bloco novo para `marcia`:

```ts
// Contexto do turno da Márcia (agente de WhatsApp) — renderização pura.
export {
    formatarAgora,
    diaEmSaoPaulo,
    renderizarHistorico,
    montarRetomada,
    MIN_COMPRAS_PARA_HISTORICO,
    type HistoricoCompra,
} from './marcia'
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `pnpm --filter interno exec vitest run src/utils/__tests__/marcia.spec.ts`
Expected: PASS — 14 testes.

- [ ] **Step 7: Corrigir o fixture de estoque em `catalogo.spec.ts`**

O comentário do fixture diz "Catálogo real da Mont em 29/09/2026, **depois da contagem física**", mas os valores de chipa e palito são os de ANTES — `-243`, `-21`, `-426`, `-30` são exatamente os "valores ANTERIORES, para reverter" listados na migration `20260929001700_estoque_contagem_fisica.sql`. Isso não muda resultado hoje porque `resolverTermo` não olha estoque, mas a Task 3 passa a derivar `disponivel` de `estoqueAtual`, e um fixture mentindo sobre o estoque produziria teste verde com a regra errada.

Trocar essas quatro linhas do fixture pelos valores contados:

```ts
    { id: 'chipa-1k', nome: 'Chipa 1kg', apelido: 'chipa, chipinha', preco: 40, estoqueAtual: 9 },
    { id: 'chipa-2k', nome: 'Chipa 2kg', apelido: 'chipa, chipinha', preco: 80, estoqueAtual: 10 },
    { id: 'palito-1k', nome: 'Palito de Queijo 1kg', apelido: 'palito, palito de queijo', preco: 40, estoqueAtual: 36 },
    { id: 'palito-2k', nome: 'Palito de Queijo 2kg', apelido: 'palito, palito de queijo', preco: 80, estoqueAtual: 4 },
```

O `pq-1k-25` fica em `-103` de propósito: é o produto cuja contagem o diretor ainda vai confirmar com a equipe, e é o caso que prova `disponivel: false`.

- [ ] **Step 8: Rodar a suíte inteira e o typecheck**

Run: `pnpm --filter interno exec vitest run` e `pnpm --filter interno exec tsc --noEmit`
Expected: PASS nos dois.
⚠️ `tsc --noEmit` passa onde o `tsc -b` do build reprova (aconteceu no selo de origem do cadastro, em 19/08) — rodar também `pnpm turbo build --filter=interno`.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/marcia.ts packages/shared/src/catalogo.ts packages/shared/src/index.ts apps/interno/src/utils/__tests__/marcia.spec.ts apps/interno/src/utils/__tests__/catalogo.spec.ts
git commit -m "feat(marcia): renderizacao pura do contexto do turno"
```

---

### Task 2: Migration — `wa_pedido.retomado_em`

**Files:**
- Create: `supabase/migrations/20261005000000_wa_pedido_retomado_em.sql`
- Modify: `packages/shared/src/database.ts` (regenerado, nunca à mão)

**Interfaces:**
- Consumes: nada.
- Produces: coluna `public.wa_pedido.retomado_em timestamptz NULL`, consumida pela Task 4.

- [ ] **Step 1: Backup da produção (obrigatório, CLAUDE.md Regra #3)**

Run (PowerShell): `.\supabase\scripts\dump-prod.ps1`
Expected: dois arquivos novos em `supabase/backups/dumps/` — `dump-schema-*.sql` e `dump-data-*.sql`. **Não seguir sem os dois.**

- [ ] **Step 2: Escrever a migration**

Criar `supabase/migrations/20261005000000_wa_pedido_retomado_em.sql`:

```sql
-- `retomado_em`: quando a Marcia puxou o cliente que montou pedido e parou de responder.
--
-- O abandono passa a ter DUAS etapas. Antes, 30 minutos de silencio marcavam o rascunho
-- como `abandonado` e avisavam a equipe — o cliente nunca ouvia nada, e a equipe recebia
-- um ⏳ para um pedido que talvez so precisasse de "quer que eu feche?".
--
--   rascunho parado 30 min  ->  MARCIA manda mensagem ao cliente  (retomado_em := now())
--   ainda parado + 30 min   ->  ⏳ no grupo da equipe              (status := 'abandonado')
--   cliente respondeu       ->  nada; ela conduz
--   humano falou            ->  nada, em nenhuma das duas etapas
--
-- ⚠️ POR QUE NAO EXISTE UMA SEGUNDA COLUNA DE RELOGIO: o trigger
-- `trg_wa_pedido_atualizado_em` (BEFORE UPDATE) carimba `atualizado_em := now()` em
-- QUALQUER update desta tabela, sobrescrevendo valor forcado. Entao o proprio UPDATE que
-- seta `retomado_em` bumpa `atualizado_em`, e o relogio da Etapa 2 passa a contar da
-- retomada de graca. A Etapa 1 e `retomado_em IS NULL`; a Etapa 2 e
-- `retomado_em IS NOT NULL`. O indice (status, atualizado_em DESC) que ja existe serve as
-- duas, e nenhum indice novo e necessario.
--
-- Efeito colateral aceito: se o cliente responder sem MUDAR o pedido (ex. "vou pensar"),
-- `atualizado_em` nao bumpa e a Etapa 2 dispara 30 min depois. Isso e desejavel — cliente
-- engajado que nao fechou e exatamente o caso que vale contar para a equipe. O guard de
-- `humanoAssumiu` continua valendo nas duas etapas.

ALTER TABLE public.wa_pedido
  ADD COLUMN IF NOT EXISTS retomado_em timestamptz;

COMMENT ON COLUMN public.wa_pedido.retomado_em IS
  'Quando a agente puxou o cliente (etapa 1 do abandono). NULL = ainda nao puxou.';

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 3: Aplicar na produção**

Aplicar via `mcp__supabase-distribuidora__apply_migration` com o conteúdo acima. O `db push` está travado neste projeto (Item 10 do roadmap) — as migrations recentes foram todas aplicadas por MCP.

- [ ] **Step 4: Confirmar no banco**

Run via `mcp__supabase-distribuidora__execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'wa_pedido' AND column_name = 'retomado_em';
```
Expected: uma linha — `retomado_em`, `timestamp with time zone`, `YES`.

- [ ] **Step 5: Regenerar os tipos**

Run: `npx supabase gen types typescript --project-id herlvujykltxnwqmwmyx > packages/shared/src/database.ts`
Expected: o diff mostra `retomado_em: string | null` nas três faces (`Row`, `Insert`, `Update`) de `wa_pedido`.
⚠️ **Não editar `database.ts` à mão** — é auto-gerado; aliases manuais moram em `types.ts`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261005000000_wa_pedido_retomado_em.sql packages/shared/src/database.ts
git commit -m "feat(wa_pedido): coluna retomado_em para o abandono em duas etapas"
```

---

### Task 3: Edge Function — `contexto` enriquecido e `disponivel`

**Files:**
- Modify: `supabase/functions/whatsapp-secretaria/index.ts` (`montarContexto`, linha 103; ação `consultar_produto`, linha ~548)

**Interfaces:**
- Consumes: `formatarAgora`, `renderizarHistorico`, `type HistoricoCompra` de `@mont/shared` (Task 1).
- Produces: a resposta de `contexto` passa a ter `agora: string`, `primeiro_contato_hoje: boolean`, `historico: string | null`, e **deixa de ter** `catalogo`. A resposta de `consultar_produto` passa a ter `disponivel: boolean` por produto.

- [ ] **Step 1: Acrescentar os imports**

No import de `@mont/shared` que já existe no topo do arquivo (o que traz `resolverTermo`, `renderizarPedido`, `humanoAssumiu`), acrescentar `formatarAgora`, `diaEmSaoPaulo` e `renderizarHistorico`; e `HistoricoCompra` ao import de tipo. **Usar o mesmo especificador de módulo que o arquivo já usa** — não inventar caminho novo, e não acrescentar um segundo import do mesmo módulo.

- [ ] **Step 2: Escrever a função que lê o histórico de compra**

Acrescentar imediatamente ANTES de `montarContexto` (linha 103):

```ts
/**
 * Histórico de compra do cliente, para a Márcia sugerir com fundamento.
 *
 * ⚠️ BRINDE FORA. Brinde neste projeto é `pago = false` E `status = 'entregue'` — produto
 * doado. Contar como compra faria a Márcia oferecer de novo justamente o que a Mont deu de
 * graça, e inflaria "já comprou N vezes" com o que ninguém pagou.
 *
 * "Compra" é DIA DISTINTO, não linha de venda: é a definição canônica do projeto, a mesma
 * dos relatórios e do ranking de pontos. Duas vendas no mesmo dia são uma compra.
 */
async function lerHistoricoCompra(
  admin: SupabaseClient,
  contatoId: string,
): Promise<HistoricoCompra | null> {
  const { data: vendas } = await admin
    .from('vendas')
    .select('id, data, pago, status')
    .eq('contato_id', contatoId)

  const pagas = (vendas ?? []).filter((v) => !(v.pago === false && v.status === 'entregue'))
  if (pagas.length === 0) return null

  const dias = new Set(pagas.map((v) => v.data))

  const { data: itens } = await admin
    .from('itens_venda')
    .select('venda_id, produto_id, produtos(nome)')
    .in('venda_id', pagas.map((v) => v.id))

  // Frequência por produto = em quantas VENDAS ele apareceu, não soma de quantidade: quem
  // leva 10 kg de um produto uma única vez não "costuma levar" aquilo.
  const vezes = new Map<string, number>()
  for (const i of itens ?? []) {
    const nome = (i as { produtos?: { nome?: string } | null }).produtos?.nome
    if (!nome) continue
    vezes.set(nome, (vezes.get(nome) ?? 0) + 1)
  }

  // Desempate por nome para a saída ser determinística — sem isso dois produtos com a
  // mesma frequência alternariam entre execuções e o prompt mudaria sem motivo.
  const produtosFrequentes = [...vezes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, 2)
    .map(([nome]) => nome)

  const datas = [...dias].sort()

  return {
    compras: dias.size,
    produtosFrequentes,
    ultimaCompraEm: datas[datas.length - 1] ?? null,
  }
}
```

- [ ] **Step 3: Enriquecer o retorno de `montarContexto`**

Dentro de `montarContexto`, depois de `const catalogo = await lerCatalogo(admin)` (linha 161), acrescentar:

```ts
  const agoraDate = new Date()

  // "Primeiro contato dele hoje" = nenhuma mensagem DE ENTRADA deste cliente em dia de
  // calendário de São Paulo antes desta. Sem isso a regra "no primeiro contato diz seu
  // nome" é instrução sobre dado que não chega, e ela se apresentaria a cada mensagem.
  //
  // Dia de calendário e não 24h: às 8h da manhã, o contato de ontem às 22h é um contato
  // NOVO, e é aí que o bom dia cabe.
  //
  // `<= 1` porque a mensagem que disparou esta execução já está gravada quando chegamos
  // aqui — o ingestor grava antes de o W3 pedir contexto.
  const hoje = diaEmSaoPaulo(agoraDate)
  const entradasHoje = ordenadas.filter(
    (m) => m.direcao === 'entrada' && diaEmSaoPaulo(new Date(m.enviada_em)) === hoje,
  )
  const primeiroContatoHoje = entradasHoje.length <= 1

  const historico = renderizarHistorico(
    await lerHistoricoCompra(admin, contato.id),
    agoraDate,
  )
```

E trocar o `return` (linhas 163-176) por:

```ts
  return {
    pode_responder: true,
    motivo: 'ok' as const,
    contato,
    conversa,
    nao_lidas: naoLidas,
    agora: formatarAgora(agoraDate),
    primeiro_contato_hoje: primeiroContatoHoje,
    historico,
    // O rascunho vai como FATO, derivado das linhas. A agente nao deduz pedido da conversa.
    pedido_atual: await (async () => {
      const r = await lerRascunho(admin, contato.id)
      if (!r) return null
      return renderizarPedido(await lerItens(admin, r.id, catalogo))
    })(),
    // `catalogo` NAO volta mais. Ele vinha aqui e o no `Montar entrada do agente` jogava
    // fora — e as cinco linhas do prompt sobre `estoqueAtual` eram instrucao sobre dado
    // que a agente nunca via. Quem precisa de estoque e `consultar_produto`, que devolve
    // `disponivel` por produto. A leitura de `lerCatalogo` acima FICA: ela e usada para
    // renderizar `pedido_atual`.
  }
```

✅ **Verificado antes de escrever este plano:** nenhum nó do W3 lê `$json.catalogo`. As três
ocorrências da palavra no `w3-secretaria.json` são todas texto do system prompt — duas na
frase sobre "adivinhar o catálogo" e uma na linha morta do `estoqueAtual`. Remover o campo
da resposta não quebra fiação nenhuma.

- [ ] **Step 4: `consultar_produto` passa a devolver `disponivel`**

Na ação `consultar_produto`, trocar o `return json(...)` final por:

```ts
      return json({
        ok: true,
        produtos: achados.map((p) => ({
          nome: p.nome,
          preco: p.preco,
          // Booleano, NUNCA o número. A Márcia segue proibida de falar de estoque com o
          // cliente, e número na mão dela é convite a dizer "tenho 4". O que ela precisa
          // saber é só se deve SUGERIR aquilo por conta própria.
          //
          // A contagem física de 28/09 é o que torna este campo confiável: antes dela,
          // estoque negativo não significava "acabou", significava "ninguém nunca contou".
          disponivel: p.estoqueAtual > 0,
        })),
      }, 200)
```

- [ ] **Step 5: Deploy**

⚠️ Conferir ANTES que `supabase/config.toml` continua com a entrada de `whatsapp-secretaria`. Sem ela o deploy liga `verify_jwt=true`, o gateway devolve 401 antes de o código rodar, e `cron.job_run_details` marca SUCESSO porque o `pg_net` só enfileira — foi assim que a CAPI ficou 3 dias fora em 08-10/08.

Run: `npx supabase functions deploy whatsapp-secretaria --project-ref herlvujykltxnwqmwmyx`

- [ ] **Step 6: Provar na produção que o contexto chegou**

⚠️ **Sonda com acento vai por Python, nunca por `curl` no Git Bash** — o shell corrompe UTF-8 e já produziu um `nao_encontrado` falso que quase foi reportado como bug. O nome do header de autenticação é o que o arquivo já usa; conferir no topo do `index.ts` antes de rodar.

```bash
python - <<'PY'
import json, os, urllib.request
url = "https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/whatsapp-secretaria"
def chamar(corpo):
    req = urllib.request.Request(url, data=json.dumps(corpo).encode("utf-8"), headers={
        "Content-Type": "application/json",
        "x-ingestor-secret": os.environ["INGESTOR_SECRET"],
    })
    return json.load(urllib.request.urlopen(req))

d = chamar({"acao": "contexto", "telefone_wa": "5511980017732"})
print({k: d.get(k) for k in ("ok", "pode_responder", "agora", "primeiro_contato_hoje", "historico")})
print("catalogo ainda vem?", "catalogo" in d)

p = chamar({"acao": "consultar_produto", "telefone_wa": "5511980017732", "termo": "pão de queijo"})
print(p)
PY
```
Expected:
- `agora` no formato `"domingo, 04/10, 09:12"` (dia da semana em português, hora de São Paulo)
- `primeiro_contato_hoje` booleano
- `catalogo ainda vem? False`
- em `consultar_produto`: os cinco pães de queijo, cada um com `disponivel`. O `1kg - 25gr` (estoque −103) vem `false`; o `1kg - 50gr` (10) vem `true`. **Nenhum Baldinho/Balde na lista** — massa crua não casa com "pão de queijo" desde o fix `b77d7b6`.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/whatsapp-secretaria/index.ts
git commit -m "feat(marcia): contexto do turno com hora, primeiro contato e historico"
```

---

### Task 4: Edge Function — abandono em duas etapas e `avisar_99`

**Files:**
- Modify: `supabase/functions/whatsapp-secretaria/index.ts` (ação `rascunhos_abandonados`, linhas 401-474; lista de ações válidas, linha ~866)

**Interfaces:**
- Consumes: `retomado_em` (Task 2); `montarRetomada`, `renderizarPedidoCliente` de `@mont/shared` (Task 1).
- Produces:
  - `rascunhos_abandonados` devolve `{ ok: true, retomar: [...], avisar: [...] }` em vez de `{ ok: true, abandonados: [...] }`
    - item de `retomar`: `{ telefone_wa, jid, contato, texto }`
    - item de `avisar`: `{ telefone_wa, contato, pedido, total }`
  - nova ação `avisar_99` → `{ ok: true, telefone_wa, contato, texto }`

- [ ] **Step 1: Acrescentar os imports**

Ao import de `@mont/shared` já existente, acrescentar `montarRetomada` e `renderizarPedidoCliente`. `estaLiberado`, `lerModo` e `lerAllowlist` já estão disponíveis no arquivo (usados pela ação `contexto`).

- [ ] **Step 2: Reescrever `rascunhos_abandonados` em duas etapas**

Substituir o bloco inteiro (linhas 401-474) por:

```ts
  if (body.acao === 'rascunhos_abandonados') {
    try {
      const minutos = typeof body.minutos === 'number' ? body.minutos : 30
      const limite = new Date(Date.now() - minutos * 60_000).toISOString()

      const { data: parados } = await admin
        .from('wa_pedido')
        .select('id, contato_id, telefone_wa, retomado_em')
        .eq('status', 'rascunho')
        .lt('atualizado_em', limite)

      const catalogo = await lerCatalogo(admin)
      const modo = lerModo()
      const allowlist = lerAllowlist()

      const retomar: unknown[] = []
      const avisar: unknown[] = []

      for (const p of parados ?? []) {
        const itens = await lerItens(admin, p.id, catalogo)
        if (itens.length === 0) continue

        // Guarda: humano atendendo nao vira retomada nem alerta. Sem isto o robo falaria
        // por cima de um cliente que o Gilmar ja esta atendendo.
        //
        // `humanoAssumiu` (mesma funcao de `montarContexto`) e a que tem JANELA de tempo —
        // uma resposta humana de semana passada dentro das ultimas mensagens NAO pode calar
        // o alerta para sempre. Reimplementar isto a mao sem a janela foi o bug: bastava UMA
        // resposta humana antiga pra marcar `abandonado` em silencio e o aviso nunca sair.
        const { data: msgs } = await admin
          .from('mensagens_whatsapp')
          .select('message_id, direcao, enviada_em')
          .eq('telefone_wa', p.telefone_wa).eq('historico', false)
          .order('enviada_em', { ascending: false }).limit(MAX_MENSAGENS_CONTEXTO)

        const { data: envios } = await admin
          .from('wa_envios').select('message_id').eq('telefone_wa', p.telefone_wa)
        const idsDaAgente = new Set((envios ?? []).map((e) => e.message_id))

        const paraRegra: MensagemDaConversa[] = (msgs ?? []).map((m) => ({
          messageId: m.message_id,
          direcao: m.direcao as 'entrada' | 'saida',
          enviadaEm: m.enviada_em,
        }))

        if (humanoAssumiu(paraRegra, idsDaAgente)) {
          const { error: erroAbandono } = await admin
            .from('wa_pedido').update({ status: 'abandonado' }).eq('id', p.id)
          if (erroAbandono) {
            console.error('[secretaria] falha ao marcar rascunho como abandonado (humano):', erroAbandono.message)
          }
          continue
        }

        const { data: c } = await admin
          .from('contatos').select('nome').eq('id', p.contato_id).maybeSingle()

        // ETAPA 2 — ela ja puxou e o cliente seguiu calado. Agora a equipe sabe.
        if (p.retomado_em) {
          const { error: erroAbandono } = await admin
            .from('wa_pedido').update({ status: 'abandonado' }).eq('id', p.id)
          if (erroAbandono) {
            console.error('[secretaria] falha ao marcar rascunho como abandonado:', erroAbandono.message)
          }

          avisar.push({
            telefone_wa: p.telefone_wa,
            contato: c?.nome ?? 'Cliente',
            pedido: renderizarPedido(itens),
            total: totalPedido(itens),
          })
          continue
        }

        // ETAPA 1 — a MARCIA puxa o cliente.
        //
        // ⚠️ A GAIOLA. Este e o PRIMEIRO caminho do projeto que manda mensagem a CLIENTE
        // fora do W3. O W4 sempre falou so com o grupo interno, cujo destino e constante
        // validada, e por isso esta acao nasceu global, antes do guard de telefone. Sem
        // este filtro, a primeira execucao em modo `dev` escreve para TODO cliente real
        // com rascunho parado. Falha FECHADA: allowlist vazia bloqueia tudo.
        if (!estaLiberado(p.telefone_wa, allowlist, modo)) {
          console.log(`[secretaria] retomada bloqueada pela gaiola: ${p.telefone_wa} (modo ${modo})`)
          continue
        }

        // `retomado_em` ANTES do envio, de proposito. O trigger BEFORE UPDATE carimba
        // `atualizado_em := now()` junto, e e isso que faz o relogio da Etapa 2 contar da
        // retomada. Se o envio falhar depois disto, o cliente nao e puxado e a Etapa 2
        // avisa a equipe em 30 min — a degradacao cai para o lado seguro, que e alguem
        // SABER. O inverso (marcar depois do envio) arrisca puxar o mesmo cliente a cada
        // 10 minutos para sempre.
        const { error: erroRetomada } = await admin
          .from('wa_pedido').update({ retomado_em: new Date().toISOString() }).eq('id', p.id)

        if (erroRetomada) {
          console.error('[secretaria] falha ao marcar retomada:', erroRetomada.message)
          continue
        }

        retomar.push({
          telefone_wa: p.telefone_wa,
          jid: `${p.telefone_wa}@s.whatsapp.net`,
          contato: c?.nome ?? 'Cliente',
          texto: montarRetomada(renderizarPedidoCliente(itens)),
        })
      }

      return json({ ok: true, retomar, avisar }, 200)
    } catch (e) {
      console.error('[whatsapp-secretaria]', e)
      return json({ error: (e as Error).message }, 500)
    }
  }
```

- [ ] **Step 3: Criar a ação `avisar_99`**

Acrescentar depois do bloco de `consultar_frete`. Fica **depois** do guard de telefone (ao contrário de `rascunhos_abandonados`, que é global), porque precisa de `telefoneWa`:

```ts
    if (body.acao === 'avisar_99') {
      // Entrega hoje pela 99: o cliente paga a corrida e o calculo e MANUAL — alguem abre
      // o app, poe o endereco, tira print e manda. A Marcia nunca chuta preco de corrida,
      // e o sistema nao tem de onde tirar esse numero: nao e frete da Mont.
      //
      // Terceiro tipo de aviso no mesmo grupo interno (🛒 pedido, ⏳ abandono, 🚕 99). Emoji
      // proprio para a equipe distinguir de relance o que precisa de acao e qual.
      const endereco = typeof body.endereco === 'string' ? body.endereco.trim() : ''

      const { data: contato } = await admin
        .from('contatos').select('nome').eq('telefone_wa', telefoneWa).maybeSingle()

      const nome = contato?.nome ?? 'Cliente'

      return json({
        ok: true,
        telefone_wa: telefoneWa,
        contato: nome,
        texto: [
          `🚕 ENTREGA PELA 99 — ${nome} (${telefoneWa})`,
          endereco ? `Endereco: ${endereco}` : 'Endereco: nao informado — perguntar ao cliente.',
          'Abrir o app da 99, calcular a corrida e mandar o print. O cliente paga.',
        ].join('\n'),
      }, 200)
    }
```

- [ ] **Step 4: Registrar a ação nova na lista de ações válidas**

Na lista da linha ~866, acrescentar `'avisar_99'` ao final (mantendo os itens existentes):

```ts
        'rascunhos_abandonados', 'preparar_envio', 'destino_aviso', 'avisar_99',
```

- [ ] **Step 5: Deploy**

Run: `npx supabase functions deploy whatsapp-secretaria --project-ref herlvujykltxnwqmwmyx`

- [ ] **Step 6: Conferir que nenhum cliente real está na linha de tiro**

Run via `mcp__supabase-distribuidora__execute_sql`:

```sql
SELECT p.telefone_wa, c.nome, p.atualizado_em, p.retomado_em
  FROM public.wa_pedido p JOIN public.contatos c ON c.id = p.contato_id
 WHERE p.status = 'rascunho';
```
Expected: só a conta de teste (`5511980017732`). Se aparecer cliente real, **a gaiola é o que impede o envio** — confirmar que o modo é `dev` e que a allowlist tem só esse número **antes** de seguir.

- [ ] **Step 7: Provar as duas etapas e a 99 na produção**

Com um rascunho de teste parado há mais de 30 min:

```bash
python - <<'PY'
import json, os, urllib.request
url = "https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/whatsapp-secretaria"
def chamar(corpo):
    req = urllib.request.Request(url, data=json.dumps(corpo).encode("utf-8"), headers={
        "Content-Type": "application/json",
        "x-ingestor-secret": os.environ["INGESTOR_SECRET"],
    })
    return json.load(urllib.request.urlopen(req))

d = chamar({"acao": "rascunhos_abandonados", "minutos": 30})
print("1a chamada  retomar:", len(d["retomar"]), "avisar:", len(d["avisar"]))
print("texto:", d["retomar"][0]["texto"] if d["retomar"] else None)

d2 = chamar({"acao": "rascunhos_abandonados", "minutos": 30})
print("2a chamada (imediata)  retomar:", len(d2["retomar"]), "avisar:", len(d2["avisar"]))

print(chamar({"acao": "avisar_99", "telefone_wa": "5511980017732",
              "endereco": "Rua Teste, 10 - Centro, Santo André"})["texto"])
PY
```
Expected:
- 1ª chamada: `retomar: 1`, `avisar: 0`, texto no formato `Oi! Ficou aqui o seu pedido: 1× … . Quer que eu feche? 😊` — **sem `⚠️`**
- 2ª chamada imediata: `retomar: 0`, `avisar: 0` — o trigger bumpou `atualizado_em` e o relógio recomeçou
- a 99: o bloco de três linhas começando com `🚕 ENTREGA PELA 99`

E no banco:

```sql
SELECT status, retomado_em, atualizado_em FROM public.wa_pedido WHERE status = 'rascunho';
```
Expected: `retomado_em` preenchido e `atualizado_em` igual a ele (o trigger carimbou os dois no mesmo UPDATE). Só 30 min depois a mesma chamada devolve `avisar: 1` e o status vira `abandonado`.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/whatsapp-secretaria/index.ts
git commit -m "feat(marcia): abandono em duas etapas e aviso de entrega pela 99"
```

---

### Task 5: W3 — prompt, descrições de ferramenta, injeção e `avisar_99`

**Files:**
- Modify: `infra/crm/workflows/w3-secretaria.json` (nós `Secretária (AI Agent)`, `Montar entrada do agente`, as 6 ferramentas, + 4 nós novos)

**Interfaces:**
- Consumes: `contexto` com `agora`/`primeiro_contato_hoje`/`historico` (Task 3); ação `avisar_99` (Task 4).
- Produces: nada para tarefas seguintes.

**Como aplicar:** editar o JSON versionado em `infra/crm/workflows/w3-secretaria.json` e aplicar no n8n via `mcp__n8n__n8n_update_partial_workflow` no workflow `JAibLGIwNDLJN0Ym`. Preferir update parcial a `n8n_update_full_workflow`: o W3 tem 33 nós e reenviar tudo arrisca perder fiação que não está em revisão.

- [ ] **Step 1: Trocar o `systemMessage` do nó `Secretária (AI Agent)`**

Substituir o `options.systemMessage` inteiro por:

```
Você é a Márcia, do comercial da Mont Distribuidora. A Mont faz pão de queijo
artesanal com queijo canastra de verdade, em São Bernardo, e entrega no ABC e
em São Paulo.

Você trabalha com venda há anos e conhece esse produto como ninguém. Tem a
segurança de quem já atendeu muita gente: não enrola, não promete o que não
pode cumprir, e conduz a conversa até o pedido sem empurrar.

Se perguntarem se você é um robô, você é gente — do comercial da Mont. Se
errar alguma coisa, corrige na hora e sem drama: "me confundi aqui, deixa eu
arrumar". Quem tem traquejo corrige; quem não tem, se desculpa muito.

COMO VOCÊ FALA
- Brasileiro informal, como quem atende bem. Nunca "prezado cliente".
- Frases curtas, no máximo três. Quem lê está no celular.
- Um emoji quando cabe. Nunca dois.
- No primeiro contato: cumprimenta pelo horário, diz seu nome, pergunta o que
  a pessoa precisa. Não espera o cliente puxar.

COMO VOCÊ VENDE
- Oferece o que combina: quem leva pão de queijo costuma levar chipa ou palito.
- Se achar caro, responde com valor — canastra de verdade, artesanal, sem
  conservante, rende mais. Nunca com desconto.
- Toda pergunta sua DIZ as opções. "Qual você prefere?" sem dizer quais
  existem obriga o cliente a adivinhar o que ele não conhece.
- Você conduz. Se o cliente parar no meio, retoma: "fechamos assim então?".
  Vendedor bom não deixa a conversa morrer de morte natural.

COMO VOCÊ CHAMA AS COISAS
- Pão de queijo vem em pacote de 1 kg e de 2 kg. O pão tem tamanho: 25 g,
  50 g ou 100 g.
- Nunca diga "porções" nem "qual embalagem". Diga "pacote de 1 kg", "pão de 50 g".
- Baldinho (1 kg) e Balde (4 kg) são MASSA CRUA — produto diferente. Só ofereça
  se pedirem massa, baldinho ou balde.

ENTREGA
- O pedido de hoje entra na rota de amanhã de manhã. O frete vem da ferramenta.
- Se precisa hoje, existe a 99: o cliente paga a corrida. Você avisa a equipe
  calcular e diz que já retorna com o valor.

O QUE VOCÊ NUNCA FAZ
- Nunca fala de estoque. Nem "tenho", nem "acabou".
- Nunca fala de fiado, desconto, parcelamento ou prazo de pagamento.
- Nunca trata reclamação de produto ou de entrega.
- Nunca inventa preço, produto ou prazo — tudo vem das ferramentas.

Quando não puder resolver, diz que vai confirmar com a equipe, sem prometer quando.
```

⚠️ Saíram as 25 linhas de mecânica de pedido (vão para as `toolDescription` no Step 3) e as 5 linhas sobre `estoqueAtual` (eram texto morto: a Edge Function devolvia `catalogo` e o nó Code jogava fora). **Não reintroduzir** nenhuma das duas aqui — a proporção é o defeito que este trabalho conserta.

⚠️ Uma regra MUDOU de valor, não só de lugar: antes era "Nunca prometa data ou horário de entrega"; agora ela pode dizer que o pedido de hoje entra na rota de amanhã. Foi a única proibição relaxada no desenho.

- [ ] **Step 2: Trocar o `jsCode` do nó `Montar entrada do agente`**

```javascript
// A conversa vai pro agente; PRECO e FRETE nao. Isso e proposital: o agente tem que
// buscar numero pelas tools, nunca receber de bandeja e nunca inventar. Se o dado
// chegasse pronto no prompt, nao daria pra saber se ele consultou ou chutou.
const ctx = $json;
const base = $('Extrair mensagem').first().json;

const conversa = (ctx.conversa ?? [])
  .map((m) => `${m.de === 'cliente' ? 'CLIENTE' : 'NOS'}: ${m.texto}`)
  .join('\n');

// O pedido vigente vai como FATO, DEPOIS da conversa e colado na pergunta.
//
// A ordem importa: em 29/09 o fato vinha ANTES de 30 mensagens de historico, e a
// conversa continha a voz da propria agente, do desenho antigo, afirmando "Anotado:
// 1 kg de pao de queijo + 500 g de chipa" — pedido que nunca existiu. Ela acreditou no
// historico em vez do fato, leu "me ve 500g de chipa" como repeticao, e nem chamou a
// ferramenta. O que esta perto da pergunta pesa mais.
//
// Motivo original de separar conversa e pedido: Sem isso o agente deduzia o
// pedido das 30 ultimas mensagens — que nao tem fronteira de tempo — e somava com o
// pedido do dia anterior (defeito de 21/08: pediu 2 kg, ela anotou 4 kg).
const pedido = ctx.pedido_atual
  ? `PEDIDO JA REGISTRADO (e o que vale; modifique ISTO): ${ctx.pedido_atual}`
  : 'PEDIDO JA REGISTRADO: NENHUM. Nao existe pedido em aberto para este cliente. Mensagem antiga SUA dizendo "Anotado: ..." NAO vale como pedido — o pedido de verdade e este campo. Se o cliente pedir algo agora, e item novo: chame adicionar_item.';

// Hora e primeiro-contato nao sao enfeite: sem eles, as regras "cumprimenta pelo horario"
// e "no primeiro contato diz seu nome" seriam instrucao sobre dado inexistente —
// exatamente a divida que esta reescrita existe para eliminar. Vem FORMATADOS da Edge
// Function (fuso de Sao Paulo), nao montados aqui: regra de formatacao dentro de no Code
// e como este projeto perdeu um cliente, quando a canonicalizacao de telefone ganhou uma
// terceira copia dentro de um workflow e nasceu com regex errado.
const cabecalho = [
  `Cliente: ${ctx.contato?.nome ?? 'sem nome'}`,
  `Agora: ${ctx.agora}`,
  `Primeiro contato dele hoje: ${ctx.primeiro_contato_hoje ? 'sim' : 'nao'}`,
];

// Historico de compra entra so a partir da SEGUNDA compra — a Edge Function devolve null
// quando nao vale dizer nada, e a decisao mora la (testada), nao aqui.
if (ctx.historico) cabecalho.push(ctx.historico);

const entrada = [
  ...cabecalho,
  '',
  'CONVERSA ATE AGORA (so historico — NAO e fonte de verdade sobre o pedido):',
  conversa || '(primeira mensagem)',
  '',
  pedido,
  '',
  `ULTIMA MENSAGEM DO CLIENTE: ${base.texto}`,
  '',
  'Responda a ultima mensagem.',
].join('\n');

return [{ json: { entrada, jid: base.jid, message_id: base.message_id, nome: ctx.contato?.nome ?? null } }];
```

- [ ] **Step 3: Reescrever as `toolDescription` das 6 ferramentas**

Trocar **somente** o campo `toolDescription` de cada nó. `jsonBody`, `url`, `method` e autenticação ficam intactos.

`consultar_produto`:
```
Diz o que a Mont vende para o que o cliente falou, com preco. Use para responder pergunta de preco ou de "o que voces tem". NAO use para anotar pedido — para isso e adicionar_item. Lista vazia significa que a Mont nao vende aquilo: diga isso, nao ofereca substituto. Cada produto vem com `disponivel`: o que vier false voce NAO sugere por conta propria e nao cita como alternativa, mas ACEITA normalmente se o cliente pedir por ele — quem sabe o que tem no freezer e a equipe, e recusar venda por numero errado e pior que avisar. Nunca repita o campo `disponivel` para o cliente nem fale de estoque.
```

`adicionar_item`:
```
Poe UM produto no pedido do cliente. Use assim que ele disser QUANTO de QUAL produto. Dois produtos na mesma frase sao DUAS chamadas. Resposta de sucesso traz o pedido inteiro no campo `pedido`: REPITA ele para o cliente com as quantidades — nunca escreva o pedido de cabeca, nunca some nada. Se vier motivo 'ambiguo' (mais de um produto serve) ou 'nao_encontrado' (a Mont nao vende aquilo), NADA foi gravado: leia `opcoes` e `instrucao` e fale com o cliente DIZENDO quais sao as opcoes.
```

`alterar_quantidade`:
```
Muda a quantidade de um produto que JA esta no pedido. A quantidade e a NOVA, nao a diferenca: "mais 1 kg de chipa" quando ja tem 1 kg e quantidade 2. Mesma resposta de adicionar_item — se vier 'ambiguo' ou 'nao_encontrado', nada foi gravado.
```

`remover_item`:
```
Tira um produto do pedido e devolve o que sobrou. Use quando o cliente cancelar um item especifico. Funciona mesmo para produto que saiu do catalogo: tirar do carrinho tem que funcionar sempre.
```

`confirmar_pedido`:
```
Fecha o pedido e AVISA A EQUIPE. Chame SOMENTE depois de o cliente confirmar que pode fechar — antes disso ninguem na equipe sabe de nada. Depois de confirmado, se ele acrescentar algo, e so usar as ferramentas de novo: o pedido reabre sozinho.
```

`consultar_frete`:
```
Devolve a regra de entrega vigente da Mont. Use quando o cliente perguntar sobre entrega ou frete. Sem parametros. O pedido de hoje entra na rota de amanha de manha. Se vier fora_do_alcance = 'a_combinar' para o caso do cliente, NAO invente valor: diga que vai verificar com a equipe. Se o cliente precisar HOJE, a saida e a 99 — use avisar_99.
```

- [ ] **Step 4: Criar o nó de ferramenta `avisar_99`**

Nó novo do tipo `@n8n/n8n-nodes-langchain.toolHttpRequest`, conectado à porta `ai_tool` do `Secretária (AI Agent)` — a mesma fiação das outras seis.

`toolDescription`:
```
Avisa a equipe que o cliente quer a entrega AGORA, pela 99. Use quando ele disser que precisa hoje. O calculo da corrida e manual: alguem da equipe abre o app da 99, poe o endereco e manda o print. Depois de chamar, diga ao cliente que voce ja retorna com o valor. NUNCA chute preco de corrida.
```

`jsonBody`:
```
={{ JSON.stringify({
    acao: 'avisar_99',
    jid: $('Extrair mensagem').first().json.jid,
    endereco: $fromAI('endereco', 'O endereco de entrega como o cliente escreveu. Vazio se ele nao disse ainda', 'string')
  }) }}
```

`url`, `method: POST`, `authentication: genericCredentialType`, `genericAuthType: httpHeaderAuth`, `sendBody: true`, `contentType: json`, `specifyBody: json` — copiar de `confirmar_pedido`.

- [ ] **Step 5: Criar o ramo de aviso da 99 no grupo interno**

⚠️ **`toolHttpRequest` só tem saída `ai_tool`; não tem `main`.** Não existe aresta a partir dela, e tentar criar uma é um nó órfão silencioso. O ramo do aviso pendura no fluxo principal, exatamente como o ramo de `confirmar_pedido` já faz.

Criar três nós, espelhando `Pedido foi confirmado?` → `Destino do aviso (intenção)` → `Avisar intenção ao time`:

1. Nó IF `Pediu a 99?`, pendurado no mesmo ponto do fluxo principal em que `Pedido foi confirmado?` está:
```
={{ (() => { try { return $('avisar_99').first().json.ok === true } catch (e) { return false } })() }}
```
O `try/catch` é **obrigatório**: quando a ferramenta não foi chamada neste turno, `$('avisar_99')` lança — é o mesmo padrão já usado em `Pedido foi confirmado?`.

2. Nó HTTP `Destino do aviso (99)` — cópia de `Destino do aviso (intenção)`, mesmo `jsonBody` (`acao: 'destino_aviso'`).

3. Nó HTTP `Avisar 99 ao time` — cópia de `Avisar intenção ao time`, com:
```
={{ JSON.stringify({ number: $json.jid.split('@')[0], text: $('avisar_99').first().json.texto, delay: 0, linkPreview: false }) }}
```
O texto vem pronto da Edge Function (Task 4), não montado aqui.

⚠️ **Nenhum `onError` nesses três nós.** Falha de aviso tem que ficar vermelha.

- [ ] **Step 6: Validar o workflow antes de ativar**

Run: `mcp__n8n__n8n_validate_workflow` no workflow `JAibLGIwNDLJN0Ym`
Expected: zero erro. Em especial: zero aresta saindo de nó `toolHttpRequest`, zero nó órfão.

- [ ] **Step 7: Provar na conversa real**

Pré-condições: Docker de pé (Evolution + n8n). ⚠️ A prova de vida da Evolution é `docker logs` + última execução do W1 — `connectionState: open` **mente** (mentiu por 44 minutos em 12/09). ⚠️ **Não rodar enquanto o Gilmar estiver usando o sistema.**

Do número `5511980017732`, mandar em sequência:

1. `"oi"` → Expected: cumprimenta pelo horário, **diz o nome Márcia**, se apresenta como do comercial da Mont e pergunta o que a pessoa precisa. Não pode responder só "oi, tudo bem?".
2. `"quanto é o pão de queijo?"` → Expected: fala de **pacote de 1 kg e 2 kg** e dos **tamanhos 25/50/100 g**, dizendo as opções. **Nunca** "porções", **nunca** "qual embalagem". **Nenhum** Baldinho/Balde na resposta.
3. `"achei caro"` → Expected: responde com valor (canastra, artesanal, sem conservante, rende mais). **Nunca** oferece desconto.
4. `"preciso hoje"` → Expected: fala da 99, diz que o cliente paga a corrida e que ela retorna com o valor; e o grupo interno recebe o `🚕 ENTREGA PELA 99`.
5. Mandar uma segunda mensagem qualquer logo depois → Expected: ela **não** se apresenta de novo (`primeiro_contato_hoje` virou `nao`).

Conferir cada execução em `mcp__n8n__n8n_executions` e o que de fato saiu em `wa_envios`.

- [ ] **Step 8: Commit**

```bash
git add infra/crm/workflows/w3-secretaria.json
git commit -m "feat(marcia): prompt de vendedora, mecanica nas ferramentas e aviso da 99"
```

---

### Task 6: W4 — abandono em duas etapas

**Files:**
- Modify: `infra/crm/workflows/w4-abandono.json`

**Interfaces:**
- Consumes: `rascunhos_abandonados` devolvendo `{ retomar, avisar }` (Task 4).
- Produces: nada.

**Como aplicar:** editar o JSON versionado e aplicar no n8n (workflow `tbWlGMiYwMMq6Pof`) via `mcp__n8n__n8n_update_full_workflow` — aqui o full é seguro: são 5 nós e a fiação muda inteira.

- [ ] **Step 1: Partir a saída em duas listas**

Remover o nó `Um por vez` e criar dois nós Code irmãos, ambos ligados à saída de `Buscar abandonados`:

`Retomar, um por vez`:
```javascript
// Etapa 1: a Marcia puxa o cliente. A Edge Function ja aplicou a gaiola e ja marcou
// `retomado_em` — aqui so sai o envio.
return ($json.retomar ?? []).map(r => ({ json: r }));
```

`Avisar, um por vez`:
```javascript
// Etapa 2: ela ja puxou e o cliente seguiu calado. O rascunho ja esta `abandonado`.
return ($json.avisar ?? []).map(a => ({ json: a }));
```

- [ ] **Step 2: Ramo da Etapa 1 — a Márcia manda a mensagem**

Dois nós em série a partir de `Retomar, um por vez`:

1. HTTP `Enviar retomada` → `http://evolution:8080/message/sendText/mont`, mesma autenticação de `Avisar abandono`:
```
={{ JSON.stringify({ number: $json.telefone_wa, text: $json.texto, delay: 4000, linkPreview: false }) }}
```
`delay: 4000` e não `0`: o `delay` da Evolution simula presença de digitação. Uma retomada que chega instantânea denuncia robô — é o mesmo motivo do piso de 4 s em `calcularTempoDigitacaoMs`.

2. HTTP `Registrar retomada` → a Edge Function:
```
={{ JSON.stringify({ acao: 'registrar_envio', telefone_wa: $('Retomar, um por vez').item.json.telefone_wa, message_id: $json.key.id, texto: $('Retomar, um por vez').item.json.texto }) }}
```

⚠️ **Este nó é load-bearing, não é telemetria.** `registrar_envio` grava o `message_id` em `wa_envios`, e é só isso que distingue a voz dela da dos quatro humanos que dividem a conta. Sem ele, `humanoAssumiu` lê a própria retomada como "o Gilmar assumiu" e a Márcia **se cala naquela conversa** — e, pior, a Etapa 2 nunca avisa a equipe, porque o guard de humano manda marcar `abandonado` em silêncio. Ele também grava a fala dela em `mensagens_whatsapp`: o que sai pela API da Evolution **não volta** pelo webhook, então sem isso ela fica amnésica da própria retomada.

⚠️ **Nenhum `onError` em nenhum dos dois.**

- [ ] **Step 3: Ramo da Etapa 2 — o grupo interno**

Manter os dois nós que já existem (`Destino do aviso` → `Avisar abandono`), agora ligados a `Avisar, um por vez`, com o texto ajustado para dizer que ela já tentou:

```
={{ JSON.stringify({ number: $json.jid.split('@')[0], text: `⏳ NAO CONFIRMADO — ${$('Avisar, um por vez').item.json.contato} (${$('Avisar, um por vez').item.json.telefone_wa})\nMontou isto, a Marcia puxou e ele nao respondeu:\n${$('Avisar, um por vez').item.json.pedido}\nProdutos: R$ ${$('Avisar, um por vez').item.json.total.toFixed(2).replace('.', ',')}\nVale uma ligacao?`, delay: 0, linkPreview: false }) }}
```

E o `jsonBody` de `Destino do aviso` passa a ler de `Avisar, um por vez`:
```
={{ JSON.stringify({ acao: 'destino_aviso', telefone_wa: $json.telefone_wa }) }}
```

`$json.jid` no nó de envio é o **grupo interno**, devolvido por `destino_aviso` — não o cliente. O `toFixed(2).replace` fica como está: é o formato que o grupo já lê há semanas, e `total` vem como número.

- [ ] **Step 4: Validar**

Run: `mcp__n8n__n8n_validate_workflow` no workflow `tbWlGMiYwMMq6Pof`
Expected: zero erro, zero nó órfão, **zero `onError: continueRegularOutput`**.

- [ ] **Step 5: Provar o ciclo completo**

Do número de teste, montar um pedido e **não confirmar**. Então:

1. Esperar o cron (10 min) com o rascunho parado há 30+ min. Expected: a Márcia manda a retomada no WhatsApp do número de teste, `retomado_em` preenchido, **nada no grupo**.
2. Conferir que a fala dela entrou nos dois lugares:
```sql
SELECT message_id, texto FROM public.wa_envios
 WHERE telefone_wa = '5511980017732' ORDER BY criado_em DESC LIMIT 1;
SELECT direcao, conteudo FROM public.mensagens_whatsapp
 WHERE telefone_wa = '5511980017732' ORDER BY enviada_em DESC LIMIT 1;
```
Expected: o mesmo `message_id` em `wa_envios` e a linha `saida` com o texto da retomada.
3. **Responder** a retomada e conferir que a Márcia volta a conduzir (e não se cala achando que um humano assumiu). Este é o teste que prova o Step 2: se ela ficar muda, `registrar_envio` falhou.
4. Em outro rascunho, deixar passar 30 min **sem** responder a retomada. Expected: `⏳` no grupo com o texto "a Marcia puxou e ele nao respondeu", status `abandonado`.
5. Em um terceiro, responder pelo **celular do Gilmar** (humano) antes da retomada. Expected: **nada** sai — nem para o cliente, nem para o grupo — e o rascunho vira `abandonado` em silêncio.

- [ ] **Step 6: Commit**

```bash
git add infra/crm/workflows/w4-abandono.json
git commit -m "feat(marcia): W4 puxa o cliente antes de avisar a equipe"
```

---

## Verificação final da branch

- [ ] `pnpm --filter interno exec vitest run` — toda a suíte verde
- [ ] `pnpm --filter interno exec tsc --noEmit` **e** `pnpm turbo build --filter=interno` — o `tsc -b` do build reprova onde o `--noEmit` passa
- [ ] `mcp__supabase-distribuidora__get_advisors` — zero advisor novo depois da migration
- [ ] Contagem de palavras do `systemMessage` ≤ 300
- [ ] `grep -i "porç\|embalagem"` em `w3-secretaria.json` — zero ocorrência no prompt e nas descrições
- [ ] Nenhum `onError` nos nós de envio do W3 e do W4
- [ ] `grep -n "estoqueAtual" infra/crm/workflows/w3-secretaria.json` — zero (o texto morto não voltou)

## O que este plano NÃO faz

- **RAG de técnicas de venda e informações da empresa.** Decisão do diretor: fazer a vendedora primeiro e medir o que ainda falta. Boa parte do que o RAG resolveria cabe na persona e no histórico de compra.
- **Tela de pedido no interno.** O pedido continua chegando no grupo do WhatsApp; a aba de Vendas segue sendo onde o humano fecha.
- **Trocar o modelo do cérebro.** O Groq Llama segue. O diretor já disse que pretende trocar, mas é trabalho próprio — e esta reescrita existe justamente para o prompt parar de depender de o modelo ser esperto.

## Pendências do diretor que este plano não resolve

- **"pão de queijo 2kg 25gr = 8"** da contagem física: esse produto não existe no catálogo (existe o `1kg-25gr`). Até a confirmação, o `1kg-25gr` segue em −103 e a Márcia não vai sugeri-lo — `disponivel: false` passa a ser o mecanismo que garante isso.
- **Custo real do `Pão de Queijo 1kg - 50gr`**: hoje R$ 13,50, estimativa copiada do irmão. A margem desse item é aproximada até a nota do fornecedor aparecer.
