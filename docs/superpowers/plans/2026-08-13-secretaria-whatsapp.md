# Secretária de WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma secretária de IA que responde clientes no WhatsApp da Mont sozinha, com comportamento humano (visualizado, "digitando…", agrupando mensagens), calando quando um humano da equipe assume e escalando o que é sensível.

**Architecture:** O corte é por *o que não pode ser contornado editando um workflow*. No repo (Edge Function + `packages/shared`): gaiola de allowlist, prioridade humana e ferramentas de dados. No n8n: debounce em Redis, coreografia de tempo e o prompt com o AI Agent do Gemini. A tabela `wa_envios` guarda o id de cada mensagem enviada pela agente — é o que permite distinguir a voz dela da dos quatro humanos que dividem a mesma conta.

**Tech Stack:** Supabase (Postgres + Edge Functions em Deno), n8n 2.33.7, Redis 7.4, Evolution API v2.3.7 (Baileys), Gemini 3.5 Flash, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-secretaria-whatsapp-design.md`

## Global Constraints

- **Zero `as any`.** Tipar corretamente sempre.
- **Português brasileiro** em tabelas, colunas, funções e variáveis.
- **Mudança de schema exige backup antes:** `.\supabase\scripts\dump-prod.ps1`, e sempre como migration versionada em `supabase/migrations/`.
- **Toda Edge Function nova precisa de entrada em `supabase/config.toml`** com `verify_jwt = false` ANTES do primeiro deploy. Sem isso o gateway devolve 401 e o chamador quebra em silêncio — foi assim que a CAPI ficou 3 dias parada.
- **Conferir `git branch --show-current` antes de qualquer `functions deploy`** — o deploy publica a árvore da branch atual.
- **RPC nova exige `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`** — o default do Supabase concede a `anon`.
- **Testes:** `pnpm --filter interno test`. Camada unitária (jsdom, sem banco) para lógica pura. Ler `.claude/skills/tdd-mont-pragmatico/SKILL.md` antes de escrever teste.
- **Valores monetários em reais** (numeric), sem centavos.
- **Modo default é `dev`** em tudo que envia. Sair de `dev` é decisão explícita do diretor, nunca do implementador.
- **Número da allowlist inicial:** `5511934417085`.
- **Instância Evolution:** `mont`. URL interna do Docker: `http://evolution:8080`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `packages/shared/src/secretaria.ts` | Lógica pura: tempo de digitação, partição de resposta, decisão de prioridade humana, allowlist |
| `supabase/migrations/*_wa_envios.sql` | Tabela `wa_envios` + índices + RLS |
| `supabase/functions/whatsapp-secretaria/index.ts` | Ações `contexto`, `registrar_envio` e as 3 tools |
| `infra/crm/workflows/w3-secretaria.json` | Workflow n8n: debounce Redis, coreografia, AI Agent |
| `apps/interno/src/utils/__tests__/secretaria.spec.ts` | Testes da lógica pura |

---

### Task 1: Lógica pura da secretária

**Files:**
- Create: `packages/shared/src/secretaria.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/interno/src/utils/__tests__/secretaria.spec.ts`

**Interfaces:**
- Consumes: nada (módulo folha, sem imports)
- Produces:
  - `calcularTempoDigitacaoMs(texto: string, aleatorio?: () => number): number`
  - `particionarResposta(texto: string, maxPorParte?: number): string[]`
  - `humanoAssumiu(msgs: MensagemDaConversa[], idsDaAgente: Set<string>): boolean`
  - `estaLiberado(telefoneWa: string, allowlist: string[], modo: 'dev' | 'producao'): boolean`
  - `interface MensagemDaConversa { messageId: string; direcao: 'entrada' | 'saida'; enviadaEm: string }`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/interno/src/utils/__tests__/secretaria.spec.ts
import { describe, it, expect } from 'vitest'
import {
    calcularTempoDigitacaoMs,
    particionarResposta,
    humanoAssumiu,
    estaLiberado,
    type MensagemDaConversa,
} from '@mont/shared'

describe('calcularTempoDigitacaoMs', () => {
    // Âncora: estudo da Aalto (37 mil voluntários) = 36,2 wpm = 0,6 palavras/s.
    // Fator 0,45 porque quem atende comercialmente digita em rajada, não em lazer.
    const semJitter = () => 0.5 // devolve o meio da faixa: jitter neutro

    it('respeita o piso: resposta de 1 palavra não sai instantânea', () => {
        expect(calcularTempoDigitacaoMs('Oi', semJitter)).toBe(4000)
    })

    it('respeita o teto: resposta enorme não trava por meio minuto', () => {
        const texto = Array(200).fill('palavra').join(' ')
        expect(calcularTempoDigitacaoMs(texto, semJitter)).toBe(15000)
    })

    it('escala com o tamanho entre o piso e o teto', () => {
        // 10 palavras: 10 / 0,6 * 0,45 = 7,5s
        const texto = Array(10).fill('pao').join(' ')
        expect(calcularTempoDigitacaoMs(texto, semJitter)).toBe(7500)
    })

    it('aplica jitter de ±20% — duas respostas iguais nunca demoram igual', () => {
        const texto = Array(10).fill('pao').join(' ')
        expect(calcularTempoDigitacaoMs(texto, () => 0)).toBe(6000)   // -20%
        expect(calcularTempoDigitacaoMs(texto, () => 1)).toBe(9000)   // +20%
    })
})

