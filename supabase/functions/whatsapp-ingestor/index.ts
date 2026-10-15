// Edge Function: whatsapp-ingestor  (W1 do CRM Inteligente)
//
// Recebe o webhook da Evolution API (repassado pelo n8n), grava a mensagem crua e
// — fora do modo sombra — casa/cria o contato e captura a atribuição do anúncio.
//
// DETERMINÍSTICA, SEM LLM. É de propósito: é mais barata, mais rápida e não alucina
// em dado estrutural. A interpretação da conversa é trabalho do W2.
//
// Invocação: POST do n8n, autorizada por header `x-ingestor-secret` == INGESTOR_SECRET.
// Usa service_role internamente (mensagens_whatsapp tem RLS service_role-only p/ escrita).
//
// Segredos (supabase secrets set …):
//   INGESTOR_SECRET — segredo compartilhado com o n8n
//   INGESTOR_MODO   — 'sombra' (default) | 'ativo'
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — injetados pelo runtime
//
// ⚠️ MODO SOMBRA é o default de propósito. Em sombra a função grava SÓ o log cru e
// não encosta em `contatos` nem em `interacoes`. É o que permite rodar no número real
// do Gilmar, esperando um clique de anúncio de verdade, sem arriscar a base de 810
// contatos enquanto o payload ainda não foi visto na prática. Virar 'ativo' é uma
// decisão consciente, tomada depois de olhar o que caiu em mensagens_whatsapp.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  agregarPorTelefone,
  avancaUltimoContato,
  isTipoAutomatico,
  extrairMensagensCruas,
  lidDaMensagem,
  normalizarMensagem,
  isAnuncioPago,
  podeGravarAtribuicao,
  lerCtwaClid,
  lerSourceId,
  telefoneWa,
  telefoneWaDeJid,
  type MensagemNormalizada,
} from '../../../packages/shared/src/whatsapp.ts'

// Lotes de history sync podem ser grandes; o Postgrest não gosta de payload gigante.
const CHUNK = 250

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

/**
 * Lote de resgate de histórico, enviado pelo workflow "resgatador" do n8n.
 *
 * Na carga de histórico o `remoteJid` vem como LID (id opaco), então o telefone NÃO é
 * derivável aqui. Quem resolve é o resgatador, que enxerga a Evolution e correlaciona
 * o `updatedAt` do chat com o instante da mensagem ao vivo. A função só confia no
 * telefone já resolvido — ela não tem como chegar na Evolution (roda na nuvem; a
 * Evolution é local).
 */
interface Resgate {
  lid: string
  telefone_wa: string
}

/**
 * Lê o lote de resgate. O resgatador manda o `remoteJidAlt` CRU, como a Evolution
 * entregou — quem canonicaliza é aqui.
 *
 * Isso é deliberado. A regra de telefone já existe em dois lugares que precisam
 * concordar (a SQL `fn_telefone_wa` e a TS `telefoneWa`); uma TERCEIRA cópia dentro
 * de um nó do n8n seria a mais fácil de divergir e a mais difícil de testar. A
 * primeira versão tentou isso com um regex `^55\d{2}9\d{8}$` e já nasceu errada:
 * descartou um cliente de DDD 35 cujo WhatsApp guarda o número no formato antigo,
 * `553588438564` — 12 dígitos, sem o 9. É exatamente o caso que `telefoneWa` resolve.
 */
function lerResgate(body: unknown): Resgate | null {
  if (typeof body !== 'object' || body === null) return null
  const r = (body as Record<string, unknown>).resgate
  if (typeof r !== 'object' || r === null) return null
  const { lid, telefone_wa } = r as Record<string, unknown>
  if (typeof lid !== 'string' || !lid) return null
  if (typeof telefone_wa !== 'string' || !telefone_wa) return null

  // Aceita JID completo (`553588438564@s.whatsapp.net`) ou só dígitos.
  const canonico = telefoneWaDeJid(telefone_wa) ?? telefoneWa(telefone_wa)
  if (!canonico) return null

  return { lid, telefone_wa: canonico }
}

function chunks<T>(arr: T[], tamanho: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += tamanho) out.push(arr.slice(i, i + tamanho))
  return out
}

/** `5511910049290` → `11910049290`, que é como os outros 783 contatos estão gravados. */
function telefoneNacional(canonico: string): string {
  return canonico.startsWith('55') ? canonico.slice(2) : canonico
}

/**
 * Telefone de cada LID do lote, lido do `wa_lid_map`.
 *
 * O envio pela API para contato em LID chega com `remoteJid` = LID e sem
 * `remoteJidAlt`. Sem esta consulta a mensagem era descartada, e a saída do
 * operador sumia do histórico. LID que não está no mapa continua de fora; ele segue
 * na tabela `Message` da Evolution para o backfill.
 */
