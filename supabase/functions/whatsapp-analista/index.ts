// Edge Function: whatsapp-analista
//
// O analista de conversa do CRM. Lê as mensagens do WhatsApp ainda não analisadas,
// divide em conversas (segmentos separados por 6h de silêncio), pede ao LLM o registro
// de cada uma e grava pela RPC `rpc_registrar_interacao_ia` — a única porta de escrita da
// IA na timeline, que também aplica a trava do kanban (a IA só avança o card).
//
// Até 14/10/2026 isto rodava no n8n (W2) com o Gemini gratuito, que esgotava a cota de
// 20 chamadas/dia antes das 6h e falhava em silêncio. Agora roda inteiro aqui:
// pg_cron (a cada 15 min) → esta função → Groq `openai/gpt-oss-20b` → RPC. Prompt e
// validação moram em packages/shared/src/analista.ts, com testes.
//
// Ação única: { acao: 'rodar', simular?: boolean, limite?: number, contatos?: uuid[] }
//   • simular = chama o LLM e calcula o movimento do card pela MESMA regra da trava
//     (rpc_analista_previa), mas não grava interação, não marca mensagem, não conta falha.
//   • contatos (só com simular) = amostra: só os segmentos desses contatos, na ordem.
//   • reprocessar_desde (só com simular + contatos) = relê as conversas desses contatos a
//     partir da data, MESMO já analisadas — para comparar o prompt novo com as notas gravadas.
//   • Segmento de contato arquivado, ou em que o cliente só mandou mídia sem texto, sai da
//     fila SEM nota e sem mexer no card (rpc_analista_descartar). Não gasta chamada ao LLM.
//   • Toda rodada (simulada ou não) vira uma linha em `wa_analista_rodadas`.
//
// Nada é engolido: resposta inválida tenta mais uma vez e, se falhar de novo, conta falha
// no segmento (5 falhas → travado, sai da fila); 429 do Groq encerra a rodada com aviso;
// erro do Groq 5xx/rede adia o segmento; exceção marca a rodada como `erro` e devolve 500.
//
// Autenticação: x-cron-secret == CRON_SECRET (pg_cron, segredo no vault
// `meta_capi_cron_secret`) OU x-ingestor-secret == INGESTOR_SECRET (chamada manual).
//
// Segredos: GROQ_API_KEY, CRON_SECRET, INGESTOR_SECRET; SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY vêm do runtime.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  montarPromptUsuario,
  motivoDescarte,
  PROMPT_SISTEMA,
  segmentar,
  validarVeredito,
  type MensagemPendente,
  type Segmento,
  type Veredito,
  PROMPT_PEDIDO,
  validarPedidoExtraido,
  type PedidoExtraido,
} from '../../../packages/shared/src/analista.ts'

const MODELO = 'openai/gpt-oss-20b'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
// O Groq reserva o teto de saída no limite por minuto (8000 tokens). 400 cobre o JSON e
// o raciocínio curto do reasoning_effort=low (medido: ~60 tokens).
const MAX_COMPLETION = 400
const LIMITE_CRON = 5
const LIMITE_MAXIMO = 10
// Depois disso não começa segmento novo: a function tem teto de execução.
const ORCAMENTO_MS = 110_000
const ESPERA_MAXIMA_MS = 30_000
const LIMITE_FALHAS = 5

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ingestor-secret, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Groq ────────────────────────────────────────────────────────────────────────

type Mensagem = { role: 'system' | 'user' | 'assistant'; content: string }

type RespostaGroq =
  | { tipo: 'ok'; conteudo: string; tokens: number }
  | { tipo: 'invalido'; motivo: string }
  | { tipo: 'limite'; aviso: string }
  | { tipo: 'transitorio'; erro: string }

/** "7.66s", "2m59.5s", "120ms" → ms */
function duracaoMs(valor: string | null): number | null {
  if (!valor) return null
  let total = 0
  let achou = false
  for (const [, n, u] of valor.matchAll(/([\d.]+)(ms|h|m|s)/g)) {
    achou = true
    const x = Number(n)
    total += u === 'h' ? x * 3_600_000 : u === 'm' ? x * 60_000 : u === 's' ? x * 1000 : x
  }
  return achou ? Math.ceil(total) : null
}

/** Ritmo pelos cabeçalhos x-ratelimit do Groq: espera o balde de tokens encher. */
class Ritmo {
  private restantes: number | null = null
  private resetEm = 0

