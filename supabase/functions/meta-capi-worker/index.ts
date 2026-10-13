// Edge Function: meta-capi-worker
// Flush diário da outbox `meta_eventos` → Meta Conversions API (offline events).
// Blueprint §4. Lead + Purchase por match de telefone/hash (+ ctwa_clid quando há).
//
// O CANAL (`action_source`) é decidido AQUI, não no trigger — ver `metaCapi.ts`. Sem WABA
// tudo vai `physical_store`; com WABA e clid vai `business_messaging`, e se a Meta recusar
// de forma definitiva o mesmo evento é reenviado como `physical_store` na hora. O canal
// aceito é gravado de volta em `meta_eventos.action_source`.
//
// Invocação: cron (pg_cron + pg_net) 1x/dia, OU manual para teste. Protegida por header
//   x-cron-secret == env CRON_SECRET. Usa service_role internamente (lê/escreve meta_eventos,
//   que tem RLS service_role-only para escrita).
//
// Segredos (supabase secrets set …), NUNCA no banco/cliente:
//   META_CAPI_ACCESS_TOKEN  — token da CAPI gerado no Events Manager
//   META_DATASET_ID         — id do dataset/pixel (default 1689731802148035)
//   META_TEST_EVENT_CODE    — opcional; quando setado, envia em modo Test Events E exige
//                             `{"event_ids": [...]}` no corpo (sem isso responde 409 e não
//                             toca na fila — senão vendas reais iriam pro Test Events e
//                             nunca chegariam à produção)
//   META_WABA_ID            — opcional; id da conta WhatsApp Business (API oficial). Sem
//                             ele, nada sai como `business_messaging`
//   CRON_SECRET             — segredo compartilhado que autoriza a invocação
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — injetados pelo runtime

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  splitName,
  normalizeCity,
  normalizeState,
  normalizeZip,
  hashField,
} from '../../../packages/shared/src/metaNormalize.ts'
import {
  escolherCanal,
  montarEvento,
  erroTransitorio,
  lerEventIds,
  type CanalMeta,
  type EventoMeta,
  type UserDataBase,
} from '../../../packages/shared/src/metaCapi.ts'
// `normalizePhone` mora em whatsapp.ts porque depende da forma canônica do WhatsApp:
// a Meta só casa a pessoa se o telefone for hasheado no formato que o aparelho usa.
import { normalizePhone } from '../../../packages/shared/src/whatsapp.ts'

const GRAPH_VERSION = 'v21.0'
const MAX_TENTATIVAS = 5
const BATCH_LIMIT = 500

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Tipos das linhas lidas ─────────────────────────────────────────────────────

interface ContatoMatch {
  id: string
  telefone: string | null
  nome: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  ctwa_clid: string | null
}

interface EventoRow {
  id: string
  evento: string
  event_id: string
  event_time: string
  valor: number | null
  moeda: string
  ctwa_clid: string | null
  tentativas: number
  contato: ContatoMatch | null
}

/** Chaves de match hasheadas. O clid (cru) e o WABA entram em `montarEvento`. */
async function buildUserData(ev: EventoRow): Promise<UserDataBase> {
  const c = ev.contato
  const ud: UserDataBase = {}
  if (!c) return ud

  const { fn, ln } = splitName(c.nome)
  ud.ph = await hashField(normalizePhone(c.telefone))
  ud.fn = await hashField(fn)
  ud.ln = await hashField(ln)
  ud.ct = await hashField(normalizeCity(c.cidade))
  ud.st = await hashField(normalizeState(c.uf))
  ud.zip = await hashField(normalizeZip(c.cep))
  ud.external_id = await hashField(c.id)

  return ud
}

// ── Envio ──────────────────────────────────────────────────────────────────────

interface RespostaMeta {
  /** `null` quando a requisição nem completou (rede, corpo não-JSON). */
  status: number | null
  ok: boolean
  corpo: unknown
}

async function enviar(
  endpoint: string,
  evento: EventoMeta,
  accessToken: string,
  testEventCode: string | undefined,
): Promise<RespostaMeta> {
  const payload: Record<string, unknown> = { data: [evento], access_token: accessToken }
  if (testEventCode) payload.test_event_code = testEventCode

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { status: res.status, ok: res.ok, corpo: await res.json() }
  } catch (e) {
    return { status: null, ok: false, corpo: { erro: e instanceof Error ? e.message : String(e) } }
  }
}

