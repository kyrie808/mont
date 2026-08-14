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
  particionarResposta,
  calcularTempoDigitacaoMs,
  type MensagemDaConversa,
} from '../../../packages/shared/src/secretaria.ts'
import { telefoneWaDeJid } from '../../../packages/shared/src/whatsapp.ts'

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
    // Aceita `jid` cru além de `telefone_wa` para que o n8n NUNCA precise canonicalizar
    // telefone num nó Code. Foi assim que este projeto perdeu um cliente: a regra ganhou
    // uma terceira cópia dentro de um workflow, nasceu com um regex errado e descartou o
    // Denivaldo (DDD 35, formato legado de 12 dígitos) em silêncio. A regra é uma só, e
    // mora em packages/shared.
    const jid = typeof body.jid === 'string' ? body.jid : ''
    const telefoneWa = typeof body.telefone_wa === 'string' && body.telefone_wa
      ? body.telefone_wa
      : (jid ? telefoneWaDeJid(jid) ?? '' : '')

    if (!telefoneWa) return json({ error: 'telefone_wa ou jid válido é obrigatório', jid }, 400)

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

      const texto = typeof body.texto === 'string' ? body.texto : null

      const { error } = await admin.from('wa_envios').upsert({
        message_id: messageId,
        telefone_wa: telefoneWa,
        contato_id: contato?.id ?? null,
        texto,
      }, { onConflict: 'message_id' })

      if (error) return json({ error: error.message }, 400)

      // A conversa também precisa da fala dela — e ninguém mais vai gravar.
      //
      // Descoberto em campo: o que sai pela API da Evolution NÃO volta pelo webhook.
      // Só mensagem digitada no celular ecoa (por isso as do celular ficam SERVER_ACK e
      // as nossas ficam PENDING para sempre). Sem gravar aqui, `contexto` leria uma
      // conversa só com as falas do CLIENTE: no segundo turno ela repetiria preço já
      // dito e perderia o fio, porque não teria memória do que ela mesma falou.
      //
      // É isto que torna `wa_envios` load-bearing: a linha entra como `saida`, igual à
      // de um humano, e só o id guardado lá diz que a voz é dela.
      const { error: erroMsg } = await admin.from('mensagens_whatsapp').upsert({
        message_id: messageId,
        telefone_wa: telefoneWa,
        contato_id: contato?.id ?? null,
        direcao: 'saida',
        conteudo: texto,
        tipo_midia: 'texto',
        payload: { origem: 'secretaria_ia' },
        enviada_em: new Date().toISOString(),
        historico: false,
      }, { onConflict: 'message_id' })

      // Não derruba o envio: a mensagem já saiu para o cliente, e falhar aqui só custa
      // contexto. Mas aparece no log, porque perder isto em silêncio deixaria a
      // secretária amnésica sem ninguém perceber.
      if (erroMsg) console.error('[secretaria] falha ao gravar a fala dela:', erroMsg.message)

      return json({ ok: true, conversa_gravada: !erroMsg }, 200)
    }

    if (body.acao === 'consultar_produto') {
      const termo = typeof body.termo === 'string' ? body.termo.trim() : ''
      if (!termo) return json({ error: 'termo é obrigatório' }, 400)

      const { data } = await admin
        .from('produtos')
        .select('nome, preco')
        .eq('ativo', true)
        .eq('visivel_catalogo', true)
        .ilike('nome', `%${termo}%`)
        .order('nome')
        .limit(10)

      return json({
        ok: true,
        produtos: (data ?? []).map((p) => ({ nome: p.nome, preco: Number(p.preco ?? 0) })),
      }, 200)
    }

    if (body.acao === 'consultar_frete') {
      // Lê a configuração real em vez de embutir a regra: o Gilmar muda o frete na tela
      // de Configurações, e a secretária tem que falar o mesmo número que o sistema cobra.
      const { data } = await admin
        .from('configuracoes').select('valor').eq('chave', 'frete_config').maybeSingle()

      const cfg = (data?.valor ?? {}) as {
        modo?: string
        faixas?: Array<{ ateKm?: number; valorFixo?: number }>
        foraDoAlcance?: string
      }
      const faixa = cfg.faixas?.[0]

      return json({
        ok: true,
        modo: cfg.modo ?? 'desconhecido',
        valor: faixa?.valorFixo ?? null,
        ate_km: faixa?.ateKm ?? null,
        // 'a_combinar' NÃO é para a agente improvisar — é caso de escalar.
        fora_do_alcance: cfg.foraDoAlcance ?? 'a_combinar',
      }, 200)
    }

    if (body.acao === 'registrar_pedido_intencao') {
      const resumo = typeof body.resumo === 'string' ? body.resumo.trim() : ''
      if (!resumo) return json({ error: 'resumo é obrigatório' }, 400)

      // As mensagens ainda não processadas desta conversa são a âncora de idempotência
      // da RPC — com array vazio ela devolveria NULL e NÃO inseriria nada, perdendo a
      // intenção de compra em silêncio. Ancorar também evita registro duplicado: o que a
      // secretária consome aqui não volta na fila do W2 para virar um segundo resumo do
      // mesmo papo.
      const { data: pendentes } = await admin
        .from('mensagens_whatsapp')
        .select('message_id')
        .eq('telefone_wa', telefoneWa)
        .is('processado_em', null)
        .eq('historico', false)

      const messageIds = (pendentes ?? []).map((m) => m.message_id)

      // NÃO cria venda de propósito. Venda criada por IA viraria estoque baixado e
      // recebível fantasma. Aqui só fica o registro na timeline; quem transforma em venda
      // é um humano, no sistema.
      const { data, error } = await admin.rpc('rpc_registrar_interacao_ia', {
        p_telefone_wa: telefoneWa,
        p_payload: {
          tipo: 'ponto_contato',
          sentido: 'entrada',
          resultado: 'aceitou',
          observacao: `[intenção de compra] ${resumo}`,
        },
        p_message_ids: messageIds,
      })

      if (error) return json({ error: error.message }, 400)

      // `registrada: false` = não havia mensagem pendente para ancorar (o W2 chegou
      // antes). O aviso no canal interno sai do mesmo jeito — é ele que faz o humano
      // agir — mas fica explícito aqui em vez de sumir.
      return json({ ok: true, interacao_id: data, registrada: data !== null }, 200)
    }

    if (body.acao === 'preparar_envio') {
      const texto = typeof body.texto === 'string' ? body.texto : ''
      if (!texto.trim()) return json({ error: 'texto é obrigatório' }, 400)

      // Existe para o nó Code do n8n NÃO virar a terceira cópia da regra de tempo.
      // Este projeto já foi mordido exatamente assim: a canonicalização de telefone
      // ganhou uma cópia dentro de um nó, nasceu com um regex errado e descartou um
      // cliente em silêncio. Uma chamada HTTP é barata; uma regra divergente não.
      const partes = particionarResposta(texto)
      return json({
        ok: true,
        partes,
        tempos_ms: partes.map((p) => calcularTempoDigitacaoMs(p)),
      }, 200)
    }

    if (body.acao === 'destino_aviso') {
      // O id do grupo é constante VALIDADA, nunca campo livre: dos grupos visíveis na
      // conta, um tem 281 participantes (workshop externo). Id errado publicaria pedido
      // de cliente, com nome e valor, para 281 estranhos.
      const grupo = Deno.env.get('SECRETARIA_GRUPO_AVISO') ?? ''
      const fallbackDev = '5511934417085@s.whatsapp.net'
      const ehGrupoValido = grupo.endsWith('@g.us')

      // Enquanto o número da Mont não estiver no grupo da equipe, o aviso vai para o
      // Luccas — que assim vê as duas pontas na mesma tela durante o desenvolvimento.
      return json({
        ok: true,
        jid: ehGrupoValido ? grupo : fallbackDev,
        tipo: ehGrupoValido ? 'grupo' : 'fallback_dev',
      }, 200)
    }

    return json({
      error: "acao inválida",
      acoes: [
        'contexto', 'registrar_envio', 'consultar_produto', 'consultar_frete',
        'registrar_pedido_intencao', 'preparar_envio', 'destino_aviso',
      ],
    }, 400)
  } catch (e) {
    console.error('[whatsapp-secretaria]', e)
    return json({ error: (e as Error).message }, 500)
  }
})
