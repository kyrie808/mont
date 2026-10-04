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
  type Resolucao,
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

  // Uma leitura só, reaproveitada abaixo — `pedido_atual` e `catalogo` usavam duas
  // consultas idênticas ao Postgres para a mesma mensagem recebida.
  const catalogo = await lerCatalogo(admin)

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
      return renderizarPedido(await lerItens(admin, r.id, catalogo))
    })(),
    catalogo,
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
    const { error: erroReabrir } = await admin
      .from('wa_pedido').update({ status: 'rascunho' }).eq('id', recemConfirmado.id)
    if (erroReabrir) {
      // Mesmo padrao estrutural do Critical: se o UPDATE falhar e devolvermos
      // `status: 'rascunho'` do mesmo jeito, a chamada seguinte grava item num pedido
      // que o banco ainda acha `confirmado` — e a proxima `lerRascunho` nao acha nada.
      console.error('[secretaria] falha ao reabrir pedido confirmado:', erroReabrir.message)
      throw new Error('nao foi possivel reabrir o pedido')
    }
    return { ...recemConfirmado, status: 'rascunho' }
  }

  const { data, error } = await admin
    .from('wa_pedido')
    .insert({ contato_id: contatoId, telefone_wa: telefoneWa })
    .select('id, status, interacao_id')
    .single()

  if (error) {
    // Corrida: duas execucoes do workflow para o MESMO contato batem no indice unico
    // parcial `uniq_wa_pedido_aberto` (ja aconteceu em campo, documentado na migration
    // dela). Nao e erro de verdade — a outra execucao acabou de abrir o rascunho que
    // esta precisava. Reler em vez de derrubar a chamada com 500.
    if (error.code === '23505') {
      const ganhou = await lerRascunho(admin, contatoId)
      if (ganhou) return ganhou
    }
    console.error('[secretaria] falha ao abrir rascunho:', error.message)
    throw new Error('nao foi possivel abrir o pedido')
  }
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
 * Os produtos que estão nas LINHAS de um pedido, sem o filtro de vitrine (`ativo` e
 * `visivel_catalogo`) que `lerCatalogo` aplica.
 *
 * Existe só para `remover_item`/`alterar_quantidade` conseguirem resolver o termo do
 * cliente contra um produto que já está no rascunho dele mesmo depois de esse produto
 * sair do catálogo vendável no meio da conversa (desativado ou tirado da vitrine) — tirar
 * item do pedido tem que funcionar sempre, mesmo quando adicionar não funcionaria mais.
 */
async function lerProdutosDoPedido(admin: SupabaseClient, pedidoId: string): Promise<ProdutoVendavel[]> {
  const { data: itens } = await admin
    .from('wa_pedido_item')
    .select('produto_id')
    .eq('pedido_id', pedidoId)

  const ids = (itens ?? []).map((i) => i.produto_id as string)
  if (ids.length === 0) return []

  const { data } = await admin
    .from('produtos')
    .select('id, nome, apelido, preco, estoque_atual')
    .in('id', ids)

  return (data ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    apelido: (p.apelido ?? null) as string | null,
    preco: Number(p.preco ?? 0),
    estoqueAtual: Number(p.estoque_atual ?? 0),
  }))
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

