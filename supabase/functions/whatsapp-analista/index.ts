// Edge Function: whatsapp-analista  (apoio do W2)
//
// Duas ações finas, chamadas pelo workflow do n8n:
//   • `fila`      → conversas prontas para análise (com as mensagens e os message_ids)
//   • `registrar` → repassa o veredito do LLM para a RPC validadora
//
// POR QUE ESTA FUNÇÃO EXISTE: o analista roda no n8n (decisão do diretor — nós de IA
// nativos, prompt editável na tela). Mas dar `service_role` ao n8n significaria a chave
// mestra do banco morando fora do repo, num container local, dentro de credencial de
// workflow. Estes dois endpoints dão ao n8n exatamente o que ele precisa e nada além:
// ler a fila e gravar um registro validado. A regra continua no git.
//
// Protegida pelo mesmo `x-ingestor-secret` do whatsapp-ingestor: é o mesmo chamador
// (n8n local) falando com o mesmo projeto, então um segredo só.
//
// Segredos:
//   INGESTOR_SECRET — compartilhado com o n8n
//   ANALISTA_JANELA_MIN — minutos de silêncio até a conversa virar analisável (default 30)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — injetados pelo runtime

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Teto por rodada. Segura custo de LLM e mantém a resposta num tamanho sadio.
const MAX_CONVERSAS = 20
// Uma conversa longa não precisa ir inteira pro prompt: as últimas mensagens carregam
// o desfecho, que é o que vira resumo.
const MAX_MENSAGENS_POR_CONVERSA = 40

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

interface LinhaPendente {
  message_id: string
  contato_id: string
  telefone_wa: string
  direcao: 'entrada' | 'saida'
  conteudo: string | null
  tipo_midia: string
  enviada_em: string
}

interface Conversa {
  contato_id: string
  telefone_wa: string
  nome: string | null
  message_ids: string[]
  /** Determinístico: quem mandou a ÚLTIMA mensagem. Não vai para o LLM decidir. */
  sentido: 'entrada' | 'saida'
  total_mensagens: number
  mensagens: Array<{ de: 'cliente' | 'nos'; texto: string; em: string }>
}

/**
 * Conversas com mensagem não processada e silêncio suficiente.
 *
 * A janela de silêncio é o coração da coisa: rodar o LLM a cada "oi" gera custo e um
 * resumo inútil. Esperar a conversa esfriar produz o registro que um vendedor escreveria
 * depois de desligar o telefone.
 */
async function montarFila(admin: SupabaseClient, janelaMin: number): Promise<Conversa[]> {
  const { data, error } = await admin
    .from('mensagens_whatsapp')
    .select('message_id, contato_id, telefone_wa, direcao, conteudo, tipo_midia, enviada_em')
    .is('processado_em', null)
    .eq('historico', false) // redundante com o índice, explícito por intenção
    .not('contato_id', 'is', null)
    .order('enviada_em', { ascending: true })
    .limit(2000)
    .returns<LinhaPendente[]>()

  if (error) throw new Error(`Falha ao ler a fila: ${error.message}`)
  if (!data || data.length === 0) return []

  const porContato = new Map<string, LinhaPendente[]>()
  for (const linha of data) {
    const lista = porContato.get(linha.contato_id) ?? []
    lista.push(linha)
    porContato.set(linha.contato_id, lista)
  }

  const limite = Date.now() - janelaMin * 60_000
  const prontas: Conversa[] = []

  for (const [contatoId, linhas] of porContato) {
    const ultima = linhas[linhas.length - 1]
    // Conversa ainda quente: deixa esfriar para a próxima rodada.
    if (new Date(ultima.enviada_em).getTime() > limite) continue

    const recorte = linhas.slice(-MAX_MENSAGENS_POR_CONVERSA)

    prontas.push({
      contato_id: contatoId,
      telefone_wa: ultima.telefone_wa,
      nome: null, // preenchido abaixo, num único select
      // TODOS os ids entram, não só os do recorte: o que não vira prompt ainda tem que
      // sair da fila, senão a conversa volta pra sempre.
      message_ids: linhas.map((l) => l.message_id),
      sentido: ultima.direcao,
      total_mensagens: linhas.length,
      mensagens: recorte.map((l) => ({
        de: l.direcao === 'entrada' ? 'cliente' : 'nos',
        texto: l.conteudo ?? `[${l.tipo_midia}]`,
        em: l.enviada_em,
      })),
    })

    if (prontas.length >= MAX_CONVERSAS) break
  }

  if (prontas.length === 0) return []

  const { data: contatos } = await admin
    .from('contatos')
    .select('id, nome')
    .in('id', prontas.map((c) => c.contato_id))

  const nomePorId = new Map((contatos ?? []).map((c) => [c.id, c.nome]))
  for (const c of prontas) c.nome = nomePorId.get(c.contato_id) ?? null

  return prontas
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
    const acao = body.acao

    if (acao === 'fila') {
      const janela = Number(Deno.env.get('ANALISTA_JANELA_MIN') ?? '30')
      const conversas = await montarFila(admin, Number.isFinite(janela) ? janela : 30)
      return json({ ok: true, janela_min: janela, conversas }, 200)
    }

    if (acao === 'registrar') {
      const { telefone_wa, analise, message_ids } = body as {
        telefone_wa?: string; analise?: unknown; message_ids?: string[]
      }
      if (!telefone_wa || !Array.isArray(message_ids) || message_ids.length === 0) {
        return json({ error: 'telefone_wa e message_ids são obrigatórios' }, 400)
      }

      // Passa direto pra RPC. Nenhuma validação de vocabulário aqui DE PROPÓSITO:
      // duplicar a regra é como ela diverge. A RPC é o portão.
      const { data, error } = await admin.rpc('rpc_registrar_interacao_ia', {
        p_telefone_wa: telefone_wa,
        p_payload: analise ?? {},
        p_message_ids: message_ids,
      })

      if (error) return json({ error: error.message }, 400)

      // `null` = as mensagens já tinham sido processadas (guarda de idempotência da RPC).
      return json({ ok: true, interacao_id: data, ja_processada: data === null }, 200)
    }

    return json({ error: "acao deve ser 'fila' ou 'registrar'" }, 400)
  } catch (e) {
    console.error('[whatsapp-analista]', e)
    return json({ error: (e as Error).message }, 500)
  }
})
