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
// no segmento (5 falhas → travado, sai da fila); exceção marca a rodada como `erro` e devolve 500.
//
// LLM (31/10/2026, Black): uma conversa por vez, espaçadas pelo plano (tokens e pedidos por
// minuto). No 429, vale o retry-after; até 3 tentativas no Groq. Falhou 3 vezes → a MESMA
// chamada (mesmo prompt) vai à Cerebras (gpt-oss-120b), também até 3 vezes, se houver
// CEREBRAS_API_KEY. As duas falharam → a conversa fica na fila (só é marcada analisada
// depois de gravada), a rodada para e sai um alerta só para o Luccas (alertas_operacao).
//
// Autenticação: x-cron-secret == CRON_SECRET (pg_cron, segredo no vault
// `meta_capi_cron_secret`) OU x-ingestor-secret == INGESTOR_SECRET (chamada manual).
//
// Segredos: GROQ_API_KEY, CEREBRAS_API_KEY (reserva, opcional), CRON_SECRET, INGESTOR_SECRET;
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY vêm do runtime.

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
import {
  esperaParaChamar,
  lerDuracaoMs,
  lerRetryAfterMs,
  type ChamadaRegistrada,
  type PlanoLlm,
} from '../../../packages/shared/src/ritmoLlm.ts'

const MODELO = 'openai/gpt-oss-20b'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
/** Reserva: Cerebras, API compatível com a da OpenAI. */
const CEREBRAS_URL = 'https://api.cerebras.ai/v1/chat/completions'
const MODELO_CEREBRAS = 'gpt-oss-120b'
/** Tentativas por provedor antes de passar para o próximo. */
const TENTATIVAS_POR_PROVEDOR = 3
/**
 * Leitura do pedido num "aceitou" (bloco C). Desligada em 31/10/2026: atendimento e
 * lançamento são humanos, e a leitura dobrava as chamadas ao Groq. Religar:
 * `npx supabase secrets set ANALISTA_LER_PEDIDO=true`.
 */
const LER_PEDIDO = Deno.env.get('ANALISTA_LER_PEDIDO')?.trim().toLowerCase() === 'true'
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

// ── LLM: Groq, com a Cerebras de reserva ───────────────────────────────────────

type Mensagem = { role: 'system' | 'user' | 'assistant'; content: string }

interface Provedor {
  nome: 'groq' | 'cerebras'
  url: string
  modelo: string
  chave: string
  plano: PlanoLlm
  maxCompletion: number
}

/** Uma chamada. `limite` traz o retry-after (ms) quando o provedor mandou. */
type RespostaChamada =
  | { tipo: 'ok'; conteudo: string; tokens: number }
  | { tipo: 'invalido'; motivo: string }
  | { tipo: 'limite'; erro: string; retryMs: number | null }
  | { tipo: 'transitorio'; erro: string }

/** O pedido inteiro, já com as tentativas e a reserva. */
type RespostaLlm =
  | { tipo: 'ok'; conteudo: string; tokens: number; provedor: Provedor['nome'] }
  | { tipo: 'invalido'; motivo: string }
  /** Ia passar do orçamento da rodada: fica para a próxima, sem alerta. */
  | { tipo: 'sem_tempo'; aviso: string }
  /** Os provedores falharam todas as tentativas: fica para a próxima, com alerta. */
  | { tipo: 'esgotado'; erro: string }

const estimarTokens = (mensagens: Mensagem[], maxCompletion: number) =>
  Math.ceil(mensagens.reduce((n, m) => n + m.content.length, 0) / 3) + maxCompletion