describe('particionarResposta', () => {
    it('mantém resposta curta inteira', () => {
        expect(particionarResposta('Temos sim, R$ 25.')).toEqual(['Temos sim, R$ 25.'])
    })

    it('parte resposta longa em duas, quebrando entre frases', () => {
        const texto = 'Temos pão de queijo de 1kg por R$ 25. A entrega na sua região sai por R$ 5. Posso separar pra você?'
        const partes = particionarResposta(texto, 60)
        expect(partes.length).toBe(2)
        expect(partes.join(' ')).toBe(texto)
        expect(partes[0].endsWith('.')).toBe(true) // não corta no meio da frase
    })

    it('nunca devolve parte vazia', () => {
        expect(particionarResposta('   ', 60)).toEqual([])
    })
})

describe('humanoAssumiu', () => {
    // A mensagem da agente volta pelo webhook como fromMe=true, idêntica à dos 4
    // humanos que dividem a conta. Sem os ids dela, ela se calaria para sempre.
    const cliente = (id: string, em: string): MensagemDaConversa => ({ messageId: id, direcao: 'entrada', enviadaEm: em })
    const nos = (id: string, em: string): MensagemDaConversa => ({ messageId: id, direcao: 'saida', enviadaEm: em })

    it('humano falou depois do cliente → assumiu', () => {
        const msgs = [cliente('c1', '2026-08-13T10:00:00Z'), nos('h1', '2026-08-13T10:01:00Z')]
        expect(humanoAssumiu(msgs, new Set())).toBe(true)
    })

    it('quem falou depois foi a PRÓPRIA agente → não assumiu', () => {
        const msgs = [cliente('c1', '2026-08-13T10:00:00Z'), nos('a1', '2026-08-13T10:01:00Z')]
        expect(humanoAssumiu(msgs, new Set(['a1']))).toBe(false)
    })

    it('cliente falou por último → não assumiu, mesmo com humano antes', () => {
        const msgs = [
            nos('h1', '2026-08-13T10:00:00Z'),
            cliente('c1', '2026-08-13T10:05:00Z'),
        ]
        expect(humanoAssumiu(msgs, new Set())).toBe(true)
        // ↑ humano falou na conversa, mas o cliente respondeu depois.
        // Regra: prioridade humana vale enquanto ele foi o ÚLTIMO. Aqui não foi.
    })

    it('conversa sem mensagem nossa → não assumiu', () => {
        expect(humanoAssumiu([cliente('c1', '2026-08-13T10:00:00Z')], new Set())).toBe(false)
    })

    it('conversa vazia → não assumiu', () => {
        expect(humanoAssumiu([], new Set())).toBe(false)
    })
})

describe('estaLiberado — a gaiola', () => {
    it('em dev, só número da allowlist passa', () => {
        expect(estaLiberado('5511934417085', ['5511934417085'], 'dev')).toBe(true)
        expect(estaLiberado('5511964911627', ['5511934417085'], 'dev')).toBe(false)
    })

    it('em produção, qualquer número passa', () => {
        expect(estaLiberado('5511964911627', ['5511934417085'], 'producao')).toBe(true)
    })

    it('allowlist vazia em dev bloqueia tudo — falha fechada', () => {
        expect(estaLiberado('5511934417085', [], 'dev')).toBe(false)
    })
})
```

⚠️ O terceiro teste de `humanoAssumiu` documenta uma decisão: se o cliente respondeu DEPOIS do humano, a agente volta a poder falar. Corrigir o teste para `false` se a regra desejada for "humano assume permanentemente" — mas a spec diz prioridade **enquanto ele foi o último**.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter interno exec vitest run src/utils/__tests__/secretaria.spec.ts`
Expected: FAIL — `calcularTempoDigitacaoMs is not exported from '@mont/shared'`

- [ ] **Step 3: Implement**

