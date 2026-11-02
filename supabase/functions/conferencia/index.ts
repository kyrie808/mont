// Edge Function: conferencia
//
// Conferência de hora em hora (bloco C, Black 2026). Como a avisos-entrega, esta função NÃO
// envia nada: a Evolution é local (n8n). Ela diz ao n8n O QUE mandar e PARA ONDE, e registra
// o que saiu. Critério, horário (8h–21h SP, resumo da noite) e textos moram em
// packages/shared/src/conferencia.ts (com testes).
//
// O que ela confere:
//   • pedido_sem_venda    — pedido fechado lido na conversa (pedidos_conversa) sem venda do
//                           contato entre 30 min antes e 3 h depois do aceite → grupo da equipe
//   • anuncio_sem_purchase — venda entregue de cliente vindo de anúncio (ctwa_clid) sem
//                           Purchase em meta_eventos → só o Luccas
//   • evento_meta         — evento em erro, ou pendente há mais de 2 h → só o Luccas
//
// Ações (header x-ingestor-secret, o mesmo das outras funções de máquina):
//   • devidos        {}                      → registra os alertas novos e devolve o que sai AGORA
//   • simular        { agora? }              → o mesmo, sem gravar nada (para conferir antes)
//   • marcar_enviado { alerta_ids, message_id } → grava que saiu (só os que estavam pendentes)
//
// Destinos são constantes VALIDADAS, nunca campo livre: id errado publicaria pedido de
// cliente em outro grupo.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  HORAS_PARA_VENDA,
  mensagensDevidas,
  textoAnuncioSemPurchase,
  textoEventoMeta,
  textoPedidoSemVenda,
  type AlertaPendente,
  type PedidoParaAviso,
} from '../../../packages/shared/src/conferencia.ts'

/** 🧀 Equipe Mont Distribuidora 🛵 — pedido para conferir. */
const GRUPO_EQUIPE = '120363129541953733@g.us'
/** Luccas — eventos da Meta e "analista sem LLM" (só para ele). Número trocado em 31/10. */
const LUCCAS = '5511980017732@s.whatsapp.net'
const DESTINO: Record<'grupo' | 'luccas', string> = { grupo: GRUPO_EQUIPE, luccas: LUCCAS }

/** Venda lançada até 30 min ANTES do aceite também conta (o pedido pode ter sido lançado antes da última mensagem). */
const MARGEM_ANTES_MS = 30 * 60_000
/** Evento pendente há mais que isso, com o envio de hora em hora, está parado. */
const PENDENTE_PARADO_MS = 2 * 3_600_000
/** Venda de anúncio sem Purchase: só a partir do dia em que a conferência entrou no ar. */
const CORTE_ANUNCIO = '2026-10-31T00:00:00-03:00'

// Desligados em 31/10/2026 (Luccas: atendimento e lançamento de vendas são humanos). Religar
// sem código: `npx supabase secrets set CONFERENCIA_PEDIDO_SEM_VENDA=true` (idem
// CONFERENCIA_RESUMO_NOITE). Os dados (pedidos_conversa, alertas_operacao) ficam onde estão.
const flagLigada = (nome: string) => Deno.env.get(nome)?.trim().toLowerCase() === 'true'
/** Pedido fechado na conversa sem venda em 3 h → grupo da Equipe. */
const PEDIDO_SEM_VENDA = 'CONFERENCIA_PEDIDO_SEM_VENDA'
/** O que vence de noite junta num "Resumo da noite"; desligado, sai um por um às 8h. */
const RESUMO_NOITE = 'CONFERENCIA_RESUMO_NOITE'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

interface Novo {
  tipo: 'pedido_sem_venda' | 'anuncio_sem_purchase' | 'evento_meta'
  ref: string
  destino: 'grupo' | 'luccas'
  vence_em: string
  texto: string
}

interface Resultado {
  novos: Novo[]
  /** Pedidos que acharam venda: grava venda_id e resolve o alerta, se ainda não saiu. */
  comVenda: { pedidoId: string; vendaId: string }[]
}

