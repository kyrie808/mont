// Conferência de hora em hora (bloco C, Black 2026) — lógica pura (sem banco, sem rede).
//
// Na Black quem atende no WhatsApp são as pessoas da equipe; o agente só LÊ a conversa (o
// analista). A conferência avisa quando algo escapou:
//   • pedido fechado na conversa sem venda lançada em 3 h → grupo da equipe;
//   • venda de cliente vindo de anúncio sem Purchase na fila da Meta → só o Luccas;
//   • evento da Meta com erro ou parado → só o Luccas.
// Alertas só saem entre 8h e 21h (São Paulo); o que vence fora disso sai num resumo único
// no primeiro envio do dia seguinte.
//
// "Pedido fechado" (critério aprovado pelo Luccas, 30/10): na mesma conversa,
//   1. aceite do cliente sobre itens concretos ("pode mandar", "fechado", "quero 2 baldes");
//   2. pelo menos um item com quantidade (combo sem sabor conta, marcado "faltam sabores");
//   3. confirmação do outro lado: a equipe combinou total/entrega/Pix, OU o cliente mandou
//      comprovante;
//   4. sem desistência depois do aceite.
// O analista já marca "aceitou" (pontos 1 e 2). Um SEGUNDO passo, só nesses casos, extrai o
// pedido com o prompt abaixo; a decisão final é determinística (validarPedidoExtraido).

// Sem import: este arquivo é lido também pelas Edge Functions (Deno), como os outros módulos
// de domínio. O pedido chega no formato de PedidoExtraido (analista.ts), por estrutura.

/** O que o aviso precisa do pedido lido (PedidoExtraido em analista.ts tem esta forma). */
export interface PedidoParaAviso {
    itens: { produto: string; quantidade: number; sabores: string[] }[]
    formaPagamento: 'pix' | 'dinheiro' | 'cartao' | 'fiado' | null
    entrega: 'retirada' | 'entrega' | null
    totalCitado: number | null
    faltamSabores: boolean
    trecho: string | null
    fechadoEm: string
}

// ─── Horário dos alertas ──────────────────────────────────────────────────────

export const HORA_INICIO_ALERTAS = 8
export const HORA_FIM_ALERTAS = 21
/** Pedido fechado sem venda: espera 3 h antes de alertar. */
export const HORAS_PARA_VENDA = 3

const fmtHoraSP = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' })

function horaSP(iso: string): number {
    return Number(fmtHoraSP.format(new Date(iso)))
}

/** Entre 8h00 e 20h59 de São Paulo. */
export function dentroDoHorario(iso: string): boolean {
    const h = horaSP(iso)
    return h >= HORA_INICIO_ALERTAS && h < HORA_FIM_ALERTAS
}

export interface AlertaPendente {
    id: string
    destino: 'grupo' | 'luccas'
    /** Quando o alerta passa a valer (pedido: aceite + 3 h; Meta: quando foi visto). */
    venceEm: string
    texto: string
}

export interface MensagemDevida {
    destino: 'grupo' | 'luccas'
    texto: string
    alertaIds: string[]
}

/**
 * O que sai AGORA. Fora do horário, nada. Dentro: o alerta que venceu de dia sai sozinho; o
 * que venceu de noite (ou de madrugada) junta num "Resumo da noite" por destino.
 */
export function mensagensDevidas(alertas: AlertaPendente[], agoraIso: string): MensagemDevida[] {
    if (!dentroDoHorario(agoraIso)) return []
    const agora = Date.parse(agoraIso)
    const vencidos = alertas.filter((a) => Date.parse(a.venceEm) <= agora)

    const saida: MensagemDevida[] = []
    const noturnos = new Map<'grupo' | 'luccas', AlertaPendente[]>()
    for (const a of vencidos) {
        if (dentroDoHorario(a.venceEm)) {
            saida.push({ destino: a.destino, texto: a.texto, alertaIds: [a.id] })
        } else {
            noturnos.set(a.destino, [...(noturnos.get(a.destino) ?? []), a])
        }
    }
    for (const [destino, lista] of noturnos) {
        const ordenada = [...lista].sort((x, y) => Date.parse(x.venceEm) - Date.parse(y.venceEm))
        saida.unshift({
            destino,
            texto: [`🌙 *Resumo da noite* (${ordenada.length})`, ...ordenada.map((a) => a.texto)].join('\n\n———\n\n'),
            alertaIds: ordenada.map((a) => a.id),
        })
    }
    return saida
}

