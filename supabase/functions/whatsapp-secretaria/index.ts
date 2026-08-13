// Edge Function: whatsapp-secretaria
//
// NÃO decide o que dizer. Responde ao n8n as perguntas que ele não pode responder
// sozinho — e, principalmente, as que NÃO PODEM ser contornadas editando um workflow:
//   · este número está liberado?          (a gaiola)
//   · quem falou por último foi humano?   (prioridade humana)
//   · quais são os produtos e preços reais?
//
// O que dizer é do AI Agent no n8n, onde o prompt fica editável na tela. O que mora aqui
// é o que precisa de revisão em pull request para mudar.
//
// Protegida pelo mesmo `x-ingestor-secret` das outras funções de máquina: é o mesmo
// chamador (n8n local) falando com o mesmo projeto.
//
// Segredos:
//   INGESTOR_SECRET      — compartilhado com o n8n
//   SECRETARIA_MODO      — 'dev' (default) | 'producao'
//   SECRETARIA_ALLOWLIST — números liberados em dev, separados por vírgula
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — injetados pelo runtime

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import {
  humanoAssumiu,
  estaLiberado,
  type MensagemDaConversa,
} from '../../../packages/shared/src/secretaria.ts'

// Contexto suficiente para entender o assunto sem inflar o prompt.
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

interface ItemCatalogo {
  nome: string
  preco: number
}

/**
 * O que a secretária pode citar para um cliente.
 *
 * `visivel_catalogo` e não só `ativo`: dos 25 produtos ativos, 11 estão fora da vitrine
 * porque são SKUs legados ou duplicados — `"kit BALDÃO"` com aspas no nome,
 * `Pão de Queijo 2kg - 100gr` substituído pelo `- 50gr`, os combos da Copa trocados
 * pelos `#`. Citar um desses seria oferecer ao cliente algo que a Mont parou de vender.
 * A vitrine já é a curadoria do Gilmar; a secretária herda essa curadoria.
 *
 * ⚠️ SEM disponibilidade de propósito. `estoque_atual` está quase todo negativo
 * (Palito 1kg em -365, Massa 1kg em -265) — é o baseline nunca contado, não falta real,
 * e a contagem física ainda está pendente do diretor. Derivar "tem estoque" daí faria a
 * secretária dizer a quase todo lead que não temos pão de queijo. Enquanto o número não
 * for confiável, estoque é assunto de humano.
 */
async function lerCatalogo(admin: SupabaseClient): Promise<ItemCatalogo[]> {
  const { data } = await admin
    .from('produtos')
    .select('nome, preco')
    .eq('ativo', true)
    .eq('visivel_catalogo', true)
    .order('nome')

  return (data ?? []).map((p) => ({ nome: p.nome, preco: Number(p.preco ?? 0) }))
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

  const conversa = ordenadas.map((m) => ({
    de: m.direcao === 'entrada' ? 'cliente' : 'nos',
    texto: m.conteudo ?? `[${m.tipo_midia}]`,
    em: m.enviada_em,
  }))

  if (humanoAssumiu(paraRegra, idsDaAgente)) {
    // Devolve a conversa mesmo assim: o aviso no canal interno cita a última mensagem
    // do cliente, e sem isso o n8n teria que pedir o contexto de novo.
    return { pode_responder: false, motivo: 'humano_assumiu' as const, contato, conversa }
  }

  return {
    pode_responder: true,
    motivo: 'ok' as const,
    contato,
    conversa,
    catalogo: await lerCatalogo(admin),
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
