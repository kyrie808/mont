// Edge Function: avisos-agenda
//
// Aviso diário interno da Agenda de Retornos (Onda 2 — docs/agenda-retornos). Esta função
// NÃO envia nada: a Evolution é local (n8n), inalcançável daqui. Ela diz ao n8n (W6) O QUE
// mandar e registra o que saiu. O texto mora em packages/shared/src/avisoAgenda.ts (com
// testes); os dados vêm de agenda_itens / agenda_atrasados — as mesmas funções da tela.
//
// Ações (header x-ingestor-secret, o mesmo das outras funções de máquina):
//   • simular        { dia? }               → o texto de um dia (hoje ou futuro), sem gravar
//   • do_dia         {}                     → o texto de hoje, se ainda não saiu e não é vazio
//   • marcar_enviado { dia, message_id }    → grava a marca do dia (só se ainda não existe)
//
// Destino é constante VALIDADA, nunca campo livre: só o grupo Equipe. Nenhum cliente e
// nenhum número pessoal recebe nada desta função.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { Database } from '../../../packages/shared/src/database.ts'
import { entraNosAtrasados, montarAvisoAgenda, type ItemAvisoAgenda } from '../../../packages/shared/src/avisoAgenda.ts'

/** 🧀 Equipe Mont Distribuidora 🛵 — o mesmo grupo dos alertas do avisos-entrega. */
const GRUPO_EQUIPE = '120363129541953733@g.us'

type Admin = SupabaseClient<Database>
type LinhaAgenda = Database['public']['Functions']['agenda_itens']['Returns'][number]

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
const hojeBrasilia = () => fmtDia.format(new Date())
function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const diaValido = (x: unknown): x is string =>
  typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(`${x}T00:00:00Z`))
const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

async function agendaItens(admin: Admin, inicio: string, fim: string): Promise<LinhaAgenda[]> {
  const { data, error } = await admin.rpc('agenda_itens', { p_inicio: inicio, p_fim: fim })
  if (error) throw new Error(`Falha ao ler agenda_itens: ${error.message}`)
  return data ?? []
}

async function agendaAtrasados(admin: Admin): Promise<LinhaAgenda[]> {
  const { data, error } = await admin.rpc('agenda_atrasados')
  if (error) throw new Error(`Falha ao ler agenda_atrasados: ${error.message}`)
  return data ?? []
}

/** agenda_itens não traz o responsável; ele vem da própria tabela lembretes. */
async function responsaveis(admin: Admin, ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await admin.from('lembretes').select('id, responsavel').in('id', ids)
  if (error) throw new Error(`Falha ao ler responsáveis: ${error.message}`)
  return new Map((data ?? []).map((l) => [l.id, l.responsavel]))
}

function paraAviso(l: LinhaAgenda, resp: Map<string, string | null>): ItemAvisoAgenda {
  return {
    origem: l.origem,
    data: l.data,
    hora: l.hora ?? null,
    titulo: l.titulo,
    situacao: l.situacao,
    contatoNome: l.contato_nome ?? null,
    valor: l.valor === null || l.valor === undefined ? null : Number(l.valor),
    responsavel: l.origem === 'lembrete' ? resp.get(l.id) ?? null : null,
  }
}

/**
 * O texto do aviso de `dia` (hoje ou futuro). Atrasados = agenda_atrasados() de agora; num
 * dia futuro, somam-se o que vence entre hoje e a véspera (lembrete pendente e vencimento),
 * que é o que estará atrasado no começo daquele dia.
 */