```typescript
// packages/shared/src/secretaria.ts
/**
 * Lógica pura da secretária de WhatsApp.
 *
 * Mora em `packages/shared` pelo mesmo motivo de `whatsapp.ts`: é a única pasta que o
 * runtime Deno da Edge Function E o Vitest do interno alcançam. Sem dependências.
 */

/** Palavras por segundo. Estudo da Aalto: 36,2 wpm em celular ÷ 60. */
const PALAVRAS_POR_SEGUNDO = 0.6
/** Atendimento comercial digita em rajada, não em ritmo de conversa de lazer. */
const FATOR_COMERCIAL = 0.45
const PISO_MS = 4000
const TETO_MS = 15000
const JITTER = 0.2

/**
 * Tempo de "digitando…" proporcional ao tamanho da resposta.
 *
 * Piso e teto existem por realismo: sem piso, uma resposta de uma palavra sairia
 * instantânea (denuncia robô); sem teto, uma resposta longa passaria de meio minuto
 * digitando, o que não parece humano — parece travado.
 *
 * `aleatorio` é injetável para o teste conseguir fixar o jitter.
 */
export function calcularTempoDigitacaoMs(texto: string, aleatorio: () => number = Math.random): number {
    const palavras = texto.trim().split(/\s+/).filter(Boolean).length
    if (palavras === 0) return PISO_MS

    const base = (palavras / PALAVRAS_POR_SEGUNDO) * FATOR_COMERCIAL * 1000
    const limitado = Math.min(Math.max(base, PISO_MS), TETO_MS)

    // aleatorio() ∈ [0,1] → multiplicador ∈ [1-JITTER, 1+JITTER]
    const fator = 1 - JITTER + aleatorio() * (2 * JITTER)
    return Math.round(limitado * fator)
}

/**
 * Parte resposta longa em mensagens separadas, quebrando ENTRE frases.
 *
 * Ninguém manda um parágrafo de seis linhas de uma vez no WhatsApp; manda duas
 * mensagens com uma pausa. É a assinatura mais humana do aplicativo.
 */
export function particionarResposta(texto: string, maxPorParte = 180): string[] {
    const limpo = texto.trim()
    if (!limpo) return []
    if (limpo.length <= maxPorParte) return [limpo]

    const frases = limpo.match(/[^.!?]+[.!?]*\s*/g) ?? [limpo]
    const partes: string[] = []
    let atual = ''

    for (const frase of frases) {
        if (atual && (atual + frase).trim().length > maxPorParte) {
            partes.push(atual.trim())
            atual = frase
        } else {
            atual += frase
        }
    }
    if (atual.trim()) partes.push(atual.trim())

    return partes
}

export interface MensagemDaConversa {
    messageId: string
    direcao: 'entrada' | 'saida'
    enviadaEm: string
}

/**
 * `true` quando um humano da equipe falou por último — e a agente deve calar.
 *
 * A sutileza que justifica `wa_envios`: a mensagem que a própria agente envia volta
 * pelo webhook com `direcao: 'saida'`, IDÊNTICA à de qualquer um dos quatro humanos que
 * dividem a conta. Sem o conjunto de ids dela, ela leria a própria fala como "humano
 * assumiu" e se calaria para sempre na primeira resposta que desse.
 */
export function humanoAssumiu(msgs: MensagemDaConversa[], idsDaAgente: Set<string>): boolean {
    if (msgs.length === 0) return false

    const ordenadas = [...msgs].sort(
        (a, b) => new Date(a.enviadaEm).getTime() - new Date(b.enviadaEm).getTime(),
    )
    const ultima = ordenadas[ordenadas.length - 1]

    return ultima.direcao === 'saida' && !idsDaAgente.has(ultima.messageId)
}

/**
 * A gaiola. Em `dev` só a allowlist recebe mensagem.
 *
 * Falha FECHADA de propósito: allowlist vazia bloqueia tudo. O mesmo mecanismo do modo
 * sombra do ingestor, que impediu milhares de contatos-lixo quando o WhatsApp migrou
 * para LID.
 */
export function estaLiberado(telefoneWa: string, allowlist: string[], modo: 'dev' | 'producao'): boolean {
    if (modo === 'producao') return true
    return allowlist.includes(telefoneWa)
}
```

```typescript
// packages/shared/src/index.ts — adicionar após o bloco de whatsapp
export {
    calcularTempoDigitacaoMs,
    particionarResposta,
    humanoAssumiu,
    estaLiberado,
} from './secretaria'
export type { MensagemDaConversa } from './secretaria'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter interno exec vitest run src/utils/__tests__/secretaria.spec.ts`
Expected: PASS — 15 testes

- [ ] **Step 5: Type-check both apps**

Run: `pnpm --filter interno exec tsc --noEmit && pnpm --filter catalogo exec tsc --noEmit`
Expected: sem saída (sucesso)

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/secretaria.ts packages/shared/src/index.ts apps/interno/src/utils/__tests__/secretaria.spec.ts
git commit -m "feat(secretaria): logica pura — tempo de digitacao, particao e prioridade humana"
```

---

### Task 2: Tabela `wa_envios`

**Files:**
- Create: `supabase/migrations/<timestamp>_wa_envios.sql`

**Interfaces:**
- Produces: tabela `public.wa_envios (message_id text PK, telefone_wa text, contato_id uuid, texto text, enviado_em timestamptz)`

- [ ] **Step 1: Backup (obrigatório antes de mudança de schema)**

```powershell
Set-Location 'D:\3. DEV\mont'; .\supabase\scripts\dump-prod.ps1
```
Expected: dois arquivos não-vazios em `supabase/backups/dumps/`

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/<timestamp>_wa_envios.sql
-- Memória do que a SECRETÁRIA enviou.
--
-- Sem esta tabela o projeto não funciona. A mensagem que a agente envia volta pelo
-- webhook da Evolution como `fromMe: true` — indistinguível da mensagem de qualquer um
-- dos quatro humanos que dividem a conta da Mont (Gilmar, Luccas, mãe e esposa).
--
-- Sem distinguir: ou ela lê a própria fala como "um humano assumiu" e se cala para
-- sempre na primeira resposta que dá, ou ignora todo `fromMe` e fica cega para a equipe,
-- falando por cima de gente atendendo cliente de verdade.
--
-- A Evolution devolve o `message_id` no envio; é ele que guardamos aqui.

CREATE TABLE IF NOT EXISTS public.wa_envios (
  message_id  text PRIMARY KEY,
  telefone_wa text NOT NULL,
  contato_id  uuid REFERENCES public.contatos(id) ON DELETE SET NULL,
  texto       text,
  enviado_em  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wa_envios IS
  'Ids das mensagens enviadas pela secretaria de IA. Permite distinguir a voz dela da dos humanos que dividem a conta.';

CREATE INDEX IF NOT EXISTS idx_wa_envios_telefone ON public.wa_envios (telefone_wa, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_wa_envios_contato  ON public.wa_envios (contato_id);

-- Escrita: só service_role (a Edge Function). Leitura: admin, para auditoria — dá para
-- perguntar "o que a IA falou com esse cliente?" sem abrir o banco.
ALTER TABLE public.wa_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler wa_envios"
  ON public.wa_envios FOR SELECT TO authenticated USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 3: Apply via MCP**

Usar `mcp__supabase-distribuidora__apply_migration` com `name: "wa_envios"` e o SQL acima.
Expected: `{"success": true}`

- [ ] **Step 4: Verify**

```sql
select count(*) as linhas from wa_envios;
select relrowsecurity from pg_class where relname = 'wa_envios';
```
Expected: `linhas = 0`, `relrowsecurity = true`

- [ ] **Step 5: Corrigir o telefone do contato de teste**

```sql
update contatos set telefone = '11934417085'
where id = 'b62db9b8-b1f2-4047-b692-af858064abb1';