function respostaDaResolucao(r: Resolucao): Traduzido {
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
        //
        // `humanoAssumiu` (mesma funcao de `montarContexto`) e a que tem JANELA de
        // tempo — uma resposta humana de semana passada dentro das ultimas mensagens
        // NAO pode calar o alerta para sempre. Reimplementar isto a mao sem a janela foi
        // o bug: bastava UMA resposta humana antiga pra marcar `abandonado` em silencio
        // e o aviso nunca sair.
        const { data: msgs } = await admin
          .from('mensagens_whatsapp')
          .select('message_id, direcao, enviada_em')
          .eq('telefone_wa', p.telefone_wa).eq('historico', false)
          .order('enviada_em', { ascending: false }).limit(MAX_MENSAGENS_CONTEXTO)

        const { data: envios } = await admin
          .from('wa_envios').select('message_id').eq('telefone_wa', p.telefone_wa)
        const idsDaAgente = new Set((envios ?? []).map((e) => e.message_id))

        const paraRegra: MensagemDaConversa[] = (msgs ?? []).map((m) => ({
          messageId: m.message_id,
          direcao: m.direcao as 'entrada' | 'saida',
          enviadaEm: m.enviada_em,
        }))

        if (humanoAssumiu(paraRegra, idsDaAgente)) {
          const { error: erroAbandono } = await admin
            .from('wa_pedido').update({ status: 'abandonado' }).eq('id', p.id)
          if (erroAbandono) {
            console.error('[secretaria] falha ao marcar rascunho como abandonado (humano):', erroAbandono.message)
          }
          continue
        }

        const { data: c } = await admin
          .from('contatos').select('nome').eq('id', p.contato_id).maybeSingle()

        const { error: erroAbandono } = await admin
          .from('wa_pedido').update({ status: 'abandonado' }).eq('id', p.id)
        if (erroAbandono) {
          console.error('[secretaria] falha ao marcar rascunho como abandonado:', erroAbandono.message)
        }

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

      // Usa a MESMA resolução curada das ferramentas de pedido, não `ilike` no nome.
      //
      // Com busca por pedaço do nome, "pão de queijo" casava também com "Massa Pão de
      // Queijo" — que é massa CRUA. Em 03/10 isso apareceu numa conversa real: o cliente
      // pediu pão de queijo e ela ofereceu o Baldinho e o Balde junto, que é exatamente o
      // que a curadoria de sinônimos existe para evitar.
      //
      // O que ela pode COTAR e o que ela pode ADICIONAR tem que ser a mesma lista. Produto
      // sem apelido fica fora das duas — de propósito: cotar o que não dá para adicionar
      // seria pior que não achar.
      const catalogo = await lerCatalogo(admin)
      const r = resolverTermo(termo, catalogo)

      const achados = r.tipo === 'resolvido' ? [r.produto] : r.opcoes

      return json({
        ok: true,
        produtos: achados.map((p) => ({ nome: p.nome, preco: p.preco })),
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
        let resolucao = resolverTermo(termo, catalogo)

        // Nao encontrou no catalogo vendavel: antes de desistir, se a acao e tirar ou
        // ajustar quantidade, tenta de novo contra os produtos que JA ESTAO no pedido
        // (mesmo que um deles tenha sido desativado/tirado da vitrine no meio da
        // conversa). So substitui a resolucao quando esse segundo chute RESOLVE — um
        // resultado ambiguo aqui nao e mais claro que o "nao encontrado" original.
        if (
          resolucao.tipo === 'nao_encontrado' &&
          (body.acao === 'remover_item' || body.acao === 'alterar_quantidade')
        ) {
          const rascunhoAtual = await lerRascunho(admin, contato.id)
          const produtosNoPedido = rascunhoAtual ? await lerProdutosDoPedido(admin, rascunhoAtual.id) : []
          const resolucaoNoPedido = resolverTermo(termo, produtosNoPedido)
          if (resolucaoNoPedido.tipo === 'resolvido') resolucao = resolucaoNoPedido
        }

        const r = respostaDaResolucao(resolucao)
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
      // Vocabulario controlado: texto cru do Postgres nao sai daqui. Nada impede a
      // agente de repetir a resposta ao cliente, e "duplicate key value violates unique
      // constraint..." nao e coisa pra cliente ler.
      if (error) {
        console.error('[secretaria] falha ao gravar item do pedido:', error.message)
        return json({ error: 'nao foi possivel gravar o item do pedido' }, 400)
      }

      return json(await responderPedido(admin, pedido.id, catalogo), 200)
    }

    if (body.acao === 'confirmar_pedido') {
      const { data: contato } = await admin
        .from('contatos').select('id, nome').eq('telefone_wa', telefoneWa).maybeSingle()
      if (!contato) return json({ error: 'contato_nao_casado' }, 404)

      const pedido = await lerRascunho(admin, contato.id)
      if (!pedido) {
        // Mesmo vocabulario controlado das outras recusas (ambiguo/nao_encontrado): sem
        // `instrucao` aqui a agente ficava sem orientacao justo quando o cliente acha que
        // tem um pedido de pe (ex.: sumiu 35min, o rascunho virou `abandonado` sozinho, e
        // ele volta dizendo "pode confirmar"). Nao ressuscita o rascunho antigo aqui —
        // so orienta a remontar do zero.
        return json({
          ok: false,
          motivo: 'sem_pedido_aberto',
          instrucao: 'Nao ha pedido aberto. Nao confirme nada. Diga ao cliente que voce nao encontrou pedido em aberto e pergunte o que ele quer, para montar de novo.',
        }, 200)
      }

      const catalogo = await lerCatalogo(admin)
      const itens = await lerItens(admin, pedido.id, catalogo)
      if (itens.length === 0) {
        return json({
          ok: false,
          motivo: 'pedido_vazio',
          instrucao: 'O pedido esta aberto mas sem nenhum item. Nao confirme nada. Pergunte ao cliente o que ele quer para montar o pedido.',
        }, 200)
      }

      const texto = renderizarPedido(itens)
      const observacao = `[pedido confirmado] ${itens.map((i) => `${i.quantidade}x ${i.nome}`).join(' + ')}`

      // Reabertura: ATUALIZA a linha da timeline que ja existe, em vez de criar outra.
      // O perfil do cliente mostra o pedido, nao tres versoes dele se montando.
      let interacaoId = pedido.interacao_id as string | null
      // O que aconteceu ao gravar a interacao — vai na resposta pra `ok:true` nunca
      // significar "confirmei sem deixar rastro na timeline".
      let timeline: 'atualizado' | 'rpc' | 'direto' | 'falhou'

      if (interacaoId) {
        timeline = 'atualizado'
        const { error: erroUpdate } = await admin
          .from('interacoes').update({ observacao }).eq('id', interacaoId)
        if (erroUpdate) {
          // Nao fatal: a linha da timeline JA EXISTE (é ela que estamos tentando
          // atualizar) — so o texto ficou desatualizado, nao é o caso critico.
          console.error('[secretaria] falha ao atualizar observacao da interacao existente:', erroUpdate.message)
        }
      } else {
        const { data: pendentes } = await admin
          .from('mensagens_whatsapp').select('message_id')
          .eq('telefone_wa', telefoneWa).is('processado_em', null).eq('historico', false)

        const { data: novaId, error: erroRpc } = await admin.rpc('rpc_registrar_interacao_ia', {
          p_telefone_wa: telefoneWa,
          p_payload: { tipo: 'ponto_contato', sentido: 'entrada', resultado: 'aceitou', observacao },
          p_message_ids: (pendentes ?? []).map((m) => m.message_id),
        })
        if (erroRpc) console.error('[secretaria] rpc_registrar_interacao_ia falhou ao confirmar pedido:', erroRpc.message)

        interacaoId = (novaId as string | null) ?? null
        timeline = interacaoId ? 'rpc' : 'falhou'

        if (!interacaoId) {
          // A RPC devolve NULL DE PROPOSITO quando nenhuma mensagem pendente ancora o
          // registro — existe pra nao duplicar RESUMO DE CONVERSA com o que o W2 consome
          // da MESMA fila (mensagens_whatsapp.processado_em). Mas um PEDIDO CONFIRMADO e
          // evento proprio, nao resumo de conversa: precisa existir na timeline mesmo
          // quando o W2 ja passou e esvaziou a fila. Por isso, sem ancora, inserimos a
          // interacao direto em vez de deixar o pedido confirmar em silencio sem nunca
          // aparecer no Kanban/perfil do cliente (era exatamente esse o bug: `ok:true`
          // indistinguivel de sucesso, sem nenhuma linha em `interacoes`).
          const { data: direto, error: erroDireto } = await admin
            .from('interacoes')
            .insert({
              contato_id: contato.id,
              tipo: 'ponto_contato',
              canal: 'whatsapp',
              sentido: 'entrada',
              resultado: 'aceitou',
              observacao,
              gerado_por_ia: true,
            })
            .select('id')
            .single()

          if (erroDireto) {
            console.error('[secretaria] insert direto da interacao tambem falhou:', erroDireto.message)
          } else {
            interacaoId = direto.id as string
            timeline = 'direto'
          }
        }
      }

      // Nem RPC nem insert direto conseguiram gravar a interacao: NAO marca o pedido
      // como confirmado. `ok:true` aqui seria a agente dizer ao cliente que confirmou um
      // pedido que nunca apareceu na timeline nem moveu o Kanban.
      if (timeline === 'falhou') {
        return json({
          ok: false,
          motivo: 'falha_ao_registrar_timeline',
          erro: 'nao foi possivel registrar o pedido na timeline do cliente',
        }, 500)
      }

      const { error: erroConfirmar } = await admin.from('wa_pedido').update({
        status: 'confirmado',
        confirmado_em: new Date().toISOString(),
        interacao_id: interacaoId,
      }).eq('id', pedido.id)

      if (erroConfirmar) {
        console.error('[secretaria] falha ao marcar pedido como confirmado:', erroConfirmar.message)
        return json({
          ok: false,
          motivo: 'falha_ao_confirmar',
          erro: 'o pedido ficou registrado na timeline, mas nao foi marcado como confirmado',
        }, 500)
      }

      return json({
        ok: true,
        atualizacao: pedido.interacao_id !== null,
        timeline,
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
