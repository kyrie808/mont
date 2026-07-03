// Edge Function: meta-capi-worker
// Flush diário da outbox `meta_eventos` → Meta Conversions API (offline events).
// Blueprint §4. Escopo v1: Purchase por match de telefone/hash.
//
// Invocação: cron (pg_cron + pg_net) 1x/dia, OU manual para teste. Protegida por header
//   x-cron-secret == env CRON_SECRET. Usa service_role internamente (lê/escreve meta_eventos,
//   que tem RLS service_role-only para escrita).
//
// Segredos (supabase secrets set …), NUNCA no banco/cliente:
//   META_CAPI_ACCESS_TOKEN  — token da CAPI gerado no Events Manager
//   META_DATASET_ID         — id do dataset/pixel (default 1689731802148035)
//   META_TEST_EVENT_CODE    — opcional; quando setado, envia em modo Test Events
//   CRON_SECRET             — segredo compartilhado que autoriza a invocação
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — injetados pelo runtime

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  normalizePhone,
  splitName,
  normalizeCity,
  normalizeState,
  normalizeZip,
  hashField,
} from '../../../packages/shared/src/metaNormalize.ts'

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
  action_source: string
  tentativas: number
  contato: ContatoMatch | null
}

interface MetaUserData {
  ph?: string[]
  fn?: string[]
  ln?: string[]
  ct?: string[]
  st?: string[]
  zip?: string[]
  external_id?: string[]
  ctwa_clid?: string
}

async function buildUserData(ev: EventoRow): Promise<MetaUserData> {
  const c = ev.contato
  const ud: MetaUserData = {}
  if (!c) return ud

  const { fn, ln } = splitName(c.nome)
  ud.ph = await hashField(normalizePhone(c.telefone))
  ud.fn = await hashField(fn)
  ud.ln = await hashField(ln)
  ud.ct = await hashField(normalizeCity(c.cidade))
  ud.st = await hashField(normalizeState(c.uf))
  ud.zip = await hashField(normalizeZip(c.cep))
  ud.external_id = await hashField(c.id)

  const ctwa = ev.ctwa_clid ?? c.ctwa_clid
  if (ctwa) ud.ctwa_clid = ctwa // CRU, sem hash

  return ud
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
  if (!accessToken) return json({ error: 'META_CAPI_ACCESS_TOKEN ausente' }, 500)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // Pendentes + erros ainda dentro do limite de tentativas.
  const { data: eventos, error: readErr } = await admin
    .from('meta_eventos')
    .select(`
      id, evento, event_id, event_time, valor, moeda, ctwa_clid, action_source, tentativas,
      contato:contatos ( id, telefone, nome, cidade, uf, cep, ctwa_clid )
    `)
    .or(`status.eq.pendente,and(status.eq.erro,tentativas.lt.${MAX_TENTATIVAS})`)
    .order('criado_em', { ascending: true })
    .limit(BATCH_LIMIT)
    .returns<EventoRow[]>()

  if (readErr) return json({ error: `Falha ao ler outbox: ${readErr.message}` }, 500)
  if (!eventos || eventos.length === 0) return json({ ok: true, processados: 0 }, 200)

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${datasetId}/events`
  let enviados = 0
  let erros = 0

  for (const ev of eventos) {
    const user_data = await buildUserData(ev)

    const custom_data =
      ev.evento === 'Purchase'
        ? { value: Number(ev.valor ?? 0), currency: ev.moeda || 'BRL', content_type: 'product' }
        : {}

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: ev.evento,
          event_time: Math.floor(new Date(ev.event_time).getTime() / 1000),
          event_id: ev.event_id,
          action_source: ev.action_source,
          user_data,
          custom_data,
        },
      ],
      access_token: accessToken,
    }
    if (testEventCode) payload.test_event_code = testEventCode

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()

      if (res.ok) {
        await admin
          .from('meta_eventos')
          .update({
            status: 'enviado',
            enviado_em: new Date().toISOString(),
            resposta_meta: { fbtrace_id: result.fbtrace_id, events_received: result.events_received },
          })
          .eq('id', ev.id)
        enviados++
      } else {
        await admin
          .from('meta_eventos')
          .update({ status: 'erro', tentativas: ev.tentativas + 1, resposta_meta: result })
          .eq('id', ev.id)
        erros++
      }
    } catch (e) {
      await admin
        .from('meta_eventos')
        .update({ status: 'erro', tentativas: ev.tentativas + 1, resposta_meta: { erro: (e as Error).message } })
        .eq('id', ev.id)
      erros++
    }
  }

  return json({ ok: true, processados: eventos.length, enviados, erros, test_mode: !!testEventCode }, 200)
})