async function telefonesDosLids(admin: SupabaseClient, cruas: Record<string, unknown>[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  const lids = [...new Set(cruas.map(lidDaMensagem).filter((l): l is string => l !== null))]
  if (lids.length === 0) return mapa

  for (const lote of chunks(lids, CHUNK)) {
    const { data, error } = await admin.from('wa_lid_map').select('lid, telefone_wa').in('lid', lote)
    if (error) throw new Error(`wa_lid_map: ${error.message}`)
    for (const r of data ?? []) mapa.set(r.lid, r.telefone_wa)
  }
  return mapa
}

// ── Passo 1: log cru ──────────────────────────────────────────────────────────

/**
 * Grava as mensagens ANTES de qualquer processamento. Reprocessar é grátis;
 * recuperar o que não foi salvo é impossível — e a atribuição do anúncio só existe
 * neste payload, uma única vez.
 *
 * `ignoreDuplicates` no `message_id` é a idempotência: webhook reentregue (a
 * Evolution reenvia com backoff) não duplica linha.
 */
async function gravarCruas(
  admin: SupabaseClient,
  mensagens: MensagemNormalizada[],
  payloadPorId: Map<string, unknown>,
  resgate: Resgate | null,
): Promise<number> {
  let gravadas = 0

  for (const lote of chunks(mensagens, CHUNK)) {
    const linhas = lote.map((m) => ({
      telefone_wa: m.telefoneWa,
      message_id: m.messageId,
      direcao: m.direcao,
      conteudo: m.conteudo,
      tipo_midia: m.tipoMidia,
      referral: m.referral,
      payload: payloadPorId.get(m.messageId) ?? {},
      enviada_em: m.enviadaEm,
      historico: resgate !== null,
      lid: resgate?.lid ?? null,
      // Mensagem automática de empresa (templateMessage) não é conversa: entra no registro
      // já fora da fila do analista. O agregador também não cria contato por ela.
      processado_em: isTipoAutomatico(m.tipoMidia) ? new Date().toISOString() : null,
    }))

    const { data, error } = await admin
      .from('mensagens_whatsapp')
      .upsert(linhas, { onConflict: 'message_id', ignoreDuplicates: true })
      .select('id')

    if (error) throw new Error(`Falha ao gravar mensagens: ${error.message}`)
    gravadas += data?.length ?? 0
  }

  return gravadas
}

// ── Passo 2: contatos ─────────────────────────────────────────────────────────

/** Resolve `source_id` (id do anúncio) → `campanhas.id`, via o mapa meta_anuncios. */
async function resolverCampanha(admin: SupabaseClient, sourceId: string | null): Promise<string | null> {
  if (!sourceId) return null

  const { data: anuncio } = await admin
    .from('meta_anuncios')
    .select('campaign_id')
    .eq('ad_id', sourceId)
    .maybeSingle()

  if (!anuncio?.campaign_id) return null

  const { data: campanha } = await admin
    .from('campanhas')
    .select('id')
    .eq('meta_campaign_id', anuncio.campaign_id)
    .maybeSingle()

  return campanha?.id ?? null
}

interface ResumoContato {
  criados: number
  atualizados: number
  atribuicoes: number
}

/**
 * Casa cada telefone com um contato (criando o que faltar), carimba a atribuição do
 * anúncio e atualiza `ultimo_contato`.
 *
 * ⚠️ A atribuição é gravada num ÚNICO statement junto de `origem='anuncio'`. Não é
 * estilo: o trigger `fn_enfileirar_lead_meta` dispara em INSERT/UPDATE OF origem e lê
 * `NEW.ctwa_clid` na mesma linha. Se o clid viesse num statement separado, o evento
 * seria enfileirado com `action_source='physical_store'` e clid nulo — exatamente o
 * bug que deixou os 250 eventos existentes sem atribuição.
 */
async function casarContatos(
  admin: SupabaseClient,
  mensagens: MensagemNormalizada[],
): Promise<ResumoContato> {
  const resumo: ResumoContato = { criados: 0, atualizados: 0, atribuicoes: 0 }

  // 1 contato por conversa, não 1 por mensagem. Referral só de entrada (ver a função).
  const porTelefone = agregarPorTelefone(mensagens)

  const telefones = [...porTelefone.keys()]
  const existentes = new Map<
    string,
    { id: string; origem: string | null; ctwa_clid: string | null; ultimo_contato: string | null }
  >()

  for (const lote of chunks(telefones, CHUNK)) {
    const { data, error } = await admin
      .from('contatos')
      .select('id, telefone_wa, origem, ctwa_clid, ultimo_contato')
      .in('telefone_wa', lote)

    if (error) throw new Error(`Falha ao buscar contatos: ${error.message}`)
    for (const c of data ?? []) {
      if (c.telefone_wa) existentes.set(c.telefone_wa, c)
    }
  }

  for (const [telefone, ag] of porTelefone) {
    const clid = lerCtwaClid(ag.referral)
    // ⚠️ Referral NÃO é sinônimo de anúncio. O primeiro capturado em produção veio de um
    // POST ORGÂNICO com botão de CTA (`FB_Post`/`post_cta`), de uma cliente que já era
    // `origem: 'direto'`. Marcar aquilo como anúncio reescreveria a origem dela e
    // enfileiraria um Lead na CAPI por tráfego orgânico. O referral orgânico é guardado
    // na mensagem (é informação boa), mas só o PAGO mexe na origem do contato.
    const veioDeAnuncio = isAnuncioPago(ag.referral)
    const campanhaId = veioDeAnuncio ? await resolverCampanha(admin, lerSourceId(ag.referral)) : null
    const atual = existentes.get(telefone)

    if (!atual) {
      // Contato novo. Se veio de anúncio, nasce com TUDO junto — origem, clid e
      // campanha no mesmo INSERT, pra que o trigger da CAPI enxergue o clid.
      const { error } = await admin.from('contatos').insert({
        nome: ag.nome ?? telefoneNacional(telefone),
        telefone: telefoneNacional(telefone),
        tipo: 'B2C',
        status: 'lead',
        // NÃO é 'direto': 'direto' significa que o Gilmar prospectou. Quem chega
        // sozinho na conversa não veio da atitude dele, e carimbar isso inflaria
        // justamente o número que mede a prospecção. 'whatsapp' assume a ignorância;
        // a equipe corrige na mão quando descobre como a pessoa chegou.
        origem: veioDeAnuncio ? 'anuncio' : 'whatsapp',
        // A porta pela qual o cadastro entrou. Sem isto o contato herdaria o
        // DEFAULT 'manual' e sumiria da fila "Novos da IA" — que existe justamente
        // porque o nome aqui é o push name do aparelho ("♡ Cadonhoto ♡", "🦋"),
        // não um nome que o operador reconheça.
        origem_cadastro: 'whatsapp',
        ultimo_contato: ag.ultimaEm,
        ...(veioDeAnuncio
          ? { ctwa_clid: clid, ad_referral: ag.referral, ctwa_clid_em: ag.referralEm, campanha_id: campanhaId }
          : {}),
      })

      if (error) throw new Error(`Falha ao criar contato ${telefone}: ${error.message}`)
      resumo.criados++
      if (veioDeAnuncio) resumo.atribuicoes++
      continue
    }

    // Contato existente. A origem que gente declarou ganha da atribuição automática:
    // quem foi cadastrado como indicação NUNCA vira anúncio, mesmo clicando num depois
    // (ver `podeGravarAtribuicao`). O referral segue guardado na mensagem.
    const gravarAtribuicao = veioDeAnuncio && podeGravarAtribuicao(atual.origem, !!atual.ctwa_clid)
    const avancaContato = avancaUltimoContato(atual.ultimo_contato, ag.ultimaEm)

    if (!gravarAtribuicao && !avancaContato) continue

    const { error } = await admin
      .from('contatos')
      .update({
        ...(avancaContato ? { ultimo_contato: ag.ultimaEm } : {}),
        ...(gravarAtribuicao
          ? {
              origem: 'anuncio',
              ctwa_clid: clid,
              ad_referral: ag.referral,
              ctwa_clid_em: ag.referralEm,
              ...(campanhaId ? { campanha_id: campanhaId } : {}),
            }
          : {}),
      })
      .eq('id', atual.id)

    if (error) throw new Error(`Falha ao atualizar contato ${telefone}: ${error.message}`)
    resumo.atualizados++
    if (gravarAtribuicao) resumo.atribuicoes++
  }

  // Religa as mensagens ao contato agora que todos existem.
  for (const lote of chunks(telefones, CHUNK)) {
    const { data } = await admin.from('contatos').select('id, telefone_wa').in('telefone_wa', lote)
    for (const c of data ?? []) {
      if (!c.telefone_wa) continue
      await admin
        .from('mensagens_whatsapp')
        .update({ contato_id: c.id })
        .eq('telefone_wa', c.telefone_wa)
        .is('contato_id', null)
    }
  }

  return resumo
}

// ── Passo 3: pedido do catálogo do WhatsApp ───────────────────────────────────

/**
 * `orderMessage` vira pedido pendente + nota na timeline, pela RPC (que é idempotente
 * por `message_id`: reentrega do webhook e backfill não duplicam nada).
 *
 * Roda DEPOIS de `casarContatos` porque a RPC exige a mensagem já ligada ao contato.
 * Falha aqui sobe como 500 de propósito: a Evolution reentrega, e um pedido de cliente
 * não pode sumir em silêncio — foi exatamente o que acontecia quando ele virava "[outro]".
 */
async function registrarPedidos(admin: SupabaseClient, mensagens: MensagemNormalizada[]): Promise<number> {
  let registrados = 0

  for (const m of mensagens) {
    if (!m.pedido || m.direcao !== 'entrada') continue

    const { data, error } = await admin.rpc('rpc_registrar_pedido_catalogo_wa', {
      p_message_id: m.messageId,
      p_order_id: m.pedido.orderId,
      p_titulo: m.pedido.titulo,
      p_itens_qtd: m.pedido.itensQtd,
      p_total: m.pedido.total,
      p_moeda: m.pedido.moeda,
      p_observacao: m.pedido.observacao,
    })

    if (error) throw new Error(`Falha ao registrar pedido ${m.messageId}: ${error.message}`)
    // `null` = já estava registrado.
    if (data) registrados++
  }

  return registrados
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const segredo = Deno.env.get('INGESTOR_SECRET')
  if (!segredo || req.headers.get('x-ingestor-secret') !== segredo) {
    return json({ error: 'Não autorizado' }, 401)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const resgate = lerResgate(body)
  const cruas = extrairMensagensCruas(body)
  const modo = Deno.env.get('INGESTOR_MODO') === 'ativo' ? 'ativo' : 'sombra'

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const telefonePorLid = resgate ? new Map<string, string>() : await telefonesDosLids(admin, cruas)
    const mensagens: MensagemNormalizada[] = []
    const payloadPorId = new Map<string, unknown>()

    for (const crua of cruas) {
      // No resgate o telefone vem pronto do resgatador. Ao vivo sai do próprio JID ou,
      // quando o JID é LID sem telefone (envio pela API), do wa_lid_map.
      const m = normalizarMensagem(crua, resgate?.telefone_wa ?? telefonePorLid.get(lidDaMensagem(crua) ?? ''))
      if (!m) continue // grupo, status, sem id, telefone não-canonizável, LID sem mapa
      mensagens.push(m)
      payloadPorId.set(m.messageId, crua)
    }

    if (mensagens.length === 0) {
      return json({ ok: true, modo, recebidas: cruas.length, gravadas: 0, ignoradas: cruas.length }, 200)
    }

    const gravadas = await gravarCruas(admin, mensagens, payloadPorId, resgate)
    const comReferral = mensagens.filter((m) => m.referral !== null).length
    const comAnuncioPago = mensagens.filter((m) => isAnuncioPago(m.referral)).length

    if (resgate) {
      // Resgate registra o par LID→telefone e PARA. Nunca casa contato: o passado não
      // reescreve origem, não mexe em `ultimo_contato` e não move o Kanban. Ele existe
      // como contexto pro perfilador, não como evento de relacionamento.
      await admin
        .from('wa_lid_map')
        .upsert(
          // `remote_jid_alt` é a Evolution AFIRMANDO o vínculo, não inferência nossa —
          // por isso o método fica registrado: um par vindo daqui é confiável, um par
          // vindo de heurística (se um dia precisarmos de uma) não seria igual.
          { lid: resgate.lid, telefone_wa: resgate.telefone_wa, metodo: 'remote_jid_alt' },
          { onConflict: 'lid' },
        )

      return json({
        ok: true, modo, resgate: true, lid: resgate.lid,
        recebidas: cruas.length, gravadas,
        ignoradas: cruas.length - mensagens.length,
        com_referral: comReferral,
      }, 200)
    }

    if (modo === 'sombra') {
      return json({
        ok: true,
        modo,
        recebidas: cruas.length,
        gravadas,
        ignoradas: cruas.length - mensagens.length,
        com_referral: comReferral,
        anuncio_pago: comAnuncioPago,
      }, 200)
    }

    const contatos = await casarContatos(admin, mensagens)
    const pedidos = await registrarPedidos(admin, mensagens)

    return json({
      ok: true,
      modo,
      recebidas: cruas.length,
      gravadas,
      ignoradas: cruas.length - mensagens.length,
      com_referral: comReferral,
      anuncio_pago: comAnuncioPago,
      contatos,
      pedidos,
    }, 200)
  } catch (e) {
    // 500 faz a Evolution/n8n reentregar. Como a gravação é idempotente por
    // message_id, reentrega é segura e melhor que perder a mensagem calada.
    console.error('[whatsapp-ingestor]', e)
    return json({ error: (e as Error).message }, 500)
  }
})
