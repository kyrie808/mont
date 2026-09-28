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
import {
  resolverTermo,
  renderizarPedido,
  totalPedido,
  formatarReais,
  type ProdutoVendavel,
  type ItemPedido,
} from '../../../packages/shared/src/catalogo.ts'

// ⚠️ `formatarReais` é o helper `reais` de `catalogo.ts`, exportado nesta tarefa (hoje ele
// é privado do módulo). NÃO trocar por `formatCurrency` de `formatters.ts`: aquele usa
// Intl e produz espaço não-separável (U+00A0), ruim em texto de WhatsApp.

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
async function lerCatalogo(admin: SupabaseClient): Promise<ProdutoVendavel[]> {
  const { data } = await admin
    .from('produtos')
    .select('id, nome, apelido, preco, estoque_atual')
    .eq('ativo', true)
    .eq('visivel_catalogo', true)
    .order('nome')

  return (data ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    apelido: (p.apelido ?? null) as string | null,
    preco: Number(p.preco ?? 0),
    estoqueAtual: Number(p.estoque_atual ?? 0),
  }))
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

  // Todas as mensagens do cliente desde a nossa última fala — não só a que disparou
  // esta execução. Numa rajada de 5, as 4 primeiras morrem no debounce, e marcar só a
  // última como lida deixa 4 mensagens com o check cinza para sempre: o cliente vê que
  // respondemos sem ter "lido" o que ele escreveu, que é pior que não marcar nada.
  const naoLidas: string[] = []
  for (let i = ordenadas.length - 1; i >= 0; i--) {
    if (ordenadas[i].direcao !== 'entrada') break
    naoLidas.unshift(ordenadas[i].message_id)
  }

  if (humanoAssumiu(paraRegra, idsDaAgente)) {
    // Devolve a conversa mesmo assim: o aviso no canal interno cita a última mensagem
    // do cliente, e sem isso o n8n teria que pedir o contexto de novo.
    return { pode_responder: false, motivo: 'humano_assumiu' as const, contato, conversa, nao_lidas: naoLidas }
  }

  return {
    pode_responder: true,
    motivo: 'ok' as const,
    contato,
    conversa,
    nao_lidas: naoLidas,
    // O rascunho vai como FATO, derivado das linhas. A agente nao deduz pedido da conversa.
    pedido_atual: await (async () => {
      const r = await lerRascunho(admin, contato.id)
      if (!r) return null
      const cat = await lerCatalogo(admin)
      return renderizarPedido(await lerItens(admin, r.id, cat))
    })(),
    catalogo: await lerCatalogo(admin),
  }
}

/** O rascunho aberto do contato, ou `null`. Nunca cria. */
async function lerRascunho(admin: SupabaseClient, contatoId: string) {
  const { data } = await admin
    .from('wa_pedido')
    .select('id, status, interacao_id')
    .eq('contato_id', contatoId)
    .eq('status', 'rascunho')
    .maybeSingle()
  return data
}

/**
 * Por quanto tempo depois de confirmar o cliente ainda esta no MESMO pedido.
 *
 * "Ah, esqueci, poe mais 1 kg" dois minutos depois e a mesma compra; um pedido novo na
 * semana seguinte nao e. Sem esse prazo, ou toda mensagem reabriria o pedido antigo para
 * sempre, ou a equipe receberia dois CONFIRMADO para uma entrega so.
 */
const JANELA_REABERTURA_MS = 2 * 60 * 60 * 1000

/**
 * O pedido em que os itens devem entrar: o rascunho aberto, ou o confirmado ha pouco
 * REABERTO, ou um novo.
 *
 * A reabertura preserva `interacao_id` — e ele que faz a confirmacao seguinte ATUALIZAR a
 * linha da timeline em vez de criar outra, e o aviso sair como ATUALIZADO em vez de um
 * segundo CONFIRMADO.
 */
async function abrirRascunho(admin: SupabaseClient, contatoId: string, telefoneWa: string) {
  const existente = await lerRascunho(admin, contatoId)
  if (existente) return existente

  const desde = new Date(Date.now() - JANELA_REABERTURA_MS).toISOString()
  const { data: recemConfirmado } = await admin
    .from('wa_pedido')
    .select('id, status, interacao_id')
    .eq('contato_id', contatoId)
    .eq('status', 'confirmado')
    .gte('confirmado_em', desde)
    .order('confirmado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recemConfirmado) {
    await admin.from('wa_pedido').update({ status: 'rascunho' }).eq('id', recemConfirmado.id)
    return { ...recemConfirmado, status: 'rascunho' }
  }

  const { data, error } = await admin
    .from('wa_pedido')
    .insert({ contato_id: contatoId, telefone_wa: telefoneWa })
    .select('id, status, interacao_id')
    .single()

  if (error) throw new Error(`nao foi possivel abrir o pedido: ${error.message}`)
  return data
}