  registrar(h: Headers) {
    const r = Number(h.get('x-ratelimit-remaining-tokens'))
    if (Number.isFinite(r)) this.restantes = r
    const ms = duracaoMs(h.get('x-ratelimit-reset-tokens'))
    if (ms !== null) this.resetEm = Date.now() + ms
  }

  /** ms a esperar antes de uma chamada que precisa de `tokens`. */
  espera(tokens: number): number {
    if (this.restantes === null || this.restantes >= tokens) return 0
    return Math.max(0, this.resetEm - Date.now()) + 250
  }
}

async function chamarGroq(chave: string, mensagens: Mensagem[], ritmo: Ritmo): Promise<RespostaGroq> {
  let res: Response
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        messages: mensagens,
        response_format: { type: 'json_object' },
        reasoning_effort: 'low',
        max_completion_tokens: MAX_COMPLETION,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    return { tipo: 'transitorio', erro: `rede: ${(e as Error).message}` }
  }

  ritmo.registrar(res.headers)
  const corpo = await res.text()

  if (res.status === 429) {
    const qual = res.headers.get('x-ratelimit-remaining-requests') === '0' ? 'pedidos por dia' : 'tokens por minuto'
    const depois = res.headers.get('retry-after')
    return { tipo: 'limite', aviso: `Groq 429 (${qual})${depois ? `, retry-after ${depois}s` : ''}: ${corpo.slice(0, 300)}` }
  }
  // json_object: quando o modelo não produz JSON válido o Groq devolve 400 json_validate_failed.
  if (res.status === 400 && corpo.includes('json_validate_failed')) {
    return { tipo: 'invalido', motivo: 'o modelo não produziu JSON válido' }
  }
  if (!res.ok) {
    return { tipo: 'transitorio', erro: `Groq HTTP ${res.status}: ${corpo.slice(0, 300)}` }
  }

  try {
    const dados = JSON.parse(corpo)
    const escolha = dados?.choices?.[0]
    if (escolha?.finish_reason === 'length') {
      return { tipo: 'invalido', motivo: 'resposta cortada no limite de tokens' }
    }
    return { tipo: 'ok', conteudo: String(escolha?.message?.content ?? ''), tokens: Number(dados?.usage?.total_tokens ?? 0) }
  } catch {
    return { tipo: 'transitorio', erro: `Groq devolveu corpo ilegível: ${corpo.slice(0, 200)}` }
  }
}

// ── Pedido fechado (bloco C) ────────────────────────────────────────────────────

/**
 * Segundo passo, só num "aceitou": lê o pedido com o prompt da conferência. Não mexe no
 * veredito nem na timeline; falha aqui nunca derruba o segmento.
 */
async function extrairPedido(
  chave: string,
  seg: Segmento,
  nome: string | null,
  ritmo: Ritmo,
): Promise<{ pedido: PedidoExtraido } | { falhou: string }> {
  const conversa: Mensagem[] = [
    { role: 'system', content: PROMPT_PEDIDO },
    { role: 'user', content: montarPromptUsuario(seg, nome) },
  ]
  let motivo = 'sem resposta'
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const estimativa = Math.ceil(conversa.reduce((n, m) => n + m.content.length, 0) / 3) + MAX_COMPLETION
    const espera = ritmo.espera(estimativa)
    if (espera > ESPERA_MAXIMA_MS) return { falhou: `limite de tokens por minuto (esperaria ${Math.round(espera / 1000)}s)` }
    if (espera > 0) await dormir(espera)

    const r = await chamarGroq(chave, conversa, ritmo)
    if (r.tipo === 'limite') return { falhou: r.aviso }
    if (r.tipo === 'transitorio') return { falhou: r.erro }
    if (r.tipo === 'invalido') {
      motivo = r.motivo
    } else {
      const v = validarPedidoExtraido(r.conteudo, seg)
      if (v.ok) return { pedido: v.pedido }
      motivo = v.motivo
      conversa.push({ role: 'assistant', content: r.conteudo })
    }
    conversa.push({ role: 'user', content: `Resposta inválida: ${motivo}. Responda de novo, só com o objeto JSON.` })
  }
  return { falhou: `leitura inválida após 2 tentativas: ${motivo}` }
}

// ── Rodada ──────────────────────────────────────────────────────────────────────