async function montarTexto(admin: Admin, dia: string): Promise<string | null> {
  const hoje = hojeBrasilia()
  const [atrasadosAgora, doDia, amanha, aVencerAteVespera] = await Promise.all([
    agendaAtrasados(admin),
    agendaItens(admin, dia, dia),
    agendaItens(admin, somarDias(dia, 1), somarDias(dia, 1)),
    dia > hoje ? agendaItens(admin, hoje, somarDias(dia, -1)) : Promise.resolve([] as LinhaAgenda[]),
  ])
  const atrasados = [...atrasadosAgora, ...aVencerAteVespera.filter(entraNosAtrasados)]
  const todos = [...atrasados, ...doDia, ...amanha]
  const resp = await responsaveis(admin, [...new Set(todos.filter((l) => l.origem === 'lembrete').map((l) => l.id))])
  return montarAvisoAgenda({
    dia,
    atrasados: atrasados.map((l) => paraAviso(l, resp)),
    doDia: doDia.map((l) => paraAviso(l, resp)),
    amanha: amanha.map((l) => paraAviso(l, resp)),
  })
}

async function marcaDoDia(admin: Admin, dia: string): Promise<{ enviado_em: string } | null> {
  const { data, error } = await admin.from('agenda_avisos_enviados').select('enviado_em').eq('dia', dia).maybeSingle()
  if (error) throw new Error(`Falha ao ler a marca do dia: ${error.message}`)
  return data
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

  const admin: Admin = createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    if (body.acao === 'simular') {
      const hoje = hojeBrasilia()
      const dia = body.dia === undefined ? hoje : body.dia
      if (!diaValido(dia)) return json({ error: 'dia deve ser AAAA-MM-DD' }, 400)
      // O passado não se reconstrói: agenda_atrasados() é sempre "a partir de agora".
      if (dia < hoje) return json({ error: 'simular só hoje ou dia futuro' }, 400)
      const texto = await montarTexto(admin, dia)
      const marca = await marcaDoDia(admin, dia)
      return json({ ok: true, simulacao: true, dia, destino: GRUPO_EQUIPE, enviar: texto !== null, texto, ja_enviado_em: marca?.enviado_em ?? null }, 200)
    }

    if (body.acao === 'do_dia') {
      const dia = hojeBrasilia()
      const marca = await marcaDoDia(admin, dia)
      if (marca) return json({ ok: true, enviar: false, motivo: 'ja_enviado', dia, enviado_em: marca.enviado_em }, 200)
      const texto = await montarTexto(admin, dia)
      if (texto === null) return json({ ok: true, enviar: false, motivo: 'vazio', dia }, 200)
      return json({
        ok: true,
        enviar: true,
        dia,
        destino: GRUPO_EQUIPE,
        texto,
        // Se o envio falhar, o n8n tenta um recado curto no mesmo grupo (pode falhar junto,
        // se o problema for o WhatsApp; aí só a execução com erro no n8n registra).
        falha_destino: GRUPO_EQUIPE,
        falha_texto: `⚠️ NÃO CONSEGUI MANDAR A AGENDA DE HOJE (${diaMes(dia)}).\n\nConfiram os retornos do dia no sistema.`,
      }, 200)
    }

    if (body.acao === 'marcar_enviado') {
      if (!diaValido(body.dia)) return json({ error: 'dia é obrigatório (AAAA-MM-DD)' }, 400)
      const messageId = typeof body.message_id === 'string' ? body.message_id : null
      // Só grava se o dia ainda não tem marca: um segundo envio não regrava o primeiro.
      const { data, error } = await admin.from('agenda_avisos_enviados')
        .upsert({ dia: body.dia, message_id: messageId, destino: GRUPO_EQUIPE }, { onConflict: 'dia', ignoreDuplicates: true })
        .select('dia')
      if (error) return json({ error: `Falha ao marcar aviso: ${error.message}` }, 500)
      return json({ ok: true, marcada: (data ?? []).length === 1, dia: body.dia, message_id: messageId }, 200)
    }

    return json({ error: 'acao inválida', acoes: ['simular', 'do_dia', 'marcar_enviado'] }, 400)
  } catch (e) {
    console.error('[avisos-agenda]', e)
    return json({ error: (e as Error).message }, 500)
  }
})
