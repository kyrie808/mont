// Edge Function: avisos-entrega
//
// Aviso automático de entrega no grupo #ENTREGAS (rodada 2, item C — Luccas, 15/10/2026).
// Uma entrega deixou de sair porque o aviso não foi mandado. Esta função NÃO envia nada: a
// Evolution é local (n8n), inalcançável daqui. Ela diz ao n8n O QUE mandar e PARA ONDE, e
// registra o que saiu. Texto e regra de horário moram em packages/shared/src/avisoEntrega.ts
// (com testes).
//
// Ações (header x-ingestor-secret, o mesmo das outras funções de máquina):
//   • simular        { venda_ids }        → os textos, sem gravar nada
//   • devidos        {}                   → o que sai AGORA (o n8n chama a cada 5 min)
//   • marcar_enviado { venda_id, message_id } → grava aviso_grupo_enviado_em (só se vazio)
//   • nao_entregues  {}                   → a lista das 21h: previstas para hoje não entregues
//
// Destinos são constantes VALIDADAS, nunca campo livre: id errado publicaria pedido de
// cliente (nome, telefone, endereço) em outro grupo.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { alertaEquipe, avisosDevidos, montarAvisoEntrega, type VendaAviso } from '../../../packages/shared/src/avisoEntrega.ts'

/** 🚘 #ENTREGAS - MONT DISTRIBUIDORA — o aviso para o entregador. */
const GRUPO_ENTREGAS = '120363426226842631@g.us'
/** 🧀 Equipe Mont Distribuidora 🛵 — alertas (7h30, 21h), Luccas e Gilmar. */
const GRUPO_EQUIPE = '120363129541953733@g.us'

// Alertas para a Equipe que dá para desligar sem código (Luccas, 16/10/2026: desligados).
// Ligar: `npx supabase secrets set AVISOS_ALERTA_ATRASO_EQUIPE=true` (idem AVISOS_LISTA_21H_EQUIPE).
// Sempre ligados, sem flag: o alerta de FALHA de envio ao #ENTREGAS e o de pagamento indefinido.
const flagLigada = (nome: string) => Deno.env.get(nome)?.trim().toLowerCase() === 'true'
/** Venda de hoje que perdeu o lote das 19h: o aviso sai às 7h30 no #ENTREGAS; isto é só o recado à Equipe. */
const ALERTA_ATRASO_EQUIPE = 'AVISOS_ALERTA_ATRASO_EQUIPE'
/** Lista das 21h com as entregas do dia ainda não marcadas como entregues. */
const LISTA_21H_EQUIPE = 'AVISOS_LISTA_21H_EQUIPE'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const SELECT_VENDA = `
  id, data_entrega_prevista, criado_em, aviso_grupo_enviado_em, status, forma_pagamento, pago,
  total, valor_pago, taxa_entrega, observacao_entregador,
  contato:contatos!inner(nome, telefone, cep, logradouro, numero, complemento, bairro, cidade, endereco),
  itens:itens_venda(quantidade, produto:produtos(nome))`

interface LinhaVenda {
  id: string
  data_entrega_prevista: string | null
  criado_em: string
  aviso_grupo_enviado_em: string | null
  status: string
  forma_pagamento: string
  pago: boolean | null
  total: number | string
  valor_pago: number | string | null
  taxa_entrega: number | string | null
  observacao_entregador: string | null
  contato: {
    nome: string; telefone: string | null; cep: string | null; logradouro: string | null; numero: string | null
    complemento: string | null; bairro: string | null; cidade: string | null; endereco: string | null
  }
  itens: Array<{ quantidade: number | string; produto: { nome: string } | null }>
}

function paraAviso(l: LinhaVenda): VendaAviso {
  return {
    id: l.id,
    dataEntregaPrevista: l.data_entrega_prevista,
    criadoEm: l.criado_em,
    avisoEnviadoEm: l.aviso_grupo_enviado_em,
    status: l.status,
    formaPagamento: l.forma_pagamento,
    pago: l.pago === true,
    total: Number(l.total),
    valorPago: Number(l.valor_pago ?? 0),
    taxaEntrega: l.taxa_entrega === null ? null : Number(l.taxa_entrega),
    observacaoEntregador: l.observacao_entregador,
    cliente: { ...l.contato },
    itens: (l.itens ?? []).map((i) => ({ quantidade: Number(i.quantidade), nome: i.produto?.nome ?? '(produto removido)' })),
  }
}

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
const hojeBrasilia = () => fmtDia.format(new Date())
function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** A consulta já montada (o builder do supabase-js é "thenable"). */
type ConsultaVendas = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>

