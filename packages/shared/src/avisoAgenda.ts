// Aviso diário da Agenda no grupo Equipe — lógica pura (sem banco, sem rede).
//
// Onda 2 da Agenda de Retornos (docs/agenda-retornos). A Edge Function `avisos-agenda` lê
// agenda_itens/agenda_atrasados (as mesmas funções da tela) e chama isto; o n8n (W6) só
// transporta. Mensagem só interna: nenhum cliente recebe nada daqui.
//
// Seções:
//   Atrasados — lembretes pendentes vencidos (nome + título) e vencimentos em atraso
//               (quantidade + total; até 5 nomes, depois "+N")
//   Hoje      — lembretes do dia por responsável; vencimentos (quantidade + total);
//               entregas e retomadas (quantidade)
//   Amanhã    — só o total de vencimentos e de lembretes
// Tudo vazio → null (não envia).

/** Um item de agenda_itens()/agenda_atrasados() no que o aviso usa. */
export interface ItemAvisoAgenda {
    /** lembrete | vencimento | entrega | conta_pagar | retomada */
    origem: string
    /** 'AAAA-MM-DD' */
    data: string
    /** 'HH:MM[:SS]' ou null (dia inteiro). */
    hora: string | null
    titulo: string
    situacao: string
    contatoNome: string | null
    valor: number | null
    /** Só lembrete: luccas | gilmar | equipe | null (vem de lembretes.responsavel). */
    responsavel: string | null
}

export interface EntradaAvisoAgenda {
    /** O dia do aviso, 'AAAA-MM-DD' (Brasília). */
    dia: string
    /** Itens de agenda_atrasados() como estariam no começo de `dia`. */
    atrasados: ItemAvisoAgenda[]
    /** Itens de agenda_itens(dia, dia). */
    doDia: ItemAvisoAgenda[]
    /** Itens de agenda_itens(dia + 1, dia + 1). */
    amanha: ItemAvisoAgenda[]
}

/** Quantos nomes de vencimento atrasado aparecem antes do "+N". */
export const MAX_NOMES_VENCIMENTO = 5

/** O que entra na faixa de Atrasados quando a data passa: lembrete pendente e vencimento. */
export function entraNosAtrasados(i: Pick<ItemAvisoAgenda, 'origem' | 'situacao'>): boolean {
    return (i.origem === 'lembrete' && i.situacao === 'pendente') || i.origem === 'vencimento'
}

/** `1570` → `R$ 1.570,00`. Sem `Intl` de propósito: igual no Deno e no Node, sem U+00A0.
 *  Mesmo formato do reais() de whatsapp.ts — copiado porque este módulo também roda no
 *  Deno, que exige extensão no import. */
function reais(valor: number): string {
    const [inteiro, centavos] = valor.toFixed(2).split('.')
    return `R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`
}