async function pedidosSemVenda(admin: SupabaseClient, agoraMs: number, r: Resultado) {
  const { data, error } = await admin
    .from('pedidos_conversa')
    .select('id, contato_id, fechado_em, itens, forma_pagamento, entrega, total_citado, confirmacao, faltam_sabores, trecho, extracao, contato:contatos(nome, telefone)')
    .is('venda_id', null)
    .order('fechado_em')
    .limit(200)
  if (error) throw new Error(`pedidos_conversa: ${error.message}`)

  for (const p of data ?? []) {
    const fechadoMs = Date.parse(p.fechado_em)
    // Qualquer venda do contato desde 30 min antes do aceite resolve — inclusive lançada
    // depois das 3 h, se o alerta ainda não saiu (de madrugada, por exemplo).
    const { data: venda, error: erroVenda } = await admin
      .from('vendas')
      .select('id')
      .eq('contato_id', p.contato_id)
      .neq('status', 'cancelada')
      .gte('criado_em', new Date(fechadoMs - MARGEM_ANTES_MS).toISOString())
      .order('criado_em')
      .limit(1)
      .maybeSingle()
    if (erroVenda) throw new Error(`vendas: ${erroVenda.message}`)
    if (venda) {
      r.comVenda.push({ pedidoId: p.id, vendaId: venda.id })
      continue
    }

    const venceMs = fechadoMs + HORAS_PARA_VENDA * 3_600_000
    if (venceMs > agoraMs) continue

    const pedido: PedidoParaAviso = {
      itens: (p.itens as PedidoParaAviso['itens']) ?? [],
      formaPagamento: p.forma_pagamento,
      entrega: p.entrega,
      totalCitado: p.total_citado === null ? null : Number(p.total_citado),
      faltamSabores: p.faltam_sabores,
      trecho: p.trecho,
      fechadoEm: p.fechado_em,
    }
    // Embed muitos-para-um: o PostgREST devolve um objeto (o tipo sem banco não sabe disso).
    const contato = p.contato as unknown as { nome: string | null; telefone: string | null } | null
    let texto = textoPedidoSemVenda({ nome: contato?.nome ?? null, telefone: contato?.telefone ?? null }, pedido)
    if (p.extracao === 'falhou') texto += '\n(A leitura automática do pedido falhou: confira na conversa.)'
    r.novos.push({ tipo: 'pedido_sem_venda', ref: p.id, destino: 'grupo', vence_em: new Date(venceMs).toISOString(), texto })
  }
}

async function anunciosSemPurchase(admin: SupabaseClient, agoraIso: string, r: Resultado) {
  const { data, error } = await admin
    .from('vendas')
    .select('id, total, data, contato:contatos!inner(nome, ctwa_clid)')
    .eq('status', 'entregue')
    .neq('forma_pagamento', 'brinde')
    .gte('criado_em', CORTE_ANUNCIO)
    .not('contato.ctwa_clid', 'is', null)
    .limit(500)
  if (error) throw new Error(`vendas de anúncio: ${error.message}`)
  if (!data?.length) return

  const { data: eventos, error: erroEv } = await admin
    .from('meta_eventos')
    .select('venda_id')
    .eq('evento', 'Purchase')
    .in('venda_id', data.map((v) => v.id))
  if (erroEv) throw new Error(`meta_eventos: ${erroEv.message}`)
  const comPurchase = new Set((eventos ?? []).map((e) => e.venda_id))

  for (const v of data) {
    if (comPurchase.has(v.id)) continue
    const contato = v.contato as unknown as { nome: string | null } | null
    r.novos.push({
      tipo: 'anuncio_sem_purchase', ref: v.id, destino: 'luccas', vence_em: agoraIso,
      texto: textoAnuncioSemPurchase({ nome: contato?.nome ?? null, total: Number(v.total), vendaId: v.id, data: v.data }),
    })
  }
}