/** O que se guarda de um sucesso — o resto da resposta não serve pra auditoria. */
function resumoSucesso(corpo: unknown): { fbtrace_id: unknown; events_received: unknown } {
  if (typeof corpo !== 'object' || corpo === null) return { fbtrace_id: null, events_received: null }
  return {
    fbtrace_id: 'fbtrace_id' in corpo ? corpo.fbtrace_id : null,
    events_received: 'events_received' in corpo ? corpo.events_received : null,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'Não autorizado' }, 401)
  }

  const accessToken = Deno.env.get('META_CAPI_ACCESS_TOKEN')
  const datasetId = Deno.env.get('META_DATASET_ID') ?? '1689731802148035'
  const testEventCode = Deno.env.get('META_TEST_EVENT_CODE') || undefined
  const wabaId = Deno.env.get('META_WABA_ID') || null
  if (!accessToken) return json({ error: 'META_CAPI_ACCESS_TOKEN ausente' }, 500)

  // O cron manda `{}`; a rodada de teste manda `{"event_ids": [...]}`.
  let corpo: unknown = null
  try {
    corpo = await req.json()
  } catch {
    corpo = null
  }
  const eventIds = lerEventIds(corpo)
  if (testEventCode && !eventIds) {
    return json(
      { error: 'META_TEST_EVENT_CODE setado: informe {"event_ids": [...]} — a fila real não roda em modo teste' },
      409,
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // Pendentes + erros ainda dentro do limite de tentativas. O filtro de event_ids só
  // estreita: um evento já `enviado` nunca é reenviado, nem pedindo pelo id.
  let consulta = admin
    .from('meta_eventos')
    .select(`
      id, evento, event_id, event_time, valor, moeda, ctwa_clid, tentativas,
      contato:contatos ( id, telefone, nome, cidade, uf, cep, ctwa_clid )
    `)
    .or(`status.eq.pendente,and(status.eq.erro,tentativas.lt.${MAX_TENTATIVAS})`)
  if (eventIds) consulta = consulta.in('event_id', eventIds)

  const { data: eventos, error: readErr } = await consulta
    .order('criado_em', { ascending: true })
    .limit(BATCH_LIMIT)
    .returns<EventoRow[]>()

  if (readErr) return json({ error: `Falha ao ler outbox: ${readErr.message}` }, 500)
  if (!eventos || eventos.length === 0) {
    return json({ ok: true, processados: 0, test_mode: !!testEventCode }, 200)
  }

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${datasetId}/events`
  let enviados = 0
  let erros = 0
  let fallbacks = 0
  // Só no modo teste: a resposta crua da Meta volta na chamada, pra auditar.
  const detalhes: Record<string, unknown>[] = []

  for (const ev of eventos) {
    const base = await buildUserData(ev)
    const clid = ev.ctwa_clid ?? ev.contato?.ctwa_clid ?? null

    let canal: CanalMeta = escolherCanal(clid, wabaId)
    let resposta = await enviar(endpoint, montarEvento(ev, base, clid, canal, wabaId), accessToken, testEventCode)

    // A Meta recusou o canal de mensagens de forma definitiva → mesmo evento, mesmo
    // event_id, como loja física. Não duplica: o recusado não foi registrado por ela.
    let fallback: { fallback_de: CanalMeta; erro_original: unknown } | null = null
    if (!resposta.ok && canal === 'business_messaging' && !erroTransitorio(resposta.status, resposta.corpo)) {
      fallback = { fallback_de: canal, erro_original: resposta.corpo }
      canal = 'physical_store'
      resposta = await enviar(endpoint, montarEvento(ev, base, clid, canal, wabaId), accessToken, testEventCode)
      fallbacks++
    }

    if (resposta.ok) {
      await admin
        .from('meta_eventos')
        .update({
          status: 'enviado',
          action_source: canal,
          enviado_em: new Date().toISOString(),
          resposta_meta: { ...resumoSucesso(resposta.corpo), ...(fallback ?? {}) },
        })
        .eq('id', ev.id)
      enviados++
    } else {
      // Em erro, `action_source` = o último canal TENTADO, pra diagnóstico.
      await admin
        .from('meta_eventos')
        .update({
          status: 'erro',
          action_source: canal,
          tentativas: ev.tentativas + 1,
          resposta_meta: fallback ? { ...fallback, erro: resposta.corpo } : resposta.corpo,
        })
        .eq('id', ev.id)
      erros++
    }

    if (testEventCode) {
      detalhes.push({ event_id: ev.event_id, canal, http: resposta.status, meta: resposta.corpo, ...(fallback ?? {}) })
    }
  }

  return json(
    {
      ok: true,
      processados: eventos.length,
      enviados,
      erros,
      fallbacks,
      test_mode: !!testEventCode,
      ...(testEventCode ? { detalhes } : {}),
    },
    200,
  )
})