// ─── Textos ───────────────────────────────────────────────────────────────────

/** Espaço comum no lugar do não-separável do Intl (o WhatsApp mostra os dois, a busca não). */
const fmtReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const reais = (v: number) => fmtReais.format(v).replace(/\u00a0/g, ' ')

/** (11) 98888-7777 — mesmo formato do formatPhone do app. */
function telefone(t: string): string {
    const d = t.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return t
}

const fmtDiaHoraSP = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})

const ROTULO_FORMA: Record<NonNullable<PedidoParaAviso['formaPagamento']>, string> = { pix: 'Pix', dinheiro: 'dinheiro', cartao: 'cartão', fiado: 'fiado' }

export function textoPedidoSemVenda(cliente: { nome: string | null; telefone: string | null }, p: PedidoParaAviso): string {
    const quem = [cliente.nome ?? 'Cliente sem nome', cliente.telefone ? telefone(cliente.telefone) : null].filter(Boolean).join(' · ')
    const itens = p.itens.length > 0
        ? p.itens.map((i) => `• ${i.quantidade}× ${i.produto}${i.sabores.length ? ` (${i.sabores.join(', ')})` : ''}`).join('\n')
        : '• (itens não identificados)'
    const detalhes = [
        `Pagamento: ${p.formaPagamento ? ROTULO_FORMA[p.formaPagamento] : 'não dito'}`,
        `Entrega: ${p.entrega ?? 'não dito'}`,
        `Total citado: ${p.totalCitado !== null ? reais(p.totalCitado) : 'não dito'}`,
    ].join(' · ')
    return [
        '🔎 *Pedido para conferir*',
        quem,
        `Fechou em ${fmtDiaHoraSP.format(new Date(p.fechadoEm))} e não há venda lançada em ${HORAS_PARA_VENDA} h.`,
        itens,
        detalhes,
        ...(p.faltamSabores ? ['⚠️ Faltam sabores do combo.'] : []),
        ...(p.trecho ? [`Cliente: _"${p.trecho}"_`] : []),
    ].join('\n')
}

export function textoAnuncioSemPurchase(v: { nome: string | null; total: number; vendaId: string; data: string }): string {
    return [
        '📣 *Venda de cliente de anúncio sem Purchase na Meta*',
        `${v.nome ?? 'Cliente sem nome'} · ${reais(v.total)} · venda ${v.vendaId.slice(0, 8)} (${v.data})`,
        'A venda está entregue e não há evento na fila meta_eventos.',
    ].join('\n')
}

/** Corta na última palavra inteira antes do limite, com reticências. */
function encurtar(texto: string, limite: number): string {
    if (texto.length <= limite) return texto
    const corte = texto.slice(0, limite - 1)
    const espaco = corte.lastIndexOf(' ')
    return `${(espaco > limite / 2 ? corte.slice(0, espaco) : corte).replace(/[\s,.;:]+$/, '')}…`
}

export function textoEventoMeta(e: {
    evento: string; eventId: string; status: 'erro' | 'parado'; valor: number | null; tentativas: number; erro: string | null
}): string {
    return [
        `⚠️ *Evento da Meta ${e.status === 'erro' ? 'com erro' : 'parado na fila'}*`,
        `${e.evento} ${e.eventId}${e.valor !== null ? ` · ${reais(e.valor)}` : ''} · ${e.tentativas} tentativa(s)`,
        ...(e.erro ? [encurtar(e.erro, 200)] : []),
    ].join('\n')
}