async function eventosMeta(admin: SupabaseClient, agoraMs: number, agoraIso: string, r: Resultado) {
  const parado = new Date(agoraMs - PENDENTE_PARADO_MS).toISOString()
  const { data, error } = await admin
    .from('meta_eventos')
    .select('id, evento, event_id, status, valor, tentativas, resposta_meta')
    .or(`status.eq.erro,and(status.eq.pendente,criado_em.lt.${parado})`)
    .limit(200)
  if (error) throw new Error(`meta_eventos: ${error.message}`)

  for (const e of data ?? []) {
    const status = e.status === 'erro' ? 'erro' : 'parado'
    const resposta = e.resposta_meta as { error?: { error_user_msg?: string; message?: string } } | null
    r.novos.push({
      tipo: 'evento_meta', ref: `${e.id}:${status}`, destino: 'luccas', vence_em: agoraIso,
      texto: textoEventoMeta({
        evento: e.evento, eventId: e.event_id, status, valor: e.valor === null ? null : Number(e.valor),
        tentativas: e.tentativas, erro: resposta?.error?.error_user_msg ?? resposta?.error?.message ?? null,
      }),
    })
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)
  const segredo = Deno.env.get('INGESTOR_SECRET')
  if (!segredo || req.headers.get('x-ingestor-secret') !== segredo) return json({ error: 'Não autorizado' }, 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  if (body.acao === 'marcar_enviado') {
    const ids = Array.isArray(body.alerta_ids) ? body.alerta_ids.filter((x): x is string => typeof x === 'string') : []
    if (ids.length === 0) return json({ error: 'alerta_ids vazio' }, 400)
    const { data, error } = await admin
      .from('alertas_operacao')
      .update({ status: 'enviado', enviado_em: new Date().toISOString(), message_id: typeof body.message_id === 'string' ? body.message_id : null })
      .in('id', ids)
      .eq('status', 'pendente')
      .select('id')
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, marcados: data?.length ?? 0 }, 200)
  }

  if (body.acao !== 'devidos' && body.acao !== 'simular') {
    return json({ error: "acao deve ser 'devidos', 'simular' ou 'marcar_enviado'" }, 400)
  }
  const simular = body.acao === 'simular'
  const agoraIso = simular && typeof body.agora === 'string' && !Number.isNaN(Date.parse(body.agora))
    ? new Date(body.agora).toISOString()
    : new Date().toISOString()
  const agoraMs = Date.parse(agoraIso)

  try {
    const r: Resultado = { novos: [], comVenda: [] }
    const pedidoLigado = flagLigada(PEDIDO_SEM_VENDA)
    if (pedidoLigado) await pedidosSemVenda(admin, agoraMs, r)
    await anunciosSemPurchase(admin, agoraIso, r)
    await eventosMeta(admin, agoraMs, agoraIso, r)

    // Pendentes já registrados + os novos (sem duplicar tipo+ref).
    const { data: abertos, error: erroAbertos } = await admin
      .from('alertas_operacao')
      .select('id, tipo, ref, destino, vence_em, texto')
      .eq('status', 'pendente')
    if (erroAbertos) throw new Error(`alertas_operacao: ${erroAbertos.message}`)
    const { data: jaVistos, error: erroVistos } = await admin
      .from('alertas_operacao')
      .select('tipo, ref')
      .in('ref', r.novos.length ? r.novos.map((n) => n.ref) : ['-'])
    if (erroVistos) throw new Error(`alertas_operacao: ${erroVistos.message}`)
    const visto = new Set((jaVistos ?? []).map((a) => `${a.tipo}|${a.ref}`))
    const novos = r.novos.filter((n) => !visto.has(`${n.tipo}|${n.ref}`))

    const resolvidos = new Set(r.comVenda.map((c) => c.pedidoId))
    let pendentes: AlertaPendente[] = (abertos ?? [])
      .filter((a) => !(a.tipo === 'pedido_sem_venda' && resolvidos.has(a.ref)))
      // Desligado: um pedido_sem_venda que ficou pendente não sai (continua gravado).
      .filter((a) => pedidoLigado || a.tipo !== 'pedido_sem_venda')
      .map((a) => ({ id: a.id, destino: a.destino, venceEm: a.vence_em, texto: a.texto }))

    if (simular) {
      pendentes = [...pendentes, ...novos.map((n, i) => ({ id: `novo-${i}`, destino: n.destino, venceEm: n.vence_em, texto: n.texto }))]
      const devidos = mensagensDevidas(pendentes, agoraIso, { resumoNoite: flagLigada(RESUMO_NOITE) })
        .map((m) => ({ ...m, destino: DESTINO[m.destino] }))
      return json({
        ok: true, simulacao: true, agora: agoraIso, novos, com_venda: r.comVenda, devidos,
        flags: { [PEDIDO_SEM_VENDA]: pedidoLigado, [RESUMO_NOITE]: flagLigada(RESUMO_NOITE) },
      }, 200)
    }

    for (const c of r.comVenda) {
      const { error } = await admin.from('pedidos_conversa').update({ venda_id: c.vendaId }).eq('id', c.pedidoId).is('venda_id', null)
      if (error) throw new Error(`pedidos_conversa: ${error.message}`)
      await admin.from('alertas_operacao').update({ status: 'resolvido' })
        .eq('tipo', 'pedido_sem_venda').eq('ref', c.pedidoId).eq('status', 'pendente')
    }

    if (novos.length) {
      const { data: inseridos, error } = await admin
        .from('alertas_operacao')
        .upsert(novos, { onConflict: 'tipo,ref', ignoreDuplicates: true })
        .select('id, destino, vence_em, texto')
      if (error) throw new Error(`alertas_operacao: ${error.message}`)
      pendentes = [...pendentes, ...(inseridos ?? []).map((a) => ({ id: a.id, destino: a.destino, venceEm: a.vence_em, texto: a.texto }))]
    }

    const devidos = mensagensDevidas(pendentes, agoraIso, { resumoNoite: flagLigada(RESUMO_NOITE) })
      .map((m) => ({ ...m, destino: DESTINO[m.destino] }))
    return json({ ok: true, agora: agoraIso, registrados: novos.length, com_venda: r.comVenda.length, devidos }, 200)
  } catch (e) {
    console.error('[conferencia]', e)
    return json({ error: (e as Error).message }, 500)
  }
})
