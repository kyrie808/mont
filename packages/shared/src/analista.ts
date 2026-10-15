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
    'Responda SÓ com um objeto JSON, com os campos NESTA ORDEM:',
    '{"observacao": "...", "tipo": "ponto_contato" | "feedback", "resultado": "aceitou" | "adiou" | "recusou" | "respondeu" | "nenhum", "retomar_em": "AAAA-MM-DD" | null, "trecho_cliente": "..." | null}',
    '',
    'observacao (escreva primeiro):',
    '- No máximo 2 frases, em português, objetiva, até 300 caracteres. Diga o que foi tratado',
    '  e como ficou. Nada de floreio, nada de repetir a conversa.',
    '- Escreva só o que está escrito na conversa. Não deduza. Atenção a quem é quem: em',
    '  "estou no médico com meu filho", quem está sendo atendido é o filho, não o cliente.',
    '- Atribua cada fala a quem a escreveu. O que está numa linha NÓS foi dito por nós: se',
    '  NÓS escrevemos "quando voltar, me chama", a nota diz "combinamos retomar na volta", e',
    '  não "o cliente pediu". Não diga que o cliente confirmou algo que ele não escreveu.',
    '- Saúde (do cliente ou de outra pessoa): registre o mínimo. Não cite hospital, clínica,',
    '  doença nem exame. Ex.: o cliente escreve "estou na clínica com meu pai, depois te',
    '  falo" -> observacao "Acompanhando o pai; pediu para retomar depois."',
    '- As palavras "recusa", "recusou" ou "recusar" só podem aparecer na observacao quando o',
    '  resultado for "recusou".',
    '',
    'tipo: "feedback" só quando o cliente opina sobre o produto ou o atendimento (elogio ou',
    'reclamação) sem pedido nem oferta em jogo. Nos outros casos, "ponto_contato".',
    '',
    'resultado — a RESPOSTA DO CLIENTE. Decida assim (siga a ordem e pare na primeira que valer):',
    '  1. Não há nenhuma linha CLIENTE -> "nenhum".',
    '  2. O cliente fechou ou confirmou um pedido ou uma entrega: escolheu produto ou',
    '     quantidade, combinou pagamento, endereço ou horário. Vale mesmo quando o pedido foi',
    '     montado em várias mensagens curtas ("sim", "pode ser", "então quero 2", "dinheiro",',
    '     "pode ser amanhã") e mesmo que a última mensagem seja nossa -> "aceitou".',
    '  3. Recusa EXPLÍCITA: "não quero", "não tenho interesse", "pode tirar meu número" ->',
    '     "recusou". Isso tira o cliente da lista por 30 dias. Um "não, obrigada" educado,',
    '     sozinho ou seguido de um motivo, NÃO é recusa explícita: siga para o item 4.',
    '  4. O cliente não fechou agora, mas não recusou: "agora não", "semana que vem", "depois',
    '     eu vejo", "vou ver e te falo", "estou viajando", "estou sem tempo"; deu um motivo',
    '     passageiro (viagem, compromisso, alguém doente); ou ficou combinado retomar depois',
    '     ("quando puder, me chama"). "Não, obrigada" seguido de um motivo passageiro também',
    '     conta -> "adiou". Adiamento NÃO é recusa.',
    '  5. Qualquer outra resposta do cliente (dúvida, agradecimento, comentário), sem pedido',
    '     fechado e sem nada deixado para depois -> "respondeu". Antes de usar "respondeu",',
    '     confira o item 4: se o cliente deu um motivo para não comprar agora, ou se a conversa',
    '     terminou combinada para depois, o resultado é "adiou".',
    '  Se existe linha CLIENTE, nunca use "nenhum".',
    '',
    'retomar_em: só quando o resultado for "adiou" E o cliente der um prazo. Use as datas de',
    'REFERÊNCIA que vêm com a conversa: "amanhã" = AMANHÃ; "fim de semana" = PRÓXIMO SÁBADO;',
    '"semana que vem" = PRÓXIMA SEGUNDA; uma data ou dia da semana citado = essa data. Prazo',
    'incerto também conta ("vou ver se consigo amanhã" = AMANHÃ). Se o cliente der mais de',
    'um prazo, use o mais cedo. Sem prazo nenhum ("quando eu voltar de viagem", "depois eu',
    'vejo"): null (o sistema marca o lembrete para 7 dias depois). Nos outros resultados: null.',
    '',
    'trecho_cliente: em todo resultado diferente de "nenhum", copie EXATAMENTE a frase-chave do',
    'cliente (de uma linha CLIENTE, nunca de uma linha NÓS) que justifica o resultado. Pode ser',
    'só um pedaço de uma mensagem. Curta, até 100 caracteres, sem detalhe de saúde. Escolha a',
    'frase DEPOIS de decidir o resultado; nunca mude o resultado para caber uma frase. Em',
    '"recusou", é a frase da recusa. Se o cliente',
    'só mandou mídia, copie a marca dela (ex.: "[audio]"). O sistema acrescenta no fim da nota',
    'Cliente: "<trecho_cliente>" — não repita a frase na observacao. Em "nenhum": null.',
].join('\n')