/** 'AAAA-MM-DD' → 'DD/MM'. */
function diaMes(d: string): string {
    return `${d.slice(8, 10)}/${d.slice(5, 7)}`
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** 'AAAA-MM-DD' → 'terça'. Calculado no calendário (UTC puro), sem fuso no meio. */
function diaSemana(d: string): string {
    const [a, m, dia] = d.split('-').map(Number)
    return DIAS_SEMANA[new Date(Date.UTC(a, m - 1, dia)).getUTCDay()]
}

function somarDias(dia: string, n: number): string {
    const d = new Date(`${dia}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
}

/** '14:30:00' → '14h30'; '09:00' → '9h'. */
function horaBr(h: string): string {
    const [hh, mm] = h.split(':')
    const hora = String(Number(hh))
    return mm === '00' ? `${hora}h` : `${hora}h${mm}`
}

/** Minúsculas e sem acento, para comparar nomes ("Patrícia" = "Patricia"). */
function normal(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const NOMES_RESPONSAVEL: Record<string, string> = { gilmar: 'Gilmar', luccas: 'Luccas', equipe: 'Equipe' }
const ORDEM_RESPONSAVEL = ['gilmar', 'luccas', 'equipe']
const SEM_RESPONSAVEL = 'Sem responsável'

/** Palavras (sem acento, minúsculas) de um texto. */
function palavras(s: string): string[] {
    return normal(s).split(/[^a-z0-9]+/).filter(Boolean)
}

/** O título já cita o cliente? Basta uma palavra do nome (3+ letras) aparecer inteira. */
function tituloCitaCliente(titulo: string, nome: string): boolean {
    const doTitulo = new Set(palavras(titulo))
    return palavras(nome).some((p) => p.length >= 3 && doTitulo.has(p))
}

/**
 * A linha de um lembrete: o título, com o nome do cliente na frente quando o título ainda
 * não o cita ("Ana Maria Oliveira — Ligar" sim; "Retomar cobrança — Carol", de "Caroline
 * Gomes (Carol)", já diz quem é). Sob o grupo de um responsável, o prefixo "Gilmar: " do
 * título sai — o grupo já diz.
 */
function linhaLembrete(i: ItemAvisoAgenda, grupo: string | null): string {
    let titulo = i.titulo.trim()
    if (grupo) {
        const prefixo = `${normal(grupo)}:`
        if (normal(titulo).startsWith(prefixo)) titulo = titulo.slice(prefixo.length).trim()
    }
    const nome = i.contatoNome?.trim()
    const comNome = nome && !tituloCitaCliente(titulo, nome) ? `${nome} — ${titulo}` : titulo
    return i.hora ? `${horaBr(i.hora)} ${comNome}` : comNome
}

function porData<T extends { data: string; titulo: string }>(a: T, b: T): number {
    return a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo)
}

function somaValor(itens: ItemAvisoAgenda[]): number {
    return itens.reduce((acc, i) => acc + (i.valor ?? 0), 0)
}

function plural(n: number, um: string, varios: string): string {
    return `${n} ${n === 1 ? um : varios}`
}

/** Até MAX_NOMES_VENCIMENTO clientes (os mais antigos primeiro, sem repetir), depois "+N". */
function nomesVencimentos(itens: ItemAvisoAgenda[]): string {
    const nomes: string[] = []
    for (const i of [...itens].sort(porData)) {
        const nome = i.contatoNome?.trim()
        if (nome && !nomes.includes(nome)) nomes.push(nome)
    }
    const mostrados = nomes.slice(0, MAX_NOMES_VENCIMENTO)
    const resto = nomes.length - mostrados.length
    return resto > 0 ? `${mostrados.join(', ')} +${resto}` : mostrados.join(', ')
}

export function montarAvisoAgenda(e: EntradaAvisoAgenda): string | null {
    const atrasoLembretes = e.atrasados.filter((i) => i.origem === 'lembrete' && i.situacao === 'pendente').sort(porData)
    const atrasoVencimentos = e.atrasados.filter((i) => i.origem === 'vencimento')

    const hojeLembretes = e.doDia.filter((i) => i.origem === 'lembrete' && i.situacao === 'pendente')
    const hojeVencimentos = e.doDia.filter((i) => i.origem === 'vencimento')
    const hojeEntregas = e.doDia.filter((i) => i.origem === 'entrega')
    const hojeRetomadas = e.doDia.filter((i) => i.origem === 'retomada')

    const amanhaVencimentos = e.amanha.filter((i) => i.origem === 'vencimento')
    const amanhaLembretes = e.amanha.filter((i) => i.origem === 'lembrete' && i.situacao === 'pendente')

    const temAtraso = atrasoLembretes.length > 0 || atrasoVencimentos.length > 0
    const temHoje = hojeLembretes.length + hojeVencimentos.length + hojeEntregas.length + hojeRetomadas.length > 0
    const temAmanha = amanhaVencimentos.length + amanhaLembretes.length > 0
    if (!temAtraso && !temHoje && !temAmanha) return null

    const linhas: string[] = [`📅 *Agenda Mont — ${diaSemana(e.dia)}, ${diaMes(e.dia)}*`]

    if (temAtraso) {
        linhas.push('', '⚠️ *Atrasados*')
        if (atrasoLembretes.length > 0) {
            linhas.push(`${plural(atrasoLembretes.length, 'lembrete', 'lembretes')}:`)
            for (const i of atrasoLembretes) linhas.push(`• ${linhaLembrete(i, null)} (${diaMes(i.data)})`)
        }
        if (atrasoVencimentos.length > 0) {
            linhas.push(`${plural(atrasoVencimentos.length, 'vencimento', 'vencimentos')} · ${reais(somaValor(atrasoVencimentos))}`)
            linhas.push(nomesVencimentos(atrasoVencimentos))
        }
    }

    linhas.push('', '📌 *Hoje*')
    if (!temHoje) {
        linhas.push('Nada marcado.')
    } else {
        const grupos = new Map<string, ItemAvisoAgenda[]>()
        for (const i of hojeLembretes) {
            const chave = i.responsavel && NOMES_RESPONSAVEL[i.responsavel] ? i.responsavel : ''
            grupos.set(chave, [...(grupos.get(chave) ?? []), i])
        }
        for (const chave of [...ORDEM_RESPONSAVEL, '']) {
            const itens = grupos.get(chave)
            if (!itens) continue
            const nome = chave ? NOMES_RESPONSAVEL[chave] : SEM_RESPONSAVEL
            linhas.push(`${nome}:`)
            const ordenados = [...itens].sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? '') || a.titulo.localeCompare(b.titulo))
            for (const i of ordenados) linhas.push(`• ${linhaLembrete(i, chave ? nome : null)}`)
        }
        if (hojeVencimentos.length > 0) {
            linhas.push(`Vencimentos: ${hojeVencimentos.length} · ${reais(somaValor(hojeVencimentos))}`)
        }
        const contagens = [
            hojeEntregas.length > 0 ? plural(hojeEntregas.length, 'entrega', 'entregas') : null,
            hojeRetomadas.length > 0 ? plural(hojeRetomadas.length, 'retomada', 'retomadas') : null,
        ].filter(Boolean)
        if (contagens.length > 0) linhas.push(contagens.join(' · '))
    }

    if (temAmanha) {
        const partes = [
            amanhaVencimentos.length > 0
                ? `${plural(amanhaVencimentos.length, 'vencimento', 'vencimentos')} (${reais(somaValor(amanhaVencimentos))})`
                : null,
            amanhaLembretes.length > 0 ? plural(amanhaLembretes.length, 'lembrete', 'lembretes') : null,
        ].filter(Boolean)
        linhas.push('', `🔜 *Amanhã (${diaMes(somarDias(e.dia, 1))})*: ${partes.join(' · ')}`)
    }

    return linhas.join('\n')
}