select nome, telefone, telefone_wa, status, origem from contatos
where id = 'b62db9b8-b1f2-4047-b692-af858064abb1';
```
Expected: `telefone_wa = '5511934417085'` (coluna gerada deriva sozinha)

- [ ] **Step 6: Regenerate types and commit**

```bash
DO_NOT_TRACK=1 npx supabase gen types typescript --linked > packages/shared/src/database.ts
pnpm --filter interno exec tsc --noEmit
git add supabase/migrations packages/shared/src/database.ts
git commit -m "feat(secretaria): tabela wa_envios — distingue a voz da agente da dos humanos"
```

---

### Task 3: Edge Function `whatsapp-secretaria` — contexto e registro

**Files:**
- Create: `supabase/functions/whatsapp-secretaria/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `humanoAssumiu`, `estaLiberado`, `MensagemDaConversa` (Task 1); `wa_envios` (Task 2)
- Produces: HTTP POST com `{ acao }`:
  - `contexto` `{ telefone_wa }` → `{ ok, pode_responder, motivo, contato: { id, nome }, conversa: Array<{de,texto,em}>, catalogo: Array<{nome,preco,tem_estoque}> }`
  - `registrar_envio` `{ message_id, telefone_wa, texto }` → `{ ok }`

- [ ] **Step 1: Declare in config.toml BEFORE deploying**

```toml
# supabase/config.toml — adicionar junto das outras funções de máquina
[functions.whatsapp-secretaria]
verify_jwt = false
```

⚠️ Sem isso o gateway devolve `401 UNAUTHORIZED_NO_AUTH_HEADER` antes da função rodar, e nada acusa. Foi o que deixou a CAPI 3 dias parada.

- [ ] **Step 2: Implement**

