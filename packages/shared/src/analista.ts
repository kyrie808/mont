// Analista de conversa do WhatsApp — lógica pura (sem banco, sem rede).
//
// Roda na Edge Function `whatsapp-analista` (ação `rodar`, disparada pelo pg_cron). Mora
// aqui, e não na function, para ser testada com o Vitest como o resto do domínio.
//
// O fluxo é: mensagens pendentes → SEGMENTOS (conversas separadas por silêncio) → um
// prompt por segmento → veredito do LLM VALIDADO aqui → RPC que grava. A RPC continua
// sendo o portão (revalida o vocabulário e a recusa). A validação daqui existe para
// poder pedir uma segunda resposta ao LLM quando a primeira vem ruim.

/** Silêncio que separa duas conversas do mesmo contato. */
export const GAP_SEGMENTO_MS = 6 * 60 * 60 * 1000
/** Silêncio mínimo até a última conversa virar analisável (ela ainda pode continuar). */
export const JANELA_ANALISE_MS = 30 * 60 * 1000
/** Uma conversa longa não vai inteira ao prompt: o desfecho está nas últimas mensagens. */
export const MAX_MENSAGENS_PROMPT = 40
/** Mesmo teto que a RPC aplica na timeline. */
export const MAX_OBSERVACAO = 400

export interface MensagemPendente {
    message_id: string
    contato_id: string
    direcao: 'entrada' | 'saida'
    conteudo: string | null
    tipo_midia: string
    enviada_em: string
    analise_falhas: number
}

export interface Segmento {
    contatoId: string
    /** TODOS os ids do segmento, inclusive os que não couberam no prompt. */
    messageIds: string[]
    inicio: string
    fim: string
    /** Quem mandou a última mensagem. Determinístico: não vai para o LLM decidir. */
    sentido: 'entrada' | 'saida'
    /** Maior contador de falhas entre as mensagens do segmento. */
    falhas: number
    temMensagemDoCliente: boolean
    mensagens: Array<{ de: 'cliente' | 'nos'; texto: string; em: string }>
}

interface OpcoesSegmentar {
    agoraMs: number
    gapMs?: number
    janelaMs?: number
    maxMensagensPrompt?: number
}

/**
 * Divide as mensagens pendentes em conversas e devolve só as prontas para análise,
 * da mais antiga para a mais nova.
 *
 * Sem isto, a reativação de segunda e a resposta de quarta virariam UM ponto de contato
 * datado de quarta: o kanban perderia a tentativa de segunda e a cadência de follow-up
 * contaria errado.
 */
export function segmentar(linhas: MensagemPendente[], opcoes: OpcoesSegmentar): Segmento[] {
    const gapMs = opcoes.gapMs ?? GAP_SEGMENTO_MS
    const janelaMs = opcoes.janelaMs ?? JANELA_ANALISE_MS
    const maxPrompt = opcoes.maxMensagensPrompt ?? MAX_MENSAGENS_PROMPT

    const porContato = new Map<string, MensagemPendente[]>()
    for (const l of linhas) {
        const lista = porContato.get(l.contato_id) ?? []
        lista.push(l)
        porContato.set(l.contato_id, lista)
    }

    const prontos: Segmento[] = []
    for (const [contatoId, lista] of porContato) {
        const ordenadas = [...lista].sort((a, b) => Date.parse(a.enviada_em) - Date.parse(b.enviada_em))

        let atual: MensagemPendente[] = []
        const grupos: MensagemPendente[][] = []
        for (const m of ordenadas) {
            const anterior = atual[atual.length - 1]
            if (anterior && Date.parse(m.enviada_em) - Date.parse(anterior.enviada_em) >= gapMs) {
                grupos.push(atual)
                atual = []
            }
            atual.push(m)
        }
        if (atual.length > 0) grupos.push(atual)

        for (const g of grupos) {
            const ultima = g[g.length - 1]
            // Conversa ainda quente: espera esfriar. Só a última de cada contato pode estar
            // assim; as anteriores já têm 6h de silêncio depois delas.
            if (Date.parse(ultima.enviada_em) > opcoes.agoraMs - janelaMs) continue

            prontos.push({
                contatoId,
                messageIds: g.map((m) => m.message_id),
                inicio: g[0].enviada_em,
                fim: ultima.enviada_em,
                sentido: ultima.direcao,
                falhas: Math.max(...g.map((m) => m.analise_falhas ?? 0)),
                temMensagemDoCliente: g.some((m) => m.direcao === 'entrada'),
                mensagens: g.slice(-maxPrompt).map((m) => ({
                    de: m.direcao === 'entrada' ? 'cliente' : 'nos',
                    texto: m.conteudo ?? `[${m.tipo_midia}]`,
                    em: m.enviada_em,
                })),
            })
        }
    }

    return prontos.sort((a, b) => Date.parse(a.fim) - Date.parse(b.fim))
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

export const PROMPT_SISTEMA = [
    'Você registra pontos de contato no CRM da Mont Distribuidora, que vende pão de queijo',
    'artesanal pelo WhatsApp. Leia a conversa e escreva o registro que um bom vendedor faria',
    'DEPOIS de encerrar o atendimento.',
    '',
    'Responda SÓ com um objeto JSON, neste formato:',
    '{"tipo": "ponto_contato" | "feedback", "resultado": "aceitou" | "recusou" | "respondeu" | "nenhum", "observacao": "...", "trecho_recusa": "..." | null}',
    '',
    'Regras:',
    '- observacao: no máximo 2 frases, em português, objetiva, até 300 caracteres. Diga o que',
    '  foi tratado e como ficou. Nada de floreio, nada de repetir a conversa.',
    '- tipo: "feedback" só quando o cliente opina sobre o produto ou o atendimento (elogio ou',
    '  reclamação) sem pedido nem oferta em jogo. Nos outros casos, "ponto_contato".',
    '- resultado descreve a RESPOSTA DO CLIENTE:',
    '    "aceitou"   = fechou pedido ou concordou com a oferta;',
    '    "recusou"   = recusa EXPLÍCITA, como "não quero", "não tenho interesse", "pode tirar',
    '                  meu número". Isso tira o cliente da lista por 30 dias;',
    '    "respondeu" = o cliente interagiu sem fechar nem recusar;',
    '    "nenhum"    = só nós falamos, ou não dá para dizer.',
    '- Adiamento NÃO é recusa. "agora não", "semana que vem", "depois eu vejo", "vou ver e te',
    '  falo" são "respondeu".',
    '- trecho_recusa: quando o resultado for "recusou", copie EXATAMENTE as palavras do cliente',
    '  (de uma linha CLIENTE) que mostram a recusa. Nos outros casos, null.',
].join('\n')

const fmtHora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})

