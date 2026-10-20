import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import type { ItemAgenda, OrigemItemAgenda } from '@mont/shared'

// Lógica pura da tela Agenda (sem rede, sem React): grade do mês, chips por dia,
// camadas ligadas e persistência delas. As datas andam como 'AAAA-MM-DD' — nada de
// toISOString (fuso): o dia é o do calendário, montado a partir de ano/mês/dia.

/** 'AAAA-MM-DD' → Date local à meia-noite (só para o date-fns fazer conta de calendário). */
export function paraData(dia: string): Date {
    const [a, m, d] = dia.split('-').map(Number)
    return new Date(a, m - 1, d)
}

export function paraDia(data: Date): string {
    return format(data, 'yyyy-MM-dd')
}

export function somarDias(dia: string, n: number): string {
    return paraDia(addDays(paraData(dia), n))
}

/** 'AAAA-MM' do dia. */
export function mesDoDia(dia: string): string {
    return dia.slice(0, 7)
}

export function somarMeses(mes: string, n: number): string {
    const [a, m] = mes.split('-').map(Number)
    const d = new Date(a, m - 1 + n, 1)
    return format(d, 'yyyy-MM')
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** '2026-10' → 'Outubro de 2026'. */
export function nomeDoMes(mes: string): string {
    const [a, m] = mes.split('-').map(Number)
    const nome = MESES[m - 1]
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`
}

export const DIAS_SEMANA_CURTOS = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.']

export interface DiaDaGrade {
    dia: string
    numero: number
    doMes: boolean
}

/**
 * As semanas inteiras (domingo a sábado) que cobrem o mês — 5 ou 6 linhas, como no Google.
 * A chamada a agenda_itens usa o primeiro e o último dia daqui (dias vizinhos também mostram).
 */
export function gradeDoMes(mes: string): DiaDaGrade[][] {
    const [a, m] = mes.split('-').map(Number)
    const primeiro = new Date(a, m - 1, 1)
    const inicio = startOfWeek(startOfMonth(primeiro), { weekStartsOn: 0 })
    const fim = endOfWeek(endOfMonth(primeiro), { weekStartsOn: 0 })
    const semanas: DiaDaGrade[][] = []
    for (let d = inicio; d <= fim; d = addDays(d, 7)) {
        semanas.push(Array.from({ length: 7 }, (_, i) => {
            const data = addDays(d, i)
            return { dia: paraDia(data), numero: data.getDate(), doMes: data.getMonth() === m - 1 }
        }))
    }
    return semanas
}

export function intervaloDaGrade(mes: string): { inicio: string; fim: string } {
    const semanas = gradeDoMes(mes)
    return { inicio: semanas[0][0].dia, fim: semanas[semanas.length - 1][6].dia }
}

// ─── Camadas ───────────────────────────────────────────────────────────────────

export type Camada = 'lembretes' | 'vencimentos' | 'entregas' | 'contas' | 'retomadas'

export const CAMADAS: Array<{ id: Camada; rotulo: string }> = [
    { id: 'lembretes', rotulo: 'Lembretes' },
    { id: 'vencimentos', rotulo: 'Vencimentos' },
    { id: 'entregas', rotulo: 'Entregas' },
    { id: 'contas', rotulo: 'Contas a pagar' },
    { id: 'retomadas', rotulo: 'Retomadas' },
]

const CAMADA_DA_ORIGEM: Record<OrigemItemAgenda, Camada> = {
    lembrete: 'lembretes',
    vencimento: 'vencimentos',
    entrega: 'entregas',
    conta_pagar: 'contas',
    retomada: 'retomadas',
}

export function camadaDoItem(item: Pick<ItemAgenda, 'origem'>): Camada {
    return CAMADA_DA_ORIGEM[item.origem]
}

export type CamadasLigadas = Record<Camada, boolean>

export const TODAS_LIGADAS: CamadasLigadas = { lembretes: true, vencimentos: true, entregas: true, contas: true, retomadas: true }

export const CHAVE_CAMADAS = 'mont.agenda.camadas'

/** Lê a escolha salva; qualquer coisa estranha (ou storage bloqueado) → todas ligadas. */
export function lerCamadas(storage: Pick<Storage, 'getItem'> | null): CamadasLigadas {
    try {
        const bruto = storage?.getItem(CHAVE_CAMADAS)
        if (!bruto) return { ...TODAS_LIGADAS }
        const salvo: unknown = JSON.parse(bruto)
        if (typeof salvo !== 'object' || salvo === null) return { ...TODAS_LIGADAS }
        const lido = { ...TODAS_LIGADAS }
        for (const { id } of CAMADAS) {
            const v = (salvo as Record<string, unknown>)[id]
            if (typeof v === 'boolean') lido[id] = v
        }
        return lido
    } catch {
        return { ...TODAS_LIGADAS }
    }
}

export function salvarCamadas(storage: Pick<Storage, 'setItem'> | null, camadas: CamadasLigadas): void {
    try {
        storage?.setItem(CHAVE_CAMADAS, JSON.stringify(camadas))
    } catch {
        // Storage cheio/bloqueado: a escolha vale só nesta visita.
    }
}

// ─── Chips do dia ──────────────────────────────────────────────────────────────

export type ChipAgenda =
    | { tipo: 'item'; item: ItemAgenda }
    | { tipo: 'vencimentos'; itens: ItemAgenda[]; total: number }

/** Quantos chips cabem na célula do mês antes do "+N mais". */
export const CHIPS_POR_DIA = 3

/** Busca por cliente ou título (sem acento, sem caixa). Vazio = tudo. */
export function bateBusca(item: Pick<ItemAgenda, 'titulo' | 'contato_nome'>, busca: string): boolean {
    const termo = normal(busca.trim())
    if (!termo) return true
    return normal(item.titulo).includes(termo) || normal(item.contato_nome ?? '').includes(termo)
}

function normal(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Os itens de cada dia já como chips, na ordem da célula:
 *   lembretes (hora primeiro, dia inteiro antes), depois vencimento(s), entregas, contas,
 *   retomadas. Dois ou mais vencimentos no mesmo dia viram UM chip agregado com o total
 *   (o valor vem do banco: soma de `valor`, que já é o em aberto).
 */
export function chipsPorDia(itens: ItemAgenda[], camadas: CamadasLigadas, busca = ''): Map<string, ChipAgenda[]> {
    const porDia = new Map<string, ItemAgenda[]>()
    for (const item of itens) {
        if (!camadas[camadaDoItem(item)] || !bateBusca(item, busca)) continue
        porDia.set(item.data, [...(porDia.get(item.data) ?? []), item])
    }
    const ordem: Record<OrigemItemAgenda, number> = { lembrete: 0, vencimento: 1, entrega: 2, conta_pagar: 3, retomada: 4 }
    const resultado = new Map<string, ChipAgenda[]>()
    for (const [dia, doDia] of porDia) {
        const ordenados = [...doDia].sort((a, b) =>
            ordem[a.origem] - ordem[b.origem]
            || (a.hora ?? '').localeCompare(b.hora ?? '')
            || a.titulo.localeCompare(b.titulo))
        const vencimentos = ordenados.filter((i) => i.origem === 'vencimento')
        const chips: ChipAgenda[] = []
        let vencimentoPosto = false
        for (const item of ordenados) {
            if (item.origem !== 'vencimento' || vencimentos.length === 1) {
                chips.push({ tipo: 'item', item })
            } else if (!vencimentoPosto) {
                chips.push({ tipo: 'vencimentos', itens: vencimentos, total: somaValores(vencimentos) })
                vencimentoPosto = true
            }
        }
        resultado.set(dia, chips)
    }
    return resultado
}

export function somaValores(itens: Array<Pick<ItemAgenda, 'valor'>>): number {
    return itens.reduce((acc, i) => acc + (i.valor ?? 0), 0)
}

/** Os chips que aparecem na célula e quantos ficam no "+N mais". */
export function cortarChips(chips: ChipAgenda[], limite = CHIPS_POR_DIA): { visiveis: ChipAgenda[]; mais: number } {
    if (chips.length <= limite) return { visiveis: chips, mais: 0 }
    // Com o "+N mais" ocupando uma linha, cabem limite − 1 chips.
    const visiveis = chips.slice(0, limite - 1)
    return { visiveis, mais: chips.length - visiveis.length }
}

/** '14:30:00' → '14h30'; '09:00' → '9h'. */
export function horaCurta(hora: string | null): string | null {
    if (!hora) return null
    const [h, m] = hora.split(':')
    return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`
}

/** Texto do chip de um item (o valor, quando há, entra formatado por quem chama). */
export function rotuloDoItem(item: ItemAgenda): string {
    switch (item.origem) {
        case 'vencimento':
        case 'entrega':
            return item.contato_nome ?? item.titulo
        case 'retomada':
            return `Retomar: ${item.contato_nome ?? item.titulo}`
        default:
            return item.titulo
    }
}

/** Palavras do texto sem acento, caixa ou pontuação ('Rosângela — 1ª' → 'rosangela 1ª'). */
function palavrasNormais(s: string): string {
    return normal(s).replace(/[^\p{L}\p{N}ªº]+/gu, ' ').trim()
}

/** O título cita o termo como palavra(s) inteira(s)? ('Ana' não bate dentro de 'Banana'.) */
function citaPalavras(texto: string, termo: string): boolean {
    const t = palavrasNormais(termo)
    return t !== '' && ` ${palavrasNormais(texto)} `.includes(` ${t} `)
}

/**
 * Como o cliente aparece no título do lembrete: o maior começo do nome cadastrado que o
 * título cita ('Ana Maria Oliveira da Silva' + 'Ana Maria — 1ª parcela' → 'Ana Maria'),
 * senão o apelido entre parênteses ('Caroline Gomes (Carol)' → 'Carol'), senão o primeiro nome.
 */
export function nomeCurto(contatoNome: string, titulo: string): string {
    const palavras = contatoNome.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/).filter(Boolean)
    for (let n = palavras.length; n > 0; n--) {
        const comeco = palavras.slice(0, n).join(' ')
        if (citaPalavras(titulo, comeco)) return comeco
    }
    const apelido = contatoNome.match(/\(([^)]+)\)/)?.[1]?.trim()
    if (apelido && citaPalavras(titulo, apelido)) return apelido
    return palavras[0] ?? contatoNome
}