```typescript
// supabase/functions/whatsapp-secretaria/index.ts
// Edge Function: whatsapp-secretaria
//
// NÃO decide o que dizer. Responde três perguntas para o n8n:
//   · este número está liberado?          (gaiola)
//   · quem falou por último foi humano?   (prioridade humana)
//   · quais são os produtos e preços reais?
//
// O que dizer é do AI Agent no n8n. O que mora aqui é o que não pode ser contornado
// editando um workflow.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  humanoAssumiu,
  estaLiberado,
  type MensagemDaConversa,
} from '../../../packages/shared/src/secretaria.ts'

const MAX_MENSAGENS_CONTEXTO = 30

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ingestor-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function lerModo(): 'dev' | 'producao' {
  return Deno.env.get('SECRETARIA_MODO') === 'producao' ? 'producao' : 'dev'
}

function lerAllowlist(): string[] {
  return (Deno.env.get('SECRETARIA_ALLOWLIST') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function montarContexto(admin: SupabaseClient, telefoneWa: string) {
  const { data: contato } = await admin
    .from('contatos')
    .select('id, nome')
    .eq('telefone_wa', telefoneWa)
    .maybeSingle()

  // Sem contato não há histórico nem contexto. Em modo ativo o ingestor cria o contato
  // ao registrar a primeira mensagem, então isto cobre a corrida entre os dois.
  if (!contato) return { pode_responder: false, motivo: 'contato_nao_casado' as const }

  const { data: msgs } = await admin
    .from('mensagens_whatsapp')
    .select('message_id, direcao, conteudo, tipo_midia, enviada_em')
    .eq('telefone_wa', telefoneWa)
    .eq('historico', false)
    .order('enviada_em', { ascending: false })
    .limit(MAX_MENSAGENS_CONTEXTO)

  const ordenadas = (msgs ?? []).slice().reverse()

  const { data: envios } = await admin
    .from('wa_envios')
    .select('message_id')
    .eq('telefone_wa', telefoneWa)

  const idsDaAgente = new Set((envios ?? []).map((e) => e.message_id))

  const paraRegra: MensagemDaConversa[] = ordenadas.map((m) => ({
    messageId: m.message_id,
    direcao: m.direcao as 'entrada' | 'saida',
    enviadaEm: m.enviada_em,
  }))

  if (humanoAssumiu(paraRegra, idsDaAgente)) {
    return { pode_responder: false, motivo: 'humano_assumiu' as const, contato }
  }

  const { data: produtos } = await admin
    .from('produtos')
    .select('nome, preco, estoque_atual')
    .eq('ativo', true)
    .order('nome')

  return {
    pode_responder: true,
    motivo: 'ok' as const,
    contato,
    conversa: ordenadas.map((m) => ({
      de: m.direcao === 'entrada' ? 'cliente' : 'nos',
      texto: m.conteudo ?? `[${m.tipo_midia}]`,
      em: m.enviada_em,
    })),
    catalogo: (produtos ?? []).map((p) => ({
      nome: p.nome,
      preco: Number(p.preco ?? 0),
      tem_estoque: Number(p.estoque_atual ?? 0) > 0,
    })),
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const segredo = Deno.env.get('INGESTOR_SECRET')
  if (!segredo || req.headers.get('x-ingestor-secret') !== segredo) {
    return json({ error: 'Não autorizado' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const telefoneWa = typeof body.telefone_wa === 'string' ? body.telefone_wa : ''
    if (!telefoneWa) return json({ error: 'telefone_wa é obrigatório' }, 400)

    if (body.acao === 'contexto') {
      const modo = lerModo()
      // A gaiola vem ANTES de qualquer consulta: número bloqueado nem gera contexto.
      if (!estaLiberado(telefoneWa, lerAllowlist(), modo)) {
        console.log(`[secretaria] bloqueado pela gaiola: ${telefoneWa} (modo ${modo})`)
        return json({ ok: true, pode_responder: false, motivo: 'fora_da_allowlist', modo }, 200)
      }
      const ctx = await montarContexto(admin, telefoneWa)
      return json({ ok: true, modo, ...ctx }, 200)
    }

    if (body.acao === 'registrar_envio') {
      const messageId = typeof body.message_id === 'string' ? body.message_id : ''
      if (!messageId) return json({ error: 'message_id é obrigatório' }, 400)

      const { data: contato } = await admin
        .from('contatos').select('id').eq('telefone_wa', telefoneWa).maybeSingle()

      const { error } = await admin.from('wa_envios').upsert({
        message_id: messageId,
        telefone_wa: telefoneWa,
        contato_id: contato?.id ?? null,
        texto: typeof body.texto === 'string' ? body.texto : null,
      }, { onConflict: 'message_id' })

      if (error) return json({ error: error.message }, 400)
      return json({ ok: true }, 200)
    }

    return json({ error: "acao deve ser 'contexto' ou 'registrar_envio'" }, 400)
  } catch (e) {
    console.error('[whatsapp-secretaria]', e)
    return json({ error: (e as Error).message }, 500)
  }
})
```

- [ ] **Step 3: Set the secrets**

```bash
DO_NOT_TRACK=1 npx supabase secrets set SECRETARIA_MODO=dev SECRETARIA_ALLOWLIST=5511934417085
```

- [ ] **Step 4: Check branch, then deploy**

```bash
git branch --show-current
DO_NOT_TRACK=1 npx supabase functions deploy whatsapp-secretaria
```
Expected: `Deployed Functions on project herlvujykltxnwqmwmyx: whatsapp-secretaria`

- [ ] **Step 5: Verify the cage and the human-priority rule**

```bash
cd "D:/3. DEV/mont/infra/crm" && set -a && . ./.env && set +a
URL="https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/whatsapp-secretaria"

# sem segredo → 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL" -H 'Content-Type: application/json' -d '{"acao":"contexto","telefone_wa":"5511934417085"}'

# número fora da allowlist → pode_responder false, motivo fora_da_allowlist
curl -s -X POST "$URL" -H "x-ingestor-secret: $INGESTOR_SECRET" -H 'Content-Type: application/json' \
  -d '{"acao":"contexto","telefone_wa":"5511964911627"}'

# número da allowlist → contexto com catálogo
curl -s -X POST "$URL" -H "x-ingestor-secret: $INGESTOR_SECRET" -H 'Content-Type: application/json' \
  -d '{"acao":"contexto","telefone_wa":"5511934417085"}'
```
Expected: `401`; depois `{"ok":true,"pode_responder":false,"motivo":"fora_da_allowlist","modo":"dev"}`; depois um contexto com `catalogo` de 25 itens.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/whatsapp-secretaria supabase/config.toml
git commit -m "feat(secretaria): edge function de contexto — gaiola e prioridade humana"
```

---

### Task 4: As três ferramentas

**Files:**
- Modify: `supabase/functions/whatsapp-secretaria/index.ts`

**Interfaces:**
- Produces: três novas ações na mesma função:
  - `consultar_produto` `{ termo }` → `{ ok, produtos: Array<{nome,preco,tem_estoque}> }`
  - `consultar_frete` `{}` → `{ ok, modo, valor, ate_km, fora_do_alcance }`
  - `registrar_pedido_intencao` `{ telefone_wa, resumo }` → `{ ok, interacao_id }`

> **A lista de ferramentas é a lista de permissões.** Não existe tool de saldo/dívida, mesmo trivial de escrever: são R$ 4.868 vencidos há mais de 30 dias, e ferramenta que existe a agente eventualmente usa — comentando dívida ou negociando prazo, que é exatamente o que decidimos escalar.

- [ ] **Step 1: Add the three actions**

```typescript
// dentro do try do Deno.serve, antes do return de erro final