export function montarPromptUsuario(seg: Segmento, nome: string | null): string {
    const transcricao = seg.mensagens
        .map((m) => `${m.de === 'cliente' ? 'CLIENTE' : 'NÓS'}: ${m.texto}`)
        .join('\n')
    const omitidas = seg.messageIds.length - seg.mensagens.length

    return [
        `Cliente: ${nome ?? 'sem nome'}`,
        `Conversa de ${fmtHora.format(new Date(seg.inicio))} a ${fmtHora.format(new Date(seg.fim))} (horário de Brasília).`,
        ...(omitidas > 0 ? [`(Mensagens mais antigas omitidas: ${omitidas}.)`] : []),
        '',
        'CONVERSA:',
        transcricao,
    ].join('\n')
}

// ─── Veredito ─────────────────────────────────────────────────────────────────

export interface Veredito {
    tipo: 'ponto_contato' | 'feedback'
    resultado: 'aceitou' | 'recusou' | 'respondeu' | null
    observacao: string
    /** Só quando `resultado === 'recusou'`: as palavras do cliente, como estão na conversa. */
    trechoRecusa: string | null
}

export type ValidacaoVeredito = { ok: true; veredito: Veredito } | { ok: false; motivo: string }

/** A mesma normalização que a RPC aplica em SQL: minúsculas e espaços colapsados. */
export function normalizarTrecho(texto: string): string {
    return texto.toLowerCase().replace(/\s+/g, ' ').trim()
}

function limparAspas(texto: string): string {
    return texto.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim()
}

/**
 * Lê a resposta do LLM e decide se ela pode ir para a RPC.
 *
 * Recusa: só vale com o trecho do cliente que a justifica, encontrado numa mensagem DELE.
 * Recusar congela o card por 30 dias; um "agora não" lido como recusa custaria uma venda.
 *
 * Duas correções são determinísticas, não motivo de nova tentativa:
 *  • segmento sem nenhuma mensagem do cliente não tem resposta do cliente → resultado nulo;
 *  • resultado preenchido vence "feedback" → vira ponto_contato (a RPC zeraria o resultado
 *    de um feedback, e um "aceitou" se perderia).
 */
export function validarVeredito(texto: string, seg: Segmento): ValidacaoVeredito {
    let v: unknown
    try {
        v = JSON.parse(texto)
    } catch {
        return { ok: false, motivo: 'a resposta não é um JSON válido' }
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
        return { ok: false, motivo: 'a resposta não é um objeto JSON' }
    }
    const o = v as Record<string, unknown>

    if (o.tipo !== 'ponto_contato' && o.tipo !== 'feedback') {
        return { ok: false, motivo: 'tipo deve ser "ponto_contato" ou "feedback"' }
    }

    const brutoResultado = o.resultado ?? 'nenhum'
    if (!['aceitou', 'recusou', 'respondeu', 'nenhum'].includes(brutoResultado as string)) {
        return { ok: false, motivo: 'resultado deve ser "aceitou", "recusou", "respondeu" ou "nenhum"' }
    }
    let resultado = brutoResultado === 'nenhum' ? null : (brutoResultado as Veredito['resultado'])

    const observacao = typeof o.observacao === 'string' ? o.observacao.trim() : ''
    if (!observacao) return { ok: false, motivo: 'observacao vazia' }
    if (observacao.length > MAX_OBSERVACAO) {
        return { ok: false, motivo: `observacao com ${observacao.length} caracteres; o máximo é 300` }
    }

    if (!seg.temMensagemDoCliente) resultado = null

    let trechoRecusa: string | null = null
    if (resultado === 'recusou') {
        const trecho = typeof o.trecho_recusa === 'string' ? limparAspas(o.trecho_recusa) : ''
        if (trecho.length < 3) {
            return { ok: false, motivo: 'resultado "recusou" exige trecho_recusa com as palavras do cliente' }
        }
        const doCliente = normalizarTrecho(
            seg.mensagens.filter((m) => m.de === 'cliente').map((m) => m.texto).join(' '),
        )
        if (!doCliente.includes(normalizarTrecho(trecho))) {
            return { ok: false, motivo: 'trecho_recusa não aparece em nenhuma mensagem do CLIENTE; copie as palavras exatas' }
        }
        trechoRecusa = trecho
    }

    const tipo = resultado !== null ? 'ponto_contato' : (o.tipo as Veredito['tipo'])
    return { ok: true, veredito: { tipo, resultado, observacao, trechoRecusa } }
}