const SEPARADORES_TITULO = /\s*[—–:|·]\s*|\s+-\s+/

/** Tira do trecho as palavras do nome ('Cobrar Ana Maria' − 'Ana Maria' → 'Cobrar'). */
function tirarNome(trecho: string, nome: string): string {
    const alvo = palavrasNormais(nome)
    const palavras = trecho.split(/\s+/)
    const n = alvo.split(' ').length
    for (let i = 0; i + n <= palavras.length; i++) {
        if (palavrasNormais(palavras.slice(i, i + n).join(' ')) === alvo) {
            return [...palavras.slice(0, i), ...palavras.slice(i + n)].join(' ').trim()
        }
    }
    return trecho
}

/**
 * O resto do título, curto: o primeiro trecho (entre '—', ':', '·'…) que não é o nome.
 *   'Retomar cobrança — Simone'          → 'cobrança' (o verbo não cabe; o ícone já diz o tipo)
 *   'Gilmar: Andrea — Pix de R$ 135…'    → 'Gilmar'
 *   'Ana Maria — 1ª parcela'             → '1ª parcela'
 */
export function restoDoTitulo(titulo: string, nome: string): string {
    const trechos = titulo.split(SEPARADORES_TITULO).map((t) => t.trim()).filter(Boolean)
    const resto = trechos.find((t) => !citaPalavras(t, nome)) ?? tirarNome(trechos[0] ?? '', nome)
    return resto.replace(/^retomar\s+/i, '').trim()
}