if (body.acao === 'consultar_produto') {
  const termo = typeof body.termo === 'string' ? body.termo.trim() : ''
  if (!termo) return json({ error: 'termo é obrigatório' }, 400)

  const { data } = await admin
    .from('produtos')
    .select('nome, preco, estoque_atual')
    .eq('ativo', true)
    .ilike('nome', `%${termo}%`)
    .order('nome')
    .limit(10)

  return json({
    ok: true,
    produtos: (data ?? []).map((p) => ({
      nome: p.nome,
      preco: Number(p.preco ?? 0),
      tem_estoque: Number(p.estoque_atual ?? 0) > 0,
    })),
  }, 200)
}

if (body.acao === 'consultar_frete') {
  // Lê a configuração real em vez de embutir a regra: o Gilmar muda o frete na tela
  // de Configurações, e a secretária tem que falar o mesmo número que o sistema cobra.
  const { data } = await admin
    .from('configuracoes').select('valor').eq('chave', 'frete_config').maybeSingle()

  const cfg = (data?.valor ?? {}) as {
    modo?: string
    faixas?: Array<{ ateKm?: number; valorFixo?: number }>
    foraDoAlcance?: string
  }
  const faixa = cfg.faixas?.[0]

  return json({
    ok: true,
    modo: cfg.modo ?? 'desconhecido',
    valor: faixa?.valorFixo ?? null,
    ate_km: faixa?.ateKm ?? null,
    // 'a_combinar' NÃO é para a agente improvisar — é caso de escalar.
    fora_do_alcance: cfg.foraDoAlcance ?? 'a_combinar',
  }, 200)
}

if (body.acao === 'registrar_pedido_intencao') {
  const resumo = typeof body.resumo === 'string' ? body.resumo.trim() : ''
  if (!resumo) return json({ error: 'resumo é obrigatório' }, 400)

  // NÃO cria venda de propósito. Venda criada por IA viraria estoque baixado e
  // recebível fantasma. Aqui só fica o registro na timeline; quem transforma em venda
  // é um humano, no sistema.
  const { data, error } = await admin.rpc('rpc_registrar_interacao_ia', {
    p_telefone_wa: telefoneWa,
    p_payload: {
      tipo: 'ponto_contato',
      sentido: 'entrada',
      resultado: 'aceitou',
      observacao: `[intenção de compra] ${resumo}`,
    },
    p_message_ids: [],
  })

  if (error) return json({ error: error.message }, 400)
  return json({ ok: true, interacao_id: data }, 200)
}
```

⚠️ `rpc_registrar_interacao_ia` tem guarda de idempotência que retorna `NULL` quando não há mensagem pendente em `p_message_ids`. Com array vazio ela retornaria `NULL` sem inserir. **Antes de implementar, verificar a RPC** (`supabase/migrations/20260813060000_rpc_registrar_interacao_ia.sql`) e, se for o caso, passar os `message_ids` da conversa em vez de array vazio.

- [ ] **Step 2: Deploy and verify each tool**

```bash
git branch --show-current
DO_NOT_TRACK=1 npx supabase functions deploy whatsapp-secretaria

cd "D:/3. DEV/mont/infra/crm" && set -a && . ./.env && set +a
URL="https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/whatsapp-secretaria"
curl -s -X POST "$URL" -H "x-ingestor-secret: $INGESTOR_SECRET" -H 'Content-Type: application/json' \
  -d '{"acao":"consultar_produto","telefone_wa":"5511934417085","termo":"queijo"}'
curl -s -X POST "$URL" -H "x-ingestor-secret: $INGESTOR_SECRET" -H 'Content-Type: application/json' \
  -d '{"acao":"consultar_frete","telefone_wa":"5511934417085"}'
```
Expected: lista de produtos com preço; e `{"ok":true,"modo":"valor_fixo","valor":5,"ate_km":30,"fora_do_alcance":"a_combinar"}`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/whatsapp-secretaria
git commit -m "feat(secretaria): tools de produto, frete e intencao de pedido"
```

---

### Task 5: Workflow n8n com debounce em Redis

**Files:**
- Create: `infra/crm/workflows/w3-secretaria.json`

**Interfaces:**
- Consumes: as 5 ações da Task 3 e 4; credenciais `Ingestor Mont`, `Evolution API`, `Gemini API` (já existem no n8n)
- Produces: workflow ativo no n8n

- [ ] **Step 1: Create the Redis credential in n8n**

