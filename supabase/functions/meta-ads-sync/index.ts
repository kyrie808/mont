// Edge Function: meta-ads-sync
// Sincroniza as campanhas de TRÁFEGO direto da Meta (Marketing API).
// Fase 1: identidade das campanhas (id/nome/objetivo/status) → upsert em `campanhas`.
// Fase 2: insights diários (gasto/impressões/cliques) → upsert em `campanha_meta_metricas`
//         (série temporal, fonte do ROAS).
// Fase 3: mapa anúncio → campanha → upsert em `meta_anuncios`.
//         O referral do Click-to-WhatsApp traz `source_id`, que é o id do ANÚNCIO;
//         `campanhas.meta_campaign_id` é nível campanha. Sem esse dicionário, o lead
//         que chega pelo anúncio não tem como preencher `contatos.campanha_id` — e o
//         ROAS por campanha continua cego mesmo com o ctwa_clid capturado.
//
// Invocação:
//   - cron (pg_cron + pg_net) 1x/dia — header x-cron-secret == env CRON_SECRET; OU
//   - botão "Sincronizar agora" no app — Authorization: Bearer <jwt> de um admin.
// Usa service_role internamente para o upsert (campanhas tem RLS admin-only para escrita).
//
// Segredos (supabase secrets set …), NUNCA no banco/cliente:
//   META_ADS_TOKEN        — token de System User com ads_read
//   META_ADS_ACCOUNT_ID   — id da conta de anúncios (com prefixo act_, ex.: act_1704804423846011)
//   CRON_SECRET           — segredo compartilhado que autoriza a invocação por cron
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — injetados pelo runtime

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const GRAPH_VERSION = 'v21.0'

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

interface MetaCampaign {
  id: string
  name: string
  objective?: string | null
  effective_status?: string | null
}

// "[MONT DISTRIBUIDORA] Campanha Egaj. Whatsapp" → "Campanha Egaj. Whatsapp".
function cleanName(name: string): string {
  return name.replace(/^\s*\[[^\]]*\]\s*/, '').trim() || name.trim()
}