/** Texto do chip de um lembrete: o cliente primeiro ('Simone · cobrança'); sem cliente, o título. */
export function rotuloDoLembrete(item: Pick<ItemAgenda, 'titulo' | 'contato_nome'>): string {
    if (!item.contato_nome?.trim()) return item.titulo
    const nome = nomeCurto(item.contato_nome, item.titulo)
    const resto = restoDoTitulo(item.titulo, nome)
    return resto ? `${nome} · ${resto}` : nome
}

/** Valor que cabe no chip: 'R$ 885' quando é inteiro, 'R$ 32,50' quando tem centavos. */
export function valorCurto(valor: number): string {
    const v = Math.round(valor * 100) / 100
    const casas = Number.isInteger(v) ? 0 : 2
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas,
    }).format(v)
}

// ─── Faixa de Atrasados e lista simples ─────────────────────────────────────────

export interface ResumoAtrasados {
    lembretes: ItemAgenda[]
    vencimentos: ItemAgenda[]
    valorLembretes: number
    valorVencimentos: number
}

export function resumirAtrasados(itens: ItemAgenda[]): ResumoAtrasados {
    const lembretes = itens.filter((i) => i.origem === 'lembrete')
    const vencimentos = itens.filter((i) => i.origem === 'vencimento')
    return { lembretes, vencimentos, valorLembretes: somaValores(lembretes), valorVencimentos: somaValores(vencimentos) }
}

/** Quebra do "em aberto sem data" por forma de pagamento, maior primeiro. */
export function quebraPorForma(itens: Array<{ forma_pagamento: string; valor: number }>): Array<{ forma: string; quantidade: number; valor: number }> {
    const mapa = new Map<string, { quantidade: number; valor: number }>()
    for (const i of itens) {
        const atual = mapa.get(i.forma_pagamento) ?? { quantidade: 0, valor: 0 }
        mapa.set(i.forma_pagamento, { quantidade: atual.quantidade + 1, valor: atual.valor + i.valor })
    }
    return [...mapa.entries()]
        .map(([forma, v]) => ({ forma, ...v }))
        .sort((a, b) => b.quantidade - a.quantidade || a.forma.localeCompare(b.forma))
}

export const NOME_FORMA: Record<string, string> = {
    fiado: 'Fiado', pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', venda: 'A combinar', pre_venda: 'Pré-venda',
}

export const NOME_TIPO: Record<string, string> = {
    cobranca: 'Cobrança', parcela: 'Parcela', pendencia_interna: 'Pendência', retorno_comercial: 'Retorno comercial', outro: 'Outro',
}

export const NOME_RESPONSAVEL: Record<string, string> = { luccas: 'Luccas', gilmar: 'Gilmar', equipe: 'Equipe' }

/** A mensagem do erro do Supabase/rede (as regras do banco escrevem em português), ou o padrão. */
export function mensagemDeErro(e: unknown, padrao: string): string {
    if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' && e.message.trim()) return e.message
    return padrao
}