interface Detalhe {
  contato_id: string
  nome: string | null
  inicio: string
  fim: string
  mensagens: number
  sentido: 'entrada' | 'saida'
  situacao: 'gravado' | 'simulado' | 'falha' | 'travado' | 'adiado' | 'ja_processado' | 'descartado'
  /** Por que o segmento saiu da fila sem nota. */
  descarte?: string
  tentativas?: number
  veredito?: Veredito
  movimento?: { aba: string | null; de: string | null; para: string | null }
  interacao_id?: string
  erro?: string
  tokens?: number
  /** Só na simulação: o que o modelo respondeu em cada tentativa, para conferir a leitura antes de gravar. */
  bruto?: string[]
  /** Bloco C: o pedido lido num "aceitou" (fechado ou não) ou o motivo de a leitura ter falhado. */
  pedido?: PedidoExtraido | { falhou: string }
}

interface Contadores {
  segmentos_prontos: number
  analisados: number
  gravados: number
  falhas: number
  travados: number
  adiados: number
  descartados: number
}

async function lerFila(
  admin: SupabaseClient,
  reprocessar: { contatos: string[]; desde: string } | null,
): Promise<MensagemPendente[]> {
  // Simulação de releitura: as conversas desses contatos, já analisadas ou não.
  if (reprocessar) {
    const { data, error } = await admin
      .from('mensagens_whatsapp')
      .select('message_id, contato_id, direcao, conteudo, tipo_midia, enviada_em, analise_falhas')
      .in('contato_id', reprocessar.contatos)
      .gte('enviada_em', reprocessar.desde)
      .eq('historico', false)
      .neq('tipo_midia', 'template_empresa')
      .order('enviada_em', { ascending: true })
      .limit(2000)
      .returns<MensagemPendente[]>()
    if (error) throw new Error(`Falha ao reler conversas: ${error.message}`)
    return data ?? []
  }

  const { data, error } = await admin
    .from('mensagens_whatsapp')
    .select('message_id, contato_id, direcao, conteudo, tipo_midia, enviada_em, analise_falhas')
    .is('processado_em', null)
    .eq('historico', false)
    .is('analise_travada_em', null)
    .not('contato_id', 'is', null)
    .neq('tipo_midia', 'template_empresa')
    .order('enviada_em', { ascending: true })
    .limit(2000)
    .returns<MensagemPendente[]>()
  if (error) throw new Error(`Falha ao ler a fila: ${error.message}`)
  return data ?? []
}

async function registrarFalha(admin: SupabaseClient, seg: Segmento, erro: string): Promise<boolean> {
  const { data, error } = await admin.rpc('rpc_analista_registrar_falha', {
    p_message_ids: seg.messageIds,
    p_erro: erro,
    p_limite: LIMITE_FALHAS,
  })
  if (error) throw new Error(`Falha ao registrar falha do segmento: ${error.message}`)
  return Boolean((data as { travado?: boolean } | null)?.travado)
}