/** Itens do pedido, já com o alerta de estoque resolvido contra o catálogo. */
async function lerItens(
  admin: SupabaseClient,
  pedidoId: string,
  catalogo: ProdutoVendavel[],
): Promise<ItemPedido[]> {
  const { data } = await admin
    .from('wa_pedido_item')
    .select('produto_id, quantidade, preco_unitario')
    .eq('pedido_id', pedidoId)
    .order('criado_em')

  return (data ?? []).map((i) => {
    const p = catalogo.find((c) => c.id === i.produto_id)
    return {
      produtoId: i.produto_id as string,
      nome: p?.nome ?? '(produto removido do catálogo)',
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.preco_unitario),
      semEstoque: (p?.estoqueAtual ?? 0) <= 0,
    }
  })
}

/**
 * Resposta padrão de toda mutação: o pedido INTEIRO, renderizado.
 *
 * A agente nunca soma nem formata — ela repete isto. Foi ela escrevendo o pedido de
 * cabeça que somou o pedido da véspera e anotou 4 kg onde o cliente pediu 2 kg.
 */
async function responderPedido(admin: SupabaseClient, pedidoId: string, catalogo: ProdutoVendavel[]) {
  const itens = await lerItens(admin, pedidoId, catalogo)
  await admin.from('wa_pedido').update({ atualizado_em: new Date().toISOString() }).eq('id', pedidoId)

  return {
    ok: true,
    pedido: renderizarPedido(itens),
    total: totalPedido(itens),
    // Total JÁ FORMATADO, pelo mesmo formatador que escreve os subtotais das linhas.
    // Se o n8n formatasse por conta própria, existiriam três formatadores de moeda no
    // caminho e o rodapé poderia divergir das linhas em um centavo — e quem separa o
    // pedido não saberia em qual acreditar.
    total_texto: formatarReais(totalPedido(itens)),
    itens: itens.length,
  }
}

/**
 * Traduz a resolução do termo em resposta para a agente.
 *
 * União discriminada de propósito: com `{ produto, resposta }` o TypeScript não consegue
 * provar que `produto` não é nulo depois de checar `resposta`, e a saída seria um `as`
 * — proibido pela Regra de Ouro #1.
 */
type Traduzido =
  | { tipo: 'segue'; produto: ProdutoVendavel }
  | { tipo: 'responde'; corpo: Record<string, unknown> }