async function lerVendas(consulta: ConsultaVendas): Promise<VendaAviso[]> {
  const { data, error } = await consulta
  if (error) throw new Error(`Falha ao ler vendas: ${error.message}`)
  return ((data ?? []) as LinhaVenda[]).map(paraAviso)
}

const vendasComAviso = (admin: SupabaseClient) => admin.from('vendas').select(SELECT_VENDA)

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

  try {
    if (body.acao === 'simular') {
      const ids = Array.isArray(body.venda_ids) ? body.venda_ids.filter((x): x is string => typeof x === 'string') : []
      if (ids.length === 0) return json({ error: 'venda_ids é obrigatório' }, 400)
      const vendas = await lerVendas(vendasComAviso(admin).in('id', ids))
      return json({
        ok: true,
        simulacao: true,
        destino: GRUPO_ENTREGAS,
        avisos: vendas.map((v) => ({ venda_id: v.id, cliente: v.cliente.nome, ja_avisada_em: v.avisoEnviadoEm, texto: montarAvisoEntrega(v) })),
      }, 200)
    }

    if (body.acao === 'devidos') {
      const hoje = hojeBrasilia()
      const vendas = await lerVendas(vendasComAviso(admin)
        .eq('status', 'pendente')
        .is('aviso_grupo_enviado_em', null)
        .gte('data_entrega_prevista', hoje)
        .lte('data_entrega_prevista', somarDias(hoje, 1)))
      const porId = new Map(vendas.map((v) => [v.id, v]))
      const devidos = avisosDevidos(vendas, Date.now()).map(({ vendaId, alertar: atrasado }) => {
        const v = porId.get(vendaId)!
        const nome = v.cliente.nome.trim()
        const dia = diaMes(v.dataEntregaPrevista!)
        // O aviso atrasado sai no #ENTREGAS de qualquer jeito; o recado à Equipe depende da flag.
        const alerta = alertaEquipe(v, atrasado, { alertaAtraso: flagLigada(ALERTA_ATRASO_EQUIPE) })
        return {
          venda_id: vendaId,
          destino: GRUPO_ENTREGAS,
          texto: montarAvisoEntrega(v),
          // Se o envio ao #ENTREGAS falhar, o n8n avisa a Equipe com este texto.
          falha_destino: GRUPO_EQUIPE,
          falha_texto: `⚠️ NÃO CONSEGUI MANDAR O AVISO DE ENTREGA no #ENTREGAS\n\n${nome} — entrega ${dia}. Mandem à mão; vou tentar de novo em 5 minutos.`,
          alertar: alerta !== null,
          ...(alerta !== null ? { alerta_destino: GRUPO_EQUIPE, alerta_texto: alerta } : {}),
        }
      })
      return json({ ok: true, devidos }, 200)
    }

    if (body.acao === 'marcar_enviado') {
      const vendaId = typeof body.venda_id === 'string' ? body.venda_id : ''
      if (!vendaId) return json({ error: 'venda_id é obrigatório' }, 400)
      // Só marca se ainda vazio: dois envios concorrentes não regravam o horário do primeiro.
      const { data, error } = await admin.from('vendas')
        .update({ aviso_grupo_enviado_em: new Date().toISOString() })
        .eq('id', vendaId).is('aviso_grupo_enviado_em', null)
        .select('id')
      if (error) return json({ error: `Falha ao marcar aviso: ${error.message}` }, 500)
      return json({ ok: true, marcada: (data ?? []).length === 1, message_id: body.message_id ?? null }, 200)
    }

    if (body.acao === 'nao_entregues') {
      if (!flagLigada(LISTA_21H_EQUIPE)) return json({ ok: true, enviar: false, desligado: LISTA_21H_EQUIPE }, 200)
      const hoje = hojeBrasilia()
      const vendas = await lerVendas(vendasComAviso(admin).eq('status', 'pendente').eq('data_entrega_prevista', hoje))
      if (vendas.length === 0) return json({ ok: true, enviar: false }, 200)
      const linhas = vendas.map((v) =>
        `• ${v.cliente.nome.trim()} — ${v.itens.map((i) => `${i.quantidade} ${i.nome}`).join(', ')}${v.avisoEnviadoEm ? '' : ' (⚠️ sem aviso no #ENTREGAS)'}`)
      return json({
        ok: true,
        enviar: true,
        destino: GRUPO_EQUIPE,
        texto: `📋 *Entregas de hoje (${diaMes(hoje)}) ainda NÃO marcadas como entregues:*\n\n${linhas.join('\n')}\n\nSe já foram entregues, marquem no sistema.`,
      }, 200)
    }

    return json({ error: 'acao inválida', acoes: ['simular', 'devidos', 'marcar_enviado', 'nao_entregues'] }, 400)
  } catch (e) {
    console.error('[avisos-entrega]', e)
    return json({ error: (e as Error).message }, 500)
  }
})