async function rodar(
  admin: SupabaseClient,
  chave: string,
  opcoes: { simular: boolean; limite: number; contatos: string[] | null; reprocessarDesde: string | null },
  detalhes: Detalhe[],
  cont: Contadores,
): Promise<{ status: 'ok' | 'parcial' | 'limite_groq'; aviso: string | null }> {
  const inicio = Date.now()
  const filtro = opcoes.contatos ? new Set(opcoes.contatos) : null
  const reprocessar = opcoes.reprocessarDesde && opcoes.contatos
    ? { contatos: opcoes.contatos, desde: opcoes.reprocessarDesde }
    : null
  const segmentos = segmentar(await lerFila(admin, reprocessar), { agoraMs: inicio })
    .filter((s) => !filtro || filtro.has(s.contatoId))
  cont.segmentos_prontos = segmentos.length

  // Nome e arquivamento de TODOS os contatos da fila: o descarte não espera o limite.
  const ids = [...new Set(segmentos.map((s) => s.contatoId))]
  const nomes = new Map<string, string | null>()
  const arquivados = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await admin.from('contatos').select('id, nome, arquivado_em').in('id', ids.slice(i, i + 100))
    if (error) throw new Error(`Falha ao ler contatos: ${error.message}`)
    for (const c of data ?? []) {
      nomes.set(c.id, c.nome)
      if (c.arquivado_em) arquivados.add(c.id)
    }
  }

  const ritmo = new Ritmo()
  // Segmento que falhou ou foi adiado segura os seguintes do MESMO contato: a timeline e
  // o card têm que andar na ordem em que a conversa aconteceu.
  const bloqueados = new Set<string>()
  // Na simulação, a coluna "depois" de um segmento é a "antes" do próximo do mesmo contato.
  const colunaSimulada = new Map<string, string | null>()
  let tentados = 0

  for (const seg of segmentos) {
    const base: Detalhe = {
      contato_id: seg.contatoId,
      nome: nomes.get(seg.contatoId) ?? null,
      inicio: seg.inicio,
      fim: seg.fim,
      mensagens: seg.messageIds.length,
      sentido: seg.sentido,
      situacao: 'adiado',
    }
    if (bloqueados.has(seg.contatoId)) {
      detalhes.push({ ...base, erro: 'segmento anterior do mesmo contato não foi registrado nesta rodada' })
      cont.adiados++
      continue
    }

    // Sem nota e sem card: contato arquivado, ou cliente que só mandou mídia sem texto.
    // Não conta no limite da rodada (não chama o LLM).
    const descarte = motivoDescarte(seg, arquivados.has(seg.contatoId))
    if (descarte) {
      if (!opcoes.simular) {
        const { error } = await admin.rpc('rpc_analista_descartar', {
          p_contato_id: seg.contatoId,
          p_message_ids: seg.messageIds,
          p_motivo: descarte,
        })
        if (error) {
          const travado = await registrarFalha(admin, seg, `descarte: ${error.message}`)
          detalhes.push({ ...base, situacao: travado ? 'travado' : 'falha', erro: `descarte: ${error.message}` })
          cont.falhas++
          if (travado) cont.travados++
          bloqueados.add(seg.contatoId)
          continue
        }
      }
      detalhes.push({ ...base, situacao: 'descartado', descarte })
      cont.descartados++
      continue
    }

    if (tentados >= opcoes.limite) break
    if (Date.now() - inicio > ORCAMENTO_MS) {
      return { status: 'parcial', aviso: `Tempo da rodada esgotado depois de ${tentados} segmentos; o resto fica para a próxima.` }
    }
    tentados++

    const conversa: Mensagem[] = [
      { role: 'system', content: PROMPT_SISTEMA },
      { role: 'user', content: montarPromptUsuario(seg, base.nome) },
    ]

    let veredito: Veredito | null = null
    let motivo = ''
    let tokens = 0
    let tentativas = 0
    const bruto: string[] = []
    // Erro só na frase, na saúde ou na data: a correção mantém o resultado da 1ª resposta.
    let manterResultado: string | undefined

    for (tentativas = 1; tentativas <= 2 && !veredito; tentativas++) {
      const estimativa = Math.ceil(conversa.reduce((n, m) => n + m.content.length, 0) / 3) + MAX_COMPLETION
      const espera = ritmo.espera(estimativa)
      if (espera > ESPERA_MAXIMA_MS || Date.now() - inicio + espera > ORCAMENTO_MS) {
        detalhes.push({ ...base, erro: `limite de tokens por minuto: esperaria ${Math.round(espera / 1000)}s` })
        cont.adiados++
        return { status: 'parcial', aviso: 'Limite de tokens por minuto do Groq; o resto fica para a próxima rodada.' }
      }
      if (espera > 0) await dormir(espera)

      const r = await chamarGroq(chave, conversa, ritmo)
      if (r.tipo === 'limite') {
        detalhes.push({ ...base, erro: r.aviso })
        cont.adiados++
        return { status: 'limite_groq', aviso: `${r.aviso}. Rodada encerrada; os segmentos restantes ficam para a próxima.` }
      }
      if (r.tipo === 'transitorio') {
        motivo = r.erro
        break
      }
      if (r.tipo === 'invalido') {
        motivo = r.motivo
      } else {
        tokens += r.tokens
        bruto.push(r.conteudo)
        const v = validarVeredito(r.conteudo, seg, { manterResultado })
        if (v.ok) {
          veredito = v.veredito
          break
        }
        motivo = v.motivo
        manterResultado = v.manterResultado
        conversa.push({ role: 'assistant', content: r.conteudo })
      }
      const manter = manterResultado ? ` Mantenha "resultado": "${manterResultado}".` : ''
      conversa.push({ role: 'user', content: `Resposta inválida: ${motivo}.${manter} Responda de novo, só com o objeto JSON.` })
    }
    tentativas = Math.min(tentativas, 2)

    if (!veredito) {
      // Erro de rede/5xx não é culpa do segmento: adia sem contar falha.
      if (motivo.startsWith('rede:') || motivo.startsWith('Groq HTTP') || motivo.startsWith('Groq devolveu')) {
        detalhes.push({ ...base, tentativas, erro: motivo, tokens })
        cont.adiados++
        bloqueados.add(seg.contatoId)
        continue
      }
      const erro = `veredito inválido após 2 tentativas: ${motivo}`
      const travado = opcoes.simular ? false : await registrarFalha(admin, seg, erro)
      detalhes.push({ ...base, situacao: travado ? 'travado' : 'falha', tentativas, erro, tokens, ...(opcoes.simular ? { bruto } : {}) })
      cont.falhas++
      if (travado) cont.travados++
      bloqueados.add(seg.contatoId)
      continue
    }

    cont.analisados++

    if (opcoes.simular) {
      const { data, error } = await admin.rpc('rpc_analista_previa', {
        p_contato_id: seg.contatoId,
        p_sentido: seg.sentido,
        p_resultado: veredito.resultado,
        p_coluna_simulada: colunaSimulada.get(seg.contatoId) ?? null,
      })
      if (error) throw new Error(`Falha na prévia: ${error.message}`)
      const p = data as { aba: string; coluna_antes: string; destino: string | null } | null
      colunaSimulada.set(seg.contatoId, p?.destino ?? p?.coluna_antes ?? null)
      const lido = veredito.resultado === 'aceitou' ? await extrairPedido(chave, seg, base.nome, ritmo) : null
      detalhes.push({
        ...base, situacao: 'simulado', tentativas, veredito, tokens, bruto,
        ...(lido ? { pedido: 'pedido' in lido ? lido.pedido : lido } : {}),
        movimento: { aba: p?.aba ?? null, de: p?.coluna_antes ?? null, para: p?.destino ?? null },
      })
      continue
    }

    const { data, error } = await admin.rpc('rpc_registrar_interacao_ia', {
      p_contato_id: seg.contatoId,
      p_payload: {
        tipo: veredito.tipo,
        resultado: veredito.resultado,
        observacao: veredito.observacao,
        trecho_cliente: veredito.trechoCliente,
        retomar_em: veredito.retomarEm,
      },
      p_message_ids: seg.messageIds,
    })
    if (error) {
      const erro = `RPC: ${error.message}`
      const travado = await registrarFalha(admin, seg, erro)
      detalhes.push({ ...base, situacao: travado ? 'travado' : 'falha', tentativas, veredito, erro, tokens })
      cont.falhas++
      if (travado) cont.travados++
      bloqueados.add(seg.contatoId)
      continue
    }

    const g = data as {
      ja_processada?: boolean; interacao_id?: string; aba?: string; coluna_antes?: string; coluna_depois?: string
    }
    if (g.ja_processada) {
      detalhes.push({ ...base, situacao: 'ja_processado', tentativas, veredito, tokens })
      continue
    }
    cont.gravados++

    // Bloco C: "aceitou" → lê o pedido. Fechado pelo critério → pedidos_conversa (a conferência
    // procura a venda). Leitura que falhou também entra, como 'falhou': o analista disse
    // "aceitou", e melhor conferir à toa que perder um pedido sem venda.
    let pedidoLido: PedidoExtraido | { falhou: string } | undefined
    if (veredito.resultado === 'aceitou') {
      const lido = await extrairPedido(chave, seg, base.nome, ritmo)
      pedidoLido = 'pedido' in lido ? lido.pedido : lido
      const ultimaDoCliente = [...seg.mensagens].reverse().find((m) => m.de === 'cliente')?.em ?? seg.fim
      const linha = 'pedido' in lido
        ? (lido.pedido.fechado
          ? {
            fechado_em: lido.pedido.fechadoEm, itens: lido.pedido.itens, forma_pagamento: lido.pedido.formaPagamento,
            entrega: lido.pedido.entrega, total_citado: lido.pedido.totalCitado, confirmacao: lido.pedido.confirmacao,
            faltam_sabores: lido.pedido.faltamSabores, trecho: lido.pedido.trecho, extracao: 'ok',
          }
          : null)
        : {
          fechado_em: ultimaDoCliente, itens: [], forma_pagamento: null, entrega: null, total_citado: null,
          confirmacao: 'nenhuma', faltam_sabores: false, trecho: veredito.trechoCliente?.slice(0, 150) ?? null, extracao: 'falhou',
        }
      if (linha) {
        const { error: erroPedido } = await admin.from('pedidos_conversa').upsert(
          { ...linha, contato_id: seg.contatoId, interacao_id: g.interacao_id ?? null, message_ids: seg.messageIds },
          { onConflict: 'interacao_id', ignoreDuplicates: true },
        )
        if (erroPedido) console.error('[whatsapp-analista] falha ao gravar pedidos_conversa', erroPedido.message)
      }
    }

    detalhes.push({
      ...base, situacao: 'gravado', tentativas, veredito, tokens, interacao_id: g.interacao_id,
      ...(pedidoLido ? { pedido: pedidoLido } : {}),
      movimento: {
        aba: g.aba ?? null,
        de: g.coluna_antes ?? null,
        para: g.coluna_depois !== g.coluna_antes ? (g.coluna_depois ?? null) : null,
      },
    })
  }

  const parcial = cont.falhas > 0 || cont.adiados > 0
  return {
    status: parcial ? 'parcial' : 'ok',
    aviso: parcial ? `${cont.falhas} falha(s), ${cont.adiados} adiado(s); ver detalhes.` : null,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const cron = Deno.env.get('CRON_SECRET')
  const ingestor = Deno.env.get('INGESTOR_SECRET')
  const viaCron = !!cron && req.headers.get('x-cron-secret') === cron
  const viaManual = !!ingestor && req.headers.get('x-ingestor-secret') === ingestor
  if (!viaCron && !viaManual) return json({ error: 'Não autorizado' }, 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  if (body.acao !== 'rodar') return json({ error: "acao deve ser 'rodar'" }, 400)

  const simular = body.simular === true
  const pedido = Number(body.limite ?? LIMITE_CRON)
  const limite = Number.isInteger(pedido) && pedido > 0 ? Math.min(pedido, LIMITE_MAXIMO) : LIMITE_CRON
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const contatos = Array.isArray(body.contatos) ? body.contatos.filter((c): c is string => typeof c === 'string' && uuid.test(c)) : null
  if (contatos && !simular) return json({ error: 'contatos só vale com simular' }, 400)
  const reprocessarDesde = typeof body.reprocessar_desde === 'string' && !Number.isNaN(Date.parse(body.reprocessar_desde))
    ? new Date(body.reprocessar_desde).toISOString()
    : null
  if (reprocessarDesde && (!simular || !contatos?.length)) {
    return json({ error: 'reprocessar_desde só vale com simular e contatos' }, 400)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Rodada que morreu no meio (timeout da função) não fica "rodando" para sempre.
  await admin
    .from('wa_analista_rodadas')
    .update({ status: 'erro', terminada_em: new Date().toISOString(), aviso: 'Rodada interrompida (a função caiu ou estourou o tempo).' })
    .eq('status', 'rodando')
    .lt('iniciada_em', new Date(Date.now() - 10 * 60_000).toISOString())

  if (!simular) {
    const { data: emAndamento } = await admin
      .from('wa_analista_rodadas')
      .select('id')
      .eq('status', 'rodando')
      .eq('simulacao', false)
      .limit(1)
    if (emAndamento && emAndamento.length > 0) {
      return json({ ok: false, motivo: 'outra rodada em andamento', rodada: emAndamento[0].id }, 409)
    }
  }

  const { data: rodada, error: erroRodada } = await admin
    .from('wa_analista_rodadas')
    .insert({ origem: viaCron ? 'cron' : 'manual', simulacao: simular, modelo: MODELO })
    .select('id')
    .single()
  if (erroRodada || !rodada) return json({ error: `Falha ao abrir a rodada: ${erroRodada?.message}` }, 500)

  const detalhes: Detalhe[] = []
  const cont: Contadores = { segmentos_prontos: 0, analisados: 0, gravados: 0, falhas: 0, travados: 0, adiados: 0, descartados: 0 }
  let status: 'ok' | 'parcial' | 'limite_groq' | 'erro'
  let aviso: string | null

  try {
    const chave = Deno.env.get('GROQ_API_KEY')
    if (!chave) throw new Error('GROQ_API_KEY ausente nos secrets da função')
    ;({ status, aviso } = await rodar(admin, chave, { simular, limite, contatos, reprocessarDesde }, detalhes, cont))
  } catch (e) {
    console.error('[whatsapp-analista]', e)
    status = 'erro'
    aviso = (e as Error).message
  }

  const { error: erroFim } = await admin
    .from('wa_analista_rodadas')
    .update({ ...cont, status, aviso, detalhes, terminada_em: new Date().toISOString() })
    .eq('id', rodada.id)
  if (erroFim) console.error('[whatsapp-analista] falha ao fechar a rodada', erroFim)

  const http = status === 'erro' ? 500 : status === 'limite_groq' ? 429 : 200
  return json({ ok: status !== 'erro', rodada: rodada.id, status, aviso, simulacao: simular, ...cont, detalhes }, http)
})