// ─── Datas de referência ─────────────────────────────────────────────────────
// O modelo pequeno erra conta de calendário. Em vez de pedir que ele descubra que dia é
// "fim de semana", a conversa já vai com as datas prontas; ele só escolhe uma.

/** Teto do adiamento: mais longe que isso não é prazo, é "depois". */
export const MAX_DIAS_RETOMADA = 60
/** Adiamento sem prazo claro também ganha lembrete: nenhum adiamento fica esquecido. */
export const DIAS_ADIAMENTO_SEM_PRAZO = 7

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

const fmtDiaBrasilia = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
})

/** 'AAAA-MM-DD' + n dias (aritmética de calendário em UTC, sem fuso). */
function somarDias(dia: string, n: number): string {
    const d = new Date(`${dia}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
}

export interface ReferenciaDatas {
    hoje: string
    diaSemana: string
    amanha: string
    proximoSabado: string
    proximaSegunda: string
}

/** Datas de referência a partir do fim da conversa, no dia de Brasília. */
export function referenciaDatas(fimIso: string): ReferenciaDatas {
    const hoje = fmtDiaBrasilia.format(new Date(fimIso))
    const dow = new Date(`${hoje}T00:00:00Z`).getUTCDay()
    return {
        hoje,
        diaSemana: DIAS_SEMANA[dow],
        amanha: somarDias(hoje, 1),
        proximoSabado: somarDias(hoje, ((6 - dow + 7) % 7) || 7),
        proximaSegunda: somarDias(hoje, ((1 - dow + 7) % 7) || 7),
    }
}

const fmtHora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})

export function montarPromptUsuario(seg: Segmento, nome: string | null): string {
    const transcricao = seg.mensagens
        .map((m) => `${m.de === 'cliente' ? 'CLIENTE' : 'NÓS'}: ${m.texto}`)
        .join('\n')
    const omitidas = seg.messageIds.length - seg.mensagens.length
    const ref = referenciaDatas(seg.fim)

    return [
        `Cliente: ${nome ?? 'sem nome'}`,
        `Conversa de ${fmtHora.format(new Date(seg.inicio))} a ${fmtHora.format(new Date(seg.fim))} (horário de Brasília).`,
        `REFERÊNCIA — HOJE (dia da conversa): ${ref.diaSemana}, ${ref.hoje}; AMANHÃ: ${ref.amanha}; PRÓXIMO SÁBADO: ${ref.proximoSabado}; PRÓXIMA SEGUNDA: ${ref.proximaSegunda}.`,
        ...(omitidas > 0 ? [`(Mensagens mais antigas omitidas: ${omitidas}.)`] : []),
        '',
        'CONVERSA:',
        transcricao,
    ].join('\n')
}

// ─── Veredito ─────────────────────────────────────────────────────────────────

export interface Veredito {
    tipo: 'ponto_contato' | 'feedback'
    resultado: 'aceitou' | 'adiou' | 'recusou' | 'respondeu' | null
    observacao: string
    /**
     * Com resultado: a frase-chave do cliente, como está numa mensagem DELE. A RPC a cita no
     * fim da nota (`Cliente: "..."`, ou `Recusa: "..."` na recusa).
     */
    trechoCliente: string | null
    /** Só no adiamento: o prazo do cliente ou, sem prazo claro, 7 dias depois da conversa. */
    retomarEm: string | null
}

export type ValidacaoVeredito =
    | { ok: true; veredito: Veredito }
    /** manterResultado: o resultado estava certo e o erro é só na frase, na saúde ou na data. */
    | { ok: false; motivo: string; manterResultado?: string }

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
 * Todo resultado vem com a frase-chave do cliente, encontrada numa mensagem DELE. Na recusa
 * isso é ainda mais caro: recusar congela o card por 30 dias; um "agora não" lido como
 * recusa custaria uma venda.
 *
 * Duas correções são determinísticas, não motivo de nova tentativa:
 *  • segmento sem nenhuma mensagem do cliente não tem resposta do cliente → resultado nulo;
 *  • resultado preenchido vence "feedback" → vira ponto_contato (a RPC zeraria o resultado
 *    de um feedback, e um "aceitou" se perderia).
 */
export function validarVeredito(
    texto: string,
    seg: Segmento,
    opcoes: { manterResultado?: string } = {},
): ValidacaoVeredito {
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
    if (!['aceitou', 'adiou', 'recusou', 'respondeu', 'nenhum'].includes(brutoResultado as string)) {
        return { ok: false, motivo: 'resultado deve ser "aceitou", "adiou", "recusou", "respondeu" ou "nenhum"' }
    }
    // Na correção de um erro que não era do resultado, o modelo pequeno às vezes troca o
    // resultado para caber a frase nova (Zélia, 15/10: adiou virou respondeu para citar
    // "Me desculpa"). Trocar o resultado nessa hora é rejeitado.
    if (opcoes.manterResultado !== undefined && brutoResultado !== opcoes.manterResultado) {
        return { ok: false, motivo: `o resultado era "${opcoes.manterResultado}" e não podia mudar na correção`, manterResultado: opcoes.manterResultado }
    }
    const manter = { manterResultado: brutoResultado as string }
    let resultado = brutoResultado === 'nenhum' ? null : (brutoResultado as Veredito['resultado'])

    const observacao = typeof o.observacao === 'string' ? o.observacao.trim() : ''
    if (!observacao) return { ok: false, motivo: 'observacao vazia' }
    if (observacao.length > MAX_OBSERVACAO) {
        return { ok: false, motivo: `observacao com ${observacao.length} caracteres; o máximo é 300` }
    }

    if (!seg.temMensagemDoCliente) resultado = null
    // O cliente escreveu e o modelo disse que não houve resposta: é leitura errada (Maria,
    // 14/10: nota "confirmado pedido para amanhã" com resultado "nenhum"). Feedback é a
    // exceção: opinião não tem resultado.
    else if (resultado === null && o.tipo === 'ponto_contato') {
        return { ok: false, motivo: 'há mensagens do CLIENTE: o resultado não pode ser "nenhum" (siga a ordem: aceitou, recusou, adiou, respondeu)' }
    }

    // Frase-chave do cliente: toda nota com resultado termina citando o que o CLIENTE
    // escreveu, conferido aqui e na RPC. É a prova de quem disse o quê (Andreia, 14/10: o
    // nosso "quando voltar, me chama" virou "o cliente pediu para retomar").
    let trechoCliente: string | null = null
    if (resultado !== null) {
        const trecho = typeof o.trecho_cliente === 'string' ? limparAspas(o.trecho_cliente) : ''
        if (trecho.length < 2) {
            return { ok: false, motivo: `resultado "${resultado}" exige trecho_cliente com a frase-chave copiada de uma linha CLIENTE`, ...manter }
        }
        const doCliente = normalizarTrecho(
            seg.mensagens.filter((m) => m.de === 'cliente').map((m) => m.texto).join(' '),
        )
        if (!doCliente.includes(normalizarTrecho(trecho))) {
            return { ok: false, motivo: 'trecho_cliente não aparece em nenhuma mensagem do CLIENTE; copie as palavras exatas de uma linha CLIENTE (nunca de uma linha NÓS)', ...manter }
        }
        // "Não, obrigada" é educação, não recusa explícita (Andreia, 14/10: "Não obrigada /
        // Estou viajando" virou recusa e congelaria o card por 30 dias).
        if (resultado === 'recusou' && /^n[ãa]o[\s,]*obrigad[oa]s?[\s.!]*$/.test(normalizarTrecho(trecho))) {
            return { ok: false, motivo: '"não, obrigada" sozinho não é recusa explícita; se o cliente deu um motivo passageiro, o resultado é "adiou"' }
        }
        trechoCliente = trecho
    }

    // "Cliente recusou o pedido" numa nota de adiamento: quem lê a timeline acredita na
    // palavra, não no rótulo.
    if (resultado !== 'recusou' && /recus/i.test(observacao)) {
        return { ok: false, motivo: 'a observacao fala em recusa, mas o resultado não é "recusou"; reescreva sem essa palavra ou mude o resultado' }
    }

    // Saúde no mínimo (Zélia, 14/10: "estou no hospital com minha mãe" virou "Cliente no
    // hospital"). O modelo pequeno ignora a regra do prompt; a checagem devolve para ele
    // reescrever. Vale também para a frase citada, que vai para a nota.
    const saude = /\b(hospital|cl[ií]nica|internad[oa]|interna[çc][ãa]o|cirurgia|exames?|doen[çt]|diagn[óo]stic)/i
    if (saude.test(observacao) || (trechoCliente && saude.test(trechoCliente))) {
        return {
            ok: false,
            motivo: 'a observacao ou o trecho_cliente cita hospital, clínica, doença ou exame. NÃO mude o resultado: reescreva a observacao só com o mínimo (ex.: "acompanhando a mãe; pediu para retomar depois"; se for só o endereço de entrega, diga "local de trabalho") e, no trecho_cliente, copie outro PEDAÇO da mensagem do cliente sem a parte de saúde',
            ...manter,
        }
    }

    // Data de retomada: só no adiamento. Em outro resultado é descartada, não é erro.
    let retomarEm: string | null = null
    if (resultado === 'adiou') {
        const ref = referenciaDatas(seg.fim)
        const semData = o.retomar_em == null || o.retomar_em === ''
        if (semData) {
            // O cliente deu prazo e o modelo não preencheu (Lena, 14/10: "vou ver se consigo
            // pegar amanhã / pra fim de semana" saiu sem data). Só termos sem ambiguidade.
            const doCliente = normalizarTrecho(seg.mensagens.filter((m) => m.de === 'cliente').map((m) => m.texto).join(' '))
            const prazo = doCliente.match(/amanh[ãa]|fi(?:m|nal) de semana|semana que vem|pr[óo]xima semana|m[êe]s que vem/)
            if (prazo) {
                return { ok: false, motivo: `o cliente citou um prazo ("${prazo[0]}"): preencha retomar_em com a data de REFERÊNCIA correspondente (o mais cedo, se houver mais de um)`, ...manter }
            }
            // Sem prazo claro: lembrete em 7 dias, contados do dia da conversa.
            retomarEm = somarDias(ref.hoje, DIAS_ADIAMENTO_SEM_PRAZO)
        } else {
            const data = typeof o.retomar_em === 'string' ? o.retomar_em.trim() : ''
            const valida = /^\d{4}-\d{2}-\d{2}$/.test(data) && somarDias(data, 0) === data
            if (!valida || data <= ref.hoje || data > somarDias(ref.hoje, MAX_DIAS_RETOMADA)) {
                return {
                    ok: false,
                    motivo: `retomar_em deve ser uma data AAAA-MM-DD depois de ${ref.hoje} e até ${somarDias(ref.hoje, MAX_DIAS_RETOMADA)}, ou null`,
                    ...manter,
                }
            }
            retomarEm = data
        }
    }

    const tipo = resultado !== null ? 'ponto_contato' : (o.tipo as Veredito['tipo'])
    return { ok: true, veredito: { tipo, resultado, observacao, trechoCliente, retomarEm } }
}