```bash
cd "D:/3. DEV/mont/infra/crm" && set -a && . ./.env && set +a
curl -s -X POST http://localhost:5678/api/v1/credentials -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Redis Mont","type":"redis","data":{"host":"redis","port":6379,"database":3}}'
```

Database 3 de propósito: a Evolution usa a 6 (`CACHE_REDIS_URI=redis://redis:6379/6`). Separar evita que um `FLUSHDB` de um derrube o outro.

- [ ] **Step 2: Build the workflow**

Nós, em ordem:

1. **Webhook** (`POST /webhook/secretaria`) — a Evolution já aponta para `/webhook/evolution`; este workflow recebe uma cópia via um nó HTTP no W1, OU um segundo webhook configurado na instância. **Escolher a primeira** (menos configuração na Evolution, e o W1 já é o ponto único de entrada).
2. **Code "Extrair conversa"** — lê `$json.body.data`, pega `key.remoteJid` → telefone, ignora `fromMe` e grupo.
3. **Redis (set)** — chave `secretaria:ultima:{telefone}` = timestamp atual, TTL 300s.
4. **Wait** — 12 segundos.
5. **Redis (get)** — mesma chave.
6. **IF** — se o valor lido ≠ o que este ramo gravou, **esta execução morre** (chegou mensagem mais nova; a execução dela assume).
7. **HTTP `contexto`** → se `pode_responder: false`, encerra.
8. **AI Agent (Gemini 3.5 Flash)** com as tools apontando para `consultar_produto`, `consultar_frete`, `registrar_pedido_intencao`, e este system prompt:

```
Você é a atendente da Mont Distribuidora, que vende pão de queijo artesanal em
São Bernardo do Campo e região do ABC. Você atende pelo WhatsApp da empresa.

COMO VOCÊ FALA
- Português brasileiro, informal e direto, como quem atende bem — não como robô.
- Frases curtas. Nada de "prezado cliente", "estou à disposição", "conforme
  solicitado".
- No máximo 3 frases por resposta. Quem lê está no celular.
- Um emoji só quando cabe naturalmente. Nunca mais de um.

O QUE VOCÊ FAZ
- Responde preço, se tem em estoque, e valor da entrega — sempre consultando as
  ferramentas. Nunca invente preço, produto ou prazo.
- Se o cliente demonstrar que quer comprar, use registrar_pedido_intencao e diga
  que já vai passar para a equipe finalizar.

O QUE VOCÊ NUNCA FAZ
- Nunca fale sobre fiado, dívida, prazo de pagamento, parcelamento ou desconto.
- Nunca prometa data ou horário de entrega.
- Nunca trate reclamação de produto ou de entrega.
- Nunca feche a venda você mesma.
- Se o frete voltar como "a combinar", NÃO invente valor.

Nesses casos responda algo como "vou verificar isso com a equipe e já te
retorno" — sem prometer prazo para o retorno — e nada além disso.

Se não souber, diga que vai verificar. Nunca chute.
```

⚠️ Este prompt é a implementação da §8 da spec. As duas travas que **não** dependem dele — allowlist e prioridade humana — já estão no código (Task 3), porque instrução o modelo pode contornar.
9. **Code "Preparar envio"** — `particionarResposta` + `calcularTempoDigitacaoMs` (reimplementar? **NÃO** — chamar a Edge Function não vale a ida e volta; copiar as duas funções para o nó Code é aceitável **apenas aqui**, com comentário apontando para `packages/shared/src/secretaria.ts` como fonte).

   ⚠️ **Alternativa preferível:** expor uma ação `preparar_envio` na Edge Function que devolve `{ partes: string[], tempos_ms: number[] }`. Custa uma chamada e elimina a terceira cópia da regra — e este projeto já foi mordido por cópia de regra (a canonicalização de telefone divergiu num nó do n8n e descartou um cliente). **Implementar assim.**

10. **HTTP** `chat/markMessageAsRead` na Evolution.
11. **Wait** 1-4s (aleatório).
12. **Loop por parte:** `chat/sendPresence` (composing) → **Wait** pelo tempo calculado → `message/sendText` → **HTTP `registrar_envio`** com o `key.id` devolvido.

- [ ] **Step 3: Validate the workflow JSON before creating**

Usar `mcp__n8n__validate_workflow` com o JSON completo.
Expected: `{"valid": true, "errorCount": 0}`

- [ ] **Step 4: Create, keep INACTIVE, export**

```bash
curl -s -X POST http://localhost:5678/api/v1/workflows -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H 'Content-Type: application/json' --data-binary @w3.json
# exportar para o repo, conferindo que nenhum segredo veio junto
```

- [ ] **Step 5: Commit**

```bash
git add infra/crm/workflows/w3-secretaria.json
git commit -m "feat(secretaria): workflow n8n com debounce em Redis (inativo)"
```

---

### Task 5b: Aviso no canal interno

**Files:**
- Modify: `supabase/functions/whatsapp-secretaria/index.ts`
- Modify: `infra/crm/workflows/w3-secretaria.json`

**Interfaces:**
- Produces: ação `destino_aviso` `{}` → `{ ok, jid, tipo: 'grupo' | 'fallback_dev' }`