async function chamar(p: Provedor, mensagens: Mensagem[], estado: EstadoProvedor): Promise<RespostaChamada> {
  let res: Response
  try {
    res = await fetch(p.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: p.modelo,
        messages: mensagens,
        response_format: { type: 'json_object' },
        reasoning_effort: 'low',
        max_completion_tokens: p.maxCompletion,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    return { tipo: 'transitorio', erro: `${p.nome} rede: ${(e as Error).message}` }
  }

  // Balde de tokens informado pelo provedor (o Groq manda; a Cerebras pode não mandar).
  const restantes = Number(res.headers.get('x-ratelimit-remaining-tokens'))
  const reset = lerDuracaoMs(res.headers.get('x-ratelimit-reset-tokens'))
  if (Number.isFinite(restantes) && res.headers.has('x-ratelimit-remaining-tokens')) {
    estado.restantes = restantes
    estado.resetEm = reset !== null ? Date.now() + reset : estado.resetEm
  }
  const corpo = await res.text()

  if (res.status === 429) {
    const porDia = res.headers.get('x-ratelimit-remaining-requests') === '0'
    return {
      tipo: 'limite',
      erro: `${p.nome} 429 (${porDia ? 'pedidos por dia' : 'tokens por minuto'}): ${corpo.slice(0, 200)}`,
      retryMs: lerRetryAfterMs(res.headers.get('retry-after')),
    }
  }
  // json_object: quando o modelo não produz JSON válido o Groq devolve 400 json_validate_failed.
  // Outro 400 (parâmetro recusado, por exemplo) é falha do provedor, não da conversa.
  if (res.status === 400 && corpo.includes('json_validate_failed')) {
    return { tipo: 'invalido', motivo: 'o modelo não produziu JSON válido' }
  }
  if (!res.ok) return { tipo: 'transitorio', erro: `${p.nome} HTTP ${res.status}: ${corpo.slice(0, 200)}` }

  try {
    const dados = JSON.parse(corpo)
    const escolha = dados?.choices?.[0]
    if (escolha?.finish_reason === 'length') return { tipo: 'invalido', motivo: 'resposta cortada no limite de tokens' }
    return { tipo: 'ok', conteudo: String(escolha?.message?.content ?? ''), tokens: Number(dados?.usage?.total_tokens ?? 0) }
  } catch {
    return { tipo: 'transitorio', erro: `${p.nome} devolveu corpo ilegível: ${corpo.slice(0, 200)}` }
  }
}

interface EstadoProvedor {
  historico: ChamadaRegistrada[]
  /** Não chamar antes disso (retry-after, ou o balde de tokens vazio). */
  bloqueadoAte: number
  restantes: number | null
  resetEm: number
  /** Desistiu deste provedor nesta rodada (limite do dia, ou 3 falhas). */
  fora: boolean
}

class Llm {
  private estados = new Map<Provedor['nome'], EstadoProvedor>()
  /** Algum pedido esgotou os provedores nesta rodada: o Luccas é avisado. */
  ultimoEsgotado: string | null = null

  constructor(private provedores: Provedor[], private prazo: number) {
    for (const p of provedores) {
      this.estados.set(p.nome, { historico: [], bloqueadoAte: 0, restantes: null, resetEm: 0, fora: false })
    }
  }

  /** Provedores configurados, na ordem (Groq, depois a reserva se houver chave). */
  get nomes(): string[] {
    return this.provedores.map((p) => p.nome)
  }

  async pedir(mensagens: Mensagem[]): Promise<RespostaLlm> {
    const erros: string[] = []
    for (const p of this.provedores) {
      const e = this.estados.get(p.nome)!
      if (e.fora) continue
      let falhas = 0
      while (falhas < TENTATIVAS_POR_PROVEDOR) {
        const estimativa = estimarTokens(mensagens, p.maxCompletion)
        const agora = Date.now()
        // Ritmo próprio (orçamento do minuto, intervalo, balde do provedor): espera o que for
        // preciso dentro da rodada — não é falha. Só o retry-after LONGO de um 429 (limite do
        // dia, por exemplo) tira o provedor da rodada e passa para a reserva.
        const pelaConta = esperaParaChamar(e.historico, agora, estimativa, p.plano)
        const peloBalde = e.restantes !== null && e.restantes < estimativa ? Math.max(0, e.resetEm - agora) + 250 : 0
        const peloBloqueio = e.bloqueadoAte - agora
        if (peloBloqueio > ESPERA_MAXIMA_MS) {
          erros.push(`${p.nome}: retry-after de ${Math.round(peloBloqueio / 1000)}s`)
          e.fora = true
          break
        }
        const espera = Math.max(pelaConta, peloBalde, peloBloqueio, 0)
        if (agora + espera > this.prazo) {
          return { tipo: 'sem_tempo', aviso: `tempo da rodada esgotado (esperaria ${Math.round(espera / 1000)}s)` }
        }
        if (espera > 0) await dormir(espera)

        const r = await chamar(p, mensagens, e)
        e.historico.push({ em: Date.now(), tokens: r.tipo === 'ok' && r.tokens > 0 ? r.tokens : estimativa })
        if (r.tipo === 'ok') return { ...r, provedor: p.nome }
        if (r.tipo === 'invalido') return r

        falhas++
        erros.push(r.erro)
        if (r.tipo === 'limite') {
          // Sem retry-after, espera 10 s; retry-after longo tira o provedor da rodada (acima).
          e.bloqueadoAte = Date.now() + (r.retryMs ?? 10_000)
        } else {
          e.bloqueadoAte = Date.now() + 2_000 * falhas
        }
      }
      if (falhas >= TENTATIVAS_POR_PROVEDOR) e.fora = true
    }
    const erro = erros.length ? erros.slice(-4).join(' | ') : 'nenhum provedor disponível'
    this.ultimoEsgotado = erro
    return { tipo: 'esgotado', erro }
  }
}

// ── Pedido fechado (bloco C) ────────────────────────────────────────────────────

/**
 * Segundo passo, só num "aceitou": lê o pedido com o prompt da conferência. Não mexe no
 * veredito nem na timeline; falha aqui nunca derruba o segmento.
 */
/**
 * Leitura do pedido: lido, falhou de verdade (o modelo não deu JSON válido 2 vezes) ou
 * ADIADA — faltou tempo na rodada ou LLM. Adiada, a conversa inteira volta para a fila: nada
 * é gravado, nem o veredito, para não perder o pedido numa leitura incompleta.
 */
type LeituraPedido =
  | { pedido: PedidoExtraido }
  | { falhou: string }
  | { adiar: 'sem_tempo' | 'esgotado'; motivo: string }

async function extrairPedido(
  llm: Llm,
  seg: Segmento,
  nome: string | null,
): Promise<LeituraPedido> {
  const conversa: Mensagem[] = [
    { role: 'system', content: PROMPT_PEDIDO },
    { role: 'user', content: montarPromptUsuario(seg, nome) },
  ]
  let motivo = 'sem resposta'
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const r = await llm.pedir(conversa)
    if (r.tipo === 'sem_tempo') return { adiar: 'sem_tempo', motivo: r.aviso }
    if (r.tipo === 'esgotado') return { adiar: 'esgotado', motivo: r.erro }
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
  /** Qual LLM respondeu (groq, ou cerebras como reserva). */
  provedor?: string
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
  llm: Llm,
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
    let provedor: string | undefined

    for (tentativas = 1; tentativas <= 2 && !veredito; tentativas++) {
      const r = await llm.pedir(conversa)
      if (r.tipo === 'sem_tempo') {
        detalhes.push({ ...base, erro: r.aviso })
        cont.adiados++
        return { status: 'parcial', aviso: `${r.aviso}; o resto fica para a próxima rodada.` }
      }
      if (r.tipo === 'esgotado') {
        // Os provedores falharam todas as tentativas: a conversa fica na fila (não foi marcada),
        // a rodada para, e o Luccas é avisado no fim.
        detalhes.push({ ...base, erro: `LLM indisponível: ${r.erro}` })
        cont.adiados++
        return { status: 'limite_groq', aviso: `LLM indisponível (${llm.nomes.join(' e ')}): ${r.erro}. As conversas ficam na fila.` }
      }
      if (r.tipo === 'invalido') {
        motivo = r.motivo
      } else {
        provedor = r.provedor
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
      const lido = LER_PEDIDO && veredito.resultado === 'aceitou' ? await extrairPedido(llm, seg, base.nome) : null
      if (lido && 'adiar' in lido) {
        detalhes.push({ ...base, tentativas, veredito, tokens, provedor, erro: `leitura do pedido adiada: ${lido.motivo}` })
        cont.adiados++
        return { status: 'parcial', aviso: `${lido.motivo}; o resto fica para a próxima rodada.` }
      }
      detalhes.push({
        ...base, situacao: 'simulado', tentativas, veredito, tokens, bruto, provedor,
        ...(lido ? { pedido: 'pedido' in lido ? lido.pedido : { falhou: lido.falhou } } : {}),
        movimento: { aba: p?.aba ?? null, de: p?.coluna_antes ?? null, para: p?.destino ?? null },
      })
      continue
    }

    // Bloco C: num "aceitou" o pedido é lido ANTES de gravar. Sem tempo ou sem LLM, a conversa
    // inteira volta para a fila (nem o veredito é gravado) — só se marca analisada no sucesso.
    const lido = LER_PEDIDO && veredito.resultado === 'aceitou' ? await extrairPedido(llm, seg, base.nome) : null
    if (lido && 'adiar' in lido) {
      detalhes.push({ ...base, tentativas, veredito, tokens, provedor, erro: `leitura do pedido adiada: ${lido.motivo}` })
      cont.adiados++
      return lido.adiar === 'esgotado'
        ? { status: 'limite_groq', aviso: `LLM indisponível (${llm.nomes.join(' e ')}): ${lido.motivo}. As conversas ficam na fila.` }
        : { status: 'parcial', aviso: `${lido.motivo}; o resto fica para a próxima rodada.` }
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
    if (lido) {
      pedidoLido = 'pedido' in lido ? lido.pedido : { falhou: lido.falhou }
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
      ...base, situacao: 'gravado', tentativas, veredito, tokens, provedor, interacao_id: g.interacao_id,
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

/**
 * Os provedores de LLM falharam todas as tentativas: alerta só para o Luccas. Um por hora
 * (ref com a hora de SP), para uma queda longa não virar uma mensagem a cada 15 min.
 * A conferência (W7) é quem manda, no horário dela.
 */
async function avisarLuccasLlm(admin: SupabaseClient, llm: Llm, cont: Contadores) {
  const agora = new Date()
  const hora = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  }).format(agora)
  const naFila = Math.max(cont.segmentos_prontos - cont.gravados - cont.descartados, 1)
  const texto = [
    '⚠️ *Analista sem LLM*',
    `${llm.nomes.join(' e ')} falharam ${TENTATIVAS_POR_PROVEDOR} vezes cada às ${hora.slice(11, 13)}h. ${naFila} conversa(s) ficaram na fila para a próxima rodada.`,
    `Último erro: ${(llm.ultimoEsgotado ?? '').slice(0, 180)}`,
  ].join('\n')
  const { error } = await admin.from('alertas_operacao').upsert(
    { tipo: 'analista_llm', ref: `analista_llm:${hora}`, destino: 'luccas', vence_em: agora.toISOString(), texto },
    { onConflict: 'tipo,ref', ignoreDuplicates: true },
  )
  if (error) console.error('[whatsapp-analista] falha ao registrar o alerta de LLM', error.message)
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
    const provedores: Provedor[] = [{
      // Plano gratuito do gpt-oss-20b: 30 pedidos e 8K tokens por minuto.
      nome: 'groq', url: GROQ_URL, modelo: MODELO, chave,
      plano: { tpm: Number(Deno.env.get('GROQ_TPM') ?? 8000), intervaloMinMs: 2_100 },
      maxCompletion: MAX_COMPLETION,
    }]
    const reserva = Deno.env.get('CEREBRAS_API_KEY')
    if (reserva) {
      provedores.push({
        // Plano gratuito do gpt-oss-120b: 5 pedidos e 30K tokens por minuto. O 120b raciocina
        // mais: teto de saída maior.
        nome: 'cerebras', url: CEREBRAS_URL, modelo: MODELO_CEREBRAS, chave: reserva,
        plano: { tpm: Number(Deno.env.get('CEREBRAS_TPM') ?? 30000), intervaloMinMs: 12_500 },
        maxCompletion: 800,
      })
    }
    const llm = new Llm(provedores, Date.now() + ORCAMENTO_MS)
    ;({ status, aviso } = await rodar(admin, llm, { simular, limite, contatos, reprocessarDesde }, detalhes, cont))
    if (llm.ultimoEsgotado && !simular) await avisarLuccasLlm(admin, llm, cont)
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