// Autoriza por cron secret OU por JWT de admin.
async function isAuthorized(req: Request, admin: SupabaseClient): Promise<boolean> {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return true

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  const { data: userData, error } = await admin.auth.getUser(token)
  if (error || !userData?.user) return false
  const { data: ok } = await admin.rpc('is_admin', { check_user_id: userData.user.id })
  return ok === true
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  if (!(await isAuthorized(req, admin))) return json({ ok: false, error: 'Não autorizado' }, 401)

  const token = Deno.env.get('META_ADS_TOKEN')
  let accountId = Deno.env.get('META_ADS_ACCOUNT_ID')
  if (!token || !accountId) {
    return json({ ok: false, error: 'META_ADS_TOKEN / META_ADS_ACCOUNT_ID ausentes (configure o token da Meta).' }, 500)
  }
  if (!accountId.startsWith('act_')) accountId = `act_${accountId}`

  // Busca as campanhas da conta (uma página; a Mont tem poucas).
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/campaigns`
    + `?fields=id,name,objective,effective_status&limit=200&access_token=${encodeURIComponent(token)}`

  let campaigns: MetaCampaign[] = []
  try {
    const res = await fetch(url)
    const body = await res.json()
    if (!res.ok) return json({ ok: false, error: body?.error?.message ?? 'Falha na Graph API', meta: body }, 502)
    campaigns = (body?.data ?? []) as MetaCampaign[]
  } catch (e) {
    return json({ ok: false, error: `Erro ao consultar a Meta: ${(e as Error).message}` }, 502)
  }

  const agora = new Date().toISOString()
  // Upsert por meta_campaign_id. Omitimos `tipo` de propósito: no INSERT vale o default
  // 'aquisicao'; no UPDATE preserva o tipo existente (ex.: uma campanha 'ambos').
  const rows = campaigns.map((c) => ({
    meta_campaign_id: c.id,
    nome: cleanName(c.name),
    origem_campanha: 'meta',
    meta_objetivo: c.objective ?? null,
    meta_status: c.effective_status ?? null,
    meta_sync_em: agora,
    ativo: true,
  }))

  let upserts = 0
  if (rows.length > 0) {
    const { error, count } = await admin
      .from('campanhas')
      .upsert(rows, { onConflict: 'meta_campaign_id', count: 'exact' })
    if (error) return json({ ok: false, error: `Falha no upsert: ${error.message}` }, 500)
    upserts = count ?? rows.length
  }

  // Campanhas que sumiram da Meta → desativa (nunca deleta; protege FKs).
  let desativadas = 0
  if (campaigns.length > 0) {
    const inList = `(${campaigns.map((c) => `"${c.id}"`).join(',')})`
    const { error, count } = await admin
      .from('campanhas')
      .update({ ativo: false }, { count: 'exact' })
      .eq('origem_campanha', 'meta')
      .not('meta_campaign_id', 'in', inList)
    if (!error) desativadas = count ?? 0
  }

  // ── Fase 2: insights diários (gasto) por campanha ──────────────────────────
  // Série temporal → fonte do ROAS. Mapa meta_campaign_id → campanha_id (já upsertadas).
  const { data: mapRows } = await admin
    .from('campanhas')
    .select('id, meta_campaign_id')
    .eq('origem_campanha', 'meta')
  const idByMeta = new Map<string, string>()
  for (const r of mapRows ?? []) {
    if (r.meta_campaign_id) idByMeta.set(r.meta_campaign_id, r.id)
  }

  interface InsightRow { spend?: string; impressions?: string; clicks?: string; date_start?: string }
  const metricas: Array<{
    campanha_id: string; dia: string; gasto: number; impressoes: number; cliques: number; sync_em: string
  }> = []

  for (const c of campaigns) {
    const campanhaId = idByMeta.get(c.id)
    if (!campanhaId) continue
    const insUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${c.id}/insights`
      + `?fields=spend,impressions,clicks&time_increment=1&date_preset=maximum&limit=500`
      + `&access_token=${encodeURIComponent(token)}`
    try {
      const res = await fetch(insUrl)
      const body = await res.json()
      if (!res.ok) continue
      for (const row of (body?.data ?? []) as InsightRow[]) {
        if (!row.date_start) continue
        metricas.push({
          campanha_id: campanhaId,
          dia: row.date_start,
          gasto: Number(row.spend ?? 0),
          impressoes: parseInt(row.impressions ?? '0', 10),
          cliques: parseInt(row.clicks ?? '0', 10),
          sync_em: agora,
        })
      }
    } catch { /* pula essa campanha; não derruba o sync */ }
  }

  let metricas_upserts = 0
  if (metricas.length > 0) {
    const { error, count } = await admin
      .from('campanha_meta_metricas')
      .upsert(metricas, { onConflict: 'campanha_id,dia', count: 'exact' })
    if (!error) metricas_upserts = count ?? metricas.length
  }

  // ── Fase 3: mapa anúncio → campanha ────────────────────────────────────────
  // Alimenta `meta_anuncios`, que o whatsapp-ingestor consulta pra traduzir o
  // `source_id` do referral CTWA em campanha do Mont.
  interface MetaAd {
    id: string
    name?: string | null
    adset_id?: string | null
    campaign_id?: string | null
    effective_status?: string | null
  }

  const ads: MetaAd[] = []
  try {
    let next: string | null =
      `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/ads`
      + `?fields=id,name,adset_id,campaign_id,effective_status&limit=500`
      + `&access_token=${encodeURIComponent(token)}`

    // Anúncio se multiplica mais rápido que campanha (hoje 15 pra 3), então aqui
    // vale paginar. Teto de 10 páginas pra nunca virar loop infinito.
    for (let pagina = 0; next && pagina < 10; pagina++) {
      const res = await fetch(next)
      const body = await res.json()
      if (!res.ok) break
      for (const a of (body?.data ?? []) as MetaAd[]) ads.push(a)
      next = body?.paging?.next ?? null
    }
  } catch { /* não derruba o sync: campanhas e métricas já foram gravadas */ }

  let anuncios_upserts = 0
  if (ads.length > 0) {
    // Anúncio sem campanha não serve de dicionário — e `campaign_id` é NOT NULL.
    const linhas = ads
      .filter((a) => a.campaign_id)
      .map((a) => ({
        ad_id: a.id,
        adset_id: a.adset_id ?? null,
        campaign_id: a.campaign_id!,
        nome: a.name ?? null,
        status: a.effective_status ?? null,
        sync_em: agora,
      }))

    if (linhas.length > 0) {
      const { error, count } = await admin
        .from('meta_anuncios')
        .upsert(linhas, { onConflict: 'ad_id', count: 'exact' })
      if (!error) anuncios_upserts = count ?? linhas.length
    }
  }

  // Anúncio que sai do ar NÃO é removido daqui de propósito: um clique antigo pode
  // chegar depois, e sem a linha o lead perderia o vínculo com a campanha.

  return json({
    ok: true,
    upserts,
    desativadas,
    total_meta: campaigns.length,
    metricas: metricas_upserts,
    anuncios: anuncios_upserts,
  }, 200)
})