Implementa a §10 da spec. A equipe precisa saber quando a secretária **se conteve** — é a informação que eles não têm. Quando ela responde normal, não avisa nada: aviso que chega demais para de ser lido.

- [ ] **Step 1: Add the destination action**

```typescript
// dentro do try do Deno.serve, junto das outras ações
if (body.acao === 'destino_aviso') {
  // O id do grupo é constante VALIDADA, nunca campo livre: dos 3 grupos visíveis na
  // conta, um tem 281 participantes (workshop externo). Id errado publicaria pedido de
  // cliente, com nome e valor, para 281 estranhos.
  const grupo = Deno.env.get('SECRETARIA_GRUPO_AVISO') ?? ''
  const fallbackDev = '5511934417085@s.whatsapp.net'
  const ehGrupoValido = grupo.endsWith('@g.us')

  // Enquanto o número da Mont não estiver no grupo da equipe, o aviso vai para o
  // Luccas — que assim vê as duas pontas na mesma tela durante o desenvolvimento.
  return json({
    ok: true,
    jid: ehGrupoValido ? grupo : fallbackDev,
    tipo: ehGrupoValido ? 'grupo' : 'fallback_dev',
  }, 200)
}
```

- [ ] **Step 2: Add the notification branch in the workflow**

Depois do AI Agent, um nó **IF**. Dispara o aviso quando (a) `contexto` devolveu `pode_responder: false` com motivo `humano_assumiu`, ou (b) a resposta da agente indica escalada. Nesse caso:

1. **HTTP `destino_aviso`** → pega o JID
2. **HTTP `message/sendText`** para esse JID:

```
🤖 {nome_do_cliente} ({telefone})
Não respondi: {motivo}
Última mensagem: "{ultima_mensagem_do_cliente}"
```

Sem `delay` e sem "digitando" — canal interno não precisa de teatro.

- [ ] **Step 3: Deploy and verify**

```bash
git branch --show-current
DO_NOT_TRACK=1 npx supabase functions deploy whatsapp-secretaria
cd "D:/3. DEV/mont/infra/crm" && set -a && . ./.env && set +a
curl -s -X POST "https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/whatsapp-secretaria" \
  -H "x-ingestor-secret: $INGESTOR_SECRET" -H 'Content-Type: application/json' \
  -d '{"acao":"destino_aviso","telefone_wa":"5511934417085"}'
```
Expected: `{"ok":true,"jid":"5511934417085@s.whatsapp.net","tipo":"fallback_dev"}`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/whatsapp-secretaria infra/crm/workflows/w3-secretaria.json
git commit -m "feat(secretaria): aviso no canal interno quando ela se contem"
```

---

### Task 6: Teste de integração manual pelo número do Luccas

**Files:** nenhum — é validação.

- [ ] **Step 1: Confirm the cage before activating**

```sql
select telefone_wa from contatos where id = 'b62db9b8-b1f2-4047-b692-af858064abb1';
```
Expected: `5511934417085`. Conferir também que `SECRETARIA_MODO=dev`.

- [ ] **Step 2: Activate and run the four scenarios**

Do celular do Luccas, para o número da Mont:

| Cenário | O que mandar | Esperado |
|---|---|---|
| Conversa normal | "Oi, quanto custa o pão de queijo?" | Visualizado → digitando → resposta com preço real do catálogo |
| Rajada | 5 mensagens seguidas, rápido | **Uma** resposta só, cobrindo tudo |
| Humano assume | Mandar pergunta; alguém da equipe responde pelo celular | Secretária **não** responde |
| Sensível | "Posso pagar depois?" | Ela **não** fala de prazo; diz que vai verificar |

- [ ] **Step 3: Verify in the database**

```sql
select message_id, telefone_wa, left(texto, 60) as texto, enviado_em
from wa_envios order by enviado_em desc limit 10;

-- nada pode ter ido para número fora da allowlist
select count(*) as vazamentos from wa_envios where telefone_wa <> '5511934417085';
```
Expected: envios só para `5511934417085`; `vazamentos = 0`

- [ ] **Step 4: Full regression**

```bash
pnpm --filter interno exec vitest run --exclude "**/*.integration.test.ts"
pnpm --filter interno exec tsc --noEmit && pnpm --filter catalogo exec tsc --noEmit
pnpm turbo build --filter=interno
```
Expected: tudo verde (214 testes + os 15 novos = 229)

- [ ] **Step 5: Commit the observations**

Registrar no README de `infra/crm/` o que foi observado, principalmente o **comportamento do debounce em rajada** — ponto que o diretor pediu para acompanhar de perto.

---

## Ordem e dependências

```
Task 1 (lógica pura) ─┬─→ Task 3 (edge function) ─→ Task 4 (tools) ─→ Task 5 (n8n) ─→ Task 5b (aviso) ─→ Task 6 (teste real)
Task 2 (wa_envios) ───┘
```

Tasks 1 e 2 são independentes e podem ser feitas em qualquer ordem. Da 3 em diante é sequencial.

## Fora deste plano

Follow-up proativo, RAG, consulta ao Gilmar antes de responder, criação de venda/cliente pela agente, e o aviso no grupo interno (depende de o número da Mont ser adicionado ao grupo — até lá os avisos vão para o número do Luccas).