function respostaDaResolucao(termo: string, catalogo: ProdutoVendavel[]): Traduzido {
  const r = resolverTermo(termo, catalogo)

  if (r.tipo === 'resolvido') return { tipo: 'segue', produto: r.produto }

  const opcoes = r.opcoes.map((p) => ({ id: p.id, nome: p.nome, preco: p.preco }))

  if (r.tipo === 'ambiguo') {
    return {
      tipo: 'responde',
      corpo: {
        ok: false,
        motivo: 'ambiguo',
        opcoes,
        instrucao: 'Pergunte ao cliente qual destes ele quer. NAO escolha por ele. NAO grave nada. Se o cliente citou MAIS DE UM produto na mesma frase, chame a ferramenta uma vez por produto em vez de perguntar.',
      },
    }
  }

  return {
    tipo: 'responde',
    corpo: {
      ok: false,
      motivo: 'nao_encontrado',
      opcoes,
      instrucao: opcoes.length > 0
        ? 'A Mont nao vende essa embalagem. Diga ao cliente quais existem, listadas em opcoes.'
        : 'A Mont nao vende esse produto. Diga isso ao cliente. NAO ofereca substituto que nao esteja no catalogo.',
    },
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

  // Consultada pelo W4. Rascunho parado, com item, em conversa que nenhum humano tocou.
  //
  // ⚠️ GLOBAL: varre todos os contatos, não recebe `jid` nem `telefone_wa` — por isso vem
  // ANTES do guard de `telefoneWa` obrigatório abaixo, que mataria esta chamada.
  if (body.acao === 'rascunhos_abandonados') {
    try {
      const minutos = typeof body.minutos === 'number' ? body.minutos : 30
      const limite = new Date(Date.now() - minutos * 60_000).toISOString()

      const { data: parados } = await admin
        .from('wa_pedido')
        .select('id, contato_id, telefone_wa')
        .eq('status', 'rascunho')
        .lt('atualizado_em', limite)

      const catalogo = await lerCatalogo(admin)
      const saida: unknown[] = []

      for (const p of parados ?? []) {
        const itens = await lerItens(admin, p.id, catalogo)
        if (itens.length === 0) continue

        // Guarda: humano atendendo nao vira alerta de abandono. Sem isto o robo avisaria
        // o grupo sobre um cliente que o Gilmar ja esta atendendo.
        const { data: msgs } = await admin
          .from('mensagens_whatsapp')
          .select('message_id, direcao, enviada_em')
          .eq('telefone_wa', p.telefone_wa).eq('historico', false)
          .order('enviada_em', { ascending: false }).limit(MAX_MENSAGENS_CONTEXTO)

        const { data: envios } = await admin
          .from('wa_envios').select('message_id').eq('telefone_wa', p.telefone_wa)
        const idsDaAgente = new Set((envios ?? []).map((e) => e.message_id))

        const humano = (msgs ?? []).some(
          (m) => m.direcao === 'saida' && !idsDaAgente.has(m.message_id),
        )

        if (humano) {
          await admin.from('wa_pedido').update({ status: 'abandonado' }).eq('id', p.id)
          continue
        }

        const { data: c } = await admin
          .from('contatos').select('nome').eq('id', p.contato_id).maybeSingle()

        await admin.from('wa_pedido').update({ status: 'abandonado' }).eq('id', p.id)

        saida.push({
          telefone_wa: p.telefone_wa,
          contato: c?.nome ?? 'Cliente',
          pedido: renderizarPedido(itens),
          total: totalPedido(itens),
        })
      }

      return json({ ok: true, abandonados: saida }, 200)
    } catch (e) {
      console.error('[whatsapp-secretaria]', e)
      return json({ error: (e as Error).message }, 500)
    }
  }

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

    if (
      body.acao === 'adicionar_item' ||
      body.acao === 'alterar_quantidade' ||
      body.acao === 'remover_item'
    ) {
      const termo = typeof body.termo === 'string' ? body.termo : ''
      const produtoIdDireto = typeof body.produto_id === 'string' ? body.produto_id : ''
      if (!termo && !produtoIdDireto) return json({ error: 'termo ou produto_id e obrigatorio' }, 400)

      const { data: contato } = await admin
        .from('contatos').select('id').eq('telefone_wa', telefoneWa).maybeSingle()
      if (!contato) return json({ error: 'contato_nao_casado' }, 404)

      const catalogo = await lerCatalogo(admin)

      // `produto_id` vem de uma resposta `ambiguo` anterior: o cliente ja escolheu, nao ha
      // o que resolver de novo.
      let produto = produtoIdDireto ? catalogo.find((p) => p.id === produtoIdDireto) : undefined
      if (!produto) {
        const r = respostaDaResolucao(termo, catalogo)
        if (r.tipo === 'responde') return json(r.corpo, 200)
        produto = r.produto
      }

      const pedido = await abrirRascunho(admin, contato.id, telefoneWa)

      if (body.acao === 'remover_item') {
        await admin.from('wa_pedido_item').delete()
          .eq('pedido_id', pedido.id).eq('produto_id', produto.id)
        return json(await responderPedido(admin, pedido.id, catalogo), 200)
      }

      const quantidade = Number(body.quantidade)
      if (!Number.isInteger(quantidade) || quantidade < 1) {
        return json({ error: 'quantidade deve ser inteiro maior que zero' }, 400)
      }

      // `upsert` pelo indice unico (pedido_id, produto_id): adicionar de novo o mesmo
      // produto ALTERA a quantidade em vez de criar segunda linha. As duas acoes se
      // comportam igual de proposito — e a unica representacao possivel no banco.
      const { error } = await admin.from('wa_pedido_item').upsert(
        {
          pedido_id: pedido.id,
          produto_id: produto.id,
          quantidade,
          preco_unitario: produto.preco,
        },
        { onConflict: 'pedido_id,produto_id' },
      )
      if (error) return json({ error: error.message }, 400)

      return json(await responderPedido(admin, pedido.id, catalogo), 200)
    }

    if (body.acao === 'confirmar_pedido') {
      const { data: contato } = await admin
        .from('contatos').select('id, nome').eq('telefone_wa', telefoneWa).maybeSingle()
      if (!contato) return json({ error: 'contato_nao_casado' }, 404)

      const pedido = await lerRascunho(admin, contato.id)
      if (!pedido) return json({ ok: false, motivo: 'sem_pedido_aberto' }, 200)

      const catalogo = await lerCatalogo(admin)
      const itens = await lerItens(admin, pedido.id, catalogo)
      if (itens.length === 0) return json({ ok: false, motivo: 'pedido_vazio' }, 200)

      const texto = renderizarPedido(itens)
      const observacao = `[pedido confirmado] ${itens.map((i) => `${i.quantidade}x ${i.nome}`).join(' + ')}`

      // Reabertura: ATUALIZA a linha da timeline que ja existe, em vez de criar outra.
      // O perfil do cliente mostra o pedido, nao tres versoes dele se montando.
      let interacaoId = pedido.interacao_id as string | null
      if (interacaoId) {
        await admin.from('interacoes').update({ observacao }).eq('id', interacaoId)
      } else {
        const { data: pendentes } = await admin
          .from('mensagens_whatsapp').select('message_id')
          .eq('telefone_wa', telefoneWa).is('processado_em', null).eq('historico', false)

        const { data: novaId } = await admin.rpc('rpc_registrar_interacao_ia', {
          p_telefone_wa: telefoneWa,
          p_payload: { tipo: 'ponto_contato', sentido: 'entrada', resultado: 'aceitou', observacao },
          p_message_ids: (pendentes ?? []).map((m) => m.message_id),
        })
        interacaoId = novaId as string | null
      }

      await admin.from('wa_pedido').update({
        status: 'confirmado',
        confirmado_em: new Date().toISOString(),
        interacao_id: interacaoId,
      }).eq('id', pedido.id)

      return json({
        ok: true,
        atualizacao: pedido.interacao_id !== null,
        pedido: texto,
        total: totalPedido(itens),
        total_texto: formatarReais(totalPedido(itens)),
        contato: contato.nome,
        telefone_wa: telefoneWa,
      }, 200)
    }

    if (body.acao === 'preparar_envio') {
      const texto = typeof body.texto === 'string' ? body.texto : ''
      if (!texto.trim()) return json({ error: 'texto é obrigatório' }, 400)

      // Última barreira antes do cliente: resposta com entulho de modelo NÃO sai.
      //
      // Aconteceu de verdade com o Llama 3.3 no Groq — ele escreveu a chamada da tool
      // como texto em vez de executá-la, e o cliente recebeu
      // "Vou verificar o frete. <function=consultar_frete></function>".
      //
      // Rejeitar em vez de limpar: quando o modelo escreve a chamada, ele NÃO executou
      // a ferramenta, então a resposta está incompleta — faltou justamente o dado que
      // ele ia buscar. Enviar o pedaço limpo seria enviar meia informação. Cair no ramo
      // de erro faz a equipe ser avisada e um humano responder direito.
      if (/<\/?function|<tool_call|<\|python_tag\|>|\[TOOL_CALL\]|<invoke\b/i.test(texto)) {
        console.error('[secretaria] resposta com entulho de tool call, bloqueada:', texto.slice(0, 200))
        return json({ error: 'resposta_malformada', detalhe: 'modelo emitiu tool call como texto' }, 422)
      }

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
      //
      // Devolve também o nome do contato: o aviso de FALHA da agente nasce de uma
      // execução que morreu antes de ter contexto, então não teria como citar quem é o
      // cliente. Sem nome, o aviso vira "alguém não foi respondido" e ninguém age.
      const { data: quem } = await admin
        .from('contatos').select('nome').eq('telefone_wa', telefoneWa).maybeSingle()

      return json({
        ok: true,
        jid: ehGrupoValido ? grupo : fallbackDev,
        tipo: ehGrupoValido ? 'grupo' : 'fallback_dev',
        nome: quem?.nome ?? null,
        telefone: telefoneWa,
      }, 200)
    }

    return json({
      error: "acao inválida",
      acoes: [
        'contexto', 'registrar_envio', 'consultar_produto', 'consultar_frete',
        'adicionar_item', 'alterar_quantidade', 'remover_item', 'confirmar_pedido',
        'rascunhos_abandonados', 'preparar_envio', 'destino_aviso',
      ],
    }, 400)
  } catch (e) {
    console.error('[whatsapp-secretaria]', e)
    return json({ error: (e as Error).message }, 500)
  }
})
