// Aviso de entrega no grupo #ENTREGAS — lógica pura (sem banco, sem rede).
//
// Rodada 2, item C (Luccas, 15/10/2026): uma entrega deixou de sair porque o aviso não foi
// mandado no grupo. Aqui moram o TEXTO do aviso (no formato que a equipe já usa à mão) e a
// REGRA de quando ele sai. A Edge Function `avisos-entrega` só lê o banco e chama isto; o
// n8n só transporta (a Evolution é local e não é alcançável da nuvem).

export interface ClienteAviso {
    nome: string
    telefone: string | null
    cep: string | null
    logradouro: string | null
    numero: string | null
    complemento: string | null
    bairro: string | null
    cidade: string | null
    /** Endereço em texto livre, quando o estruturado não foi preenchido. */
    endereco: string | null
}

export interface VendaAviso {
    id: string
    /** 'AAAA-MM-DD'. Sem data prevista a venda não entra no automático. */
    dataEntregaPrevista: string | null
    criadoEm: string
    avisoEnviadoEm: string | null
    status: string
    formaPagamento: string
    pago: boolean
    total: number
    valorPago: number
    taxaEntrega: number | null
    observacaoEntregador: string | null
    cliente: ClienteAviso
    itens: Array<{ quantidade: number; nome: string }>
}

const LINHA = '━━━━━━━━━━━━━━━━'

/** 'R$ 5,00' com espaço comum (o Intl põe U+00A0, ruim no WhatsApp). Mesmo formato do
 *  formatarReais de catalogo.ts — copiado porque este módulo também roda no Deno, que
 *  exige extensão no import. */
const reais = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

const vazio = (s: string | null | undefined): s is null | undefined => !s || !s.trim()

/** '11995890951' → '(11) 99589-0951'. Sem DDD conhecido, devolve como veio. */
function telefoneBr(t: string | null): string {
    const d = (t ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return t ?? '—'
}

/** '09051620' → '09051-620'. */
function cepBr(cep: string | null): string | null {
    const d = (cep ?? '').replace(/\D/g, '')
    return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (vazio(cep) ? null : cep!.trim())
}

/** CEP, Rua - Nº 99 - complemento - bairro - cidade (pula o que estiver vazio). */
function enderecoLinha(c: ClienteAviso): string {
    const rua = [
        vazio(c.logradouro) ? null : c.logradouro!.trim(),
        vazio(c.numero) ? null : `Nº ${c.numero!.trim()}`,
        vazio(c.complemento) ? null : c.complemento!.trim(),
        vazio(c.bairro) ? null : c.bairro!.trim(),
        vazio(c.cidade) ? null : c.cidade!.trim(),
    ].filter(Boolean).join(' - ')
    const cep = cepBr(c.cep)
    if (rua) return cep ? `${cep}, ${rua}` : rua
    if (!vazio(c.endereco)) return c.endereco!.trim()
    return cep ?? '— (sem endereço no cadastro ⚠️)'
}

/** 135 → 'R$135'; 85.5 → 'R$85,50' (o "valor a ser cobrado" do grupo, sem espaço). */
function valorCobrado(v: number): string {
    const r = Math.round(Math.max(0, v) * 100) / 100
    return Number.isInteger(r) ? `R$${r}` : `R$${r.toFixed(2).replace('.', ',')}`
}

function quantidade(q: number): string {
    return Number.isInteger(q) ? String(q) : String(q).replace('.', ',')
}

/** Formas que dizem ao entregador como cobrar. 'venda' é só a intenção do checkout. */
const FORMAS_DEFINIDAS = new Set(['cartao', 'pix', 'dinheiro', 'fiado', 'brinde'])

/**
 * A venda chegou ao aviso sem dizer como o cliente paga (forma 'venda' e não paga). O
 * formulário exige a forma quando há data prevista; se mesmo assim chegar, o aviso sai
 * com NÃO DEFINIDO e a Equipe é alertada (decisão do Luccas, 16/10).
 */
export function pagamentoIndefinido(v: VendaAviso): boolean {
    return !v.pago && !FORMAS_DEFINIDAS.has(v.formaPagamento)
}

/** A linha de pagamento como a equipe escreve. Paga = "Já foi pago !!!". */
function pagamentoLinha(v: VendaAviso): string {
    if (v.pago) return 'Já foi pago !!!'
    switch (v.formaPagamento) {
        case 'cartao': return 'Vai ser pago no cartão ⚠️'
        case 'pix': return 'Pix na entrega ⚠️'
        case 'dinheiro': return 'Dinheiro na entrega ⚠️'
        case 'fiado': return 'Fiado ⚠️'
        case 'brinde': return 'Brinde, não cobrar ⚠️'
        default: return '⚠️ NÃO DEFINIDO — confirmar com a equipe'
    }
}

/** O que o entregador cobra. Pago e fiado: NÃO COBRAR, em letra que não deixa dúvida. */
function cobrarLinha(v: VendaAviso): string {
    if (v.pago) return 'NÃO COBRAR — já foi pago ✅'
    const saldo = v.total - v.valorPago
    if (v.formaPagamento === 'fiado') return `NÃO COBRAR — fiado (${valorCobrado(saldo)} na conta do cliente)`
    return `${valorCobrado(saldo)} (frete já incluso ⚠️)`
}

/** 'AAAA-MM-DD' → 'DD/MM'. */
function diaMes(d: string): string {
    const [, m, dia] = d.split('-')
    return `${dia}/${m}`
}

export function montarAvisoEntrega(v: VendaAviso): string {
    return [
        `*🚗Entrega ${v.dataEntregaPrevista ? diaMes(v.dataEntregaPrevista) : '??/??'}🚗*`,
        '🧀 *Novo Pedido — Mont Distribuidora*',
        '',
        `*Cliente:* ${v.cliente.nome.trim()}`,
        `*Telefone:* ${telefoneBr(v.cliente.telefone)}`,
        '',
        `*Endereço:* ${enderecoLinha(v.cliente)}`,
        `*Observação:* ${vazio(v.observacaoEntregador) ? '—' : v.observacaoEntregador!.trim()}`,
        LINHA,
        '',
        '*Itens:*',
        ...v.itens.map((i) => `▸ ${quantidade(i.quantidade)} ${i.nome.trim()}`),
        '',
        LINHA,
        `*Frete:* ${reais(v.taxaEntrega ?? 0)}`,
        `*Pagamento:* ${pagamentoLinha(v)}`,
        `*Valor a ser cobrado:* ${cobrarLinha(v)}`,
    ].join('\n')
}

// ─── Quando o aviso sai ────────────────────────────────────────────────────────

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtHora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function diaBrasilia(ms: number): string {
    return fmtDia.format(new Date(ms))
}

function minutoBrasilia(ms: number): number {
    const [h, m] = fmtHora.format(new Date(ms)).split(':').map(Number)
    return h * 60 + m
}

function somarDias(dia: string, n: number): string {
    const d = new Date(`${dia}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
}

/** 19h: sai o aviso das entregas de amanhã. */
export const HORA_LOTE_MIN = 19 * 60
/** 7h30: rede de segurança — entrega de hoje sem aviso sai e alerta a equipe. */
export const HORA_SEGURANCA_MIN = 7 * 60 + 30

/** O instante (ms) das 19h de um dia de Brasília (Brasil sem horário de verão: UTC-3). */
function lote19h(dia: string): number {
    return Date.parse(`${dia}T19:00:00-03:00`)
}

/**
 * Quais vendas devem ser avisadas AGORA. Chamado a cada poucos minutos.
 *
 *  • Entrega de AMANHÃ: a partir das 19h (lote da noite; venda lançada depois das 19h sai
 *    na próxima passada, ou seja, "na hora").
 *  • Entrega de HOJE lançada depois das 19h de ontem (madrugada ou durante o dia): sai na
 *    hora — ela não perdeu o lote, nasceu depois dele.
 *  • Entrega de HOJE que já existia antes das 19h de ontem e não saiu: rede de segurança,
 *    a partir das 7h30, sai e ALERTA a equipe (o lote da noite falhou).
 *  • Só pendente, com data prevista, ainda não avisada. Data passada ou além de amanhã: não.
 */
export function avisosDevidos(vendas: VendaAviso[], agoraMs: number): Array<{ vendaId: string; alertar: boolean }> {
    const hoje = diaBrasilia(agoraMs)
    const amanha = somarDias(hoje, 1)
    const minuto = minutoBrasilia(agoraMs)
    const loteDeOntem = lote19h(somarDias(hoje, -1))

    const devidos: Array<{ vendaId: string; alertar: boolean }> = []
    for (const v of vendas) {
        if (v.status !== 'pendente' || v.avisoEnviadoEm || !v.dataEntregaPrevista) continue

        if (v.dataEntregaPrevista === amanha) {
            if (minuto >= HORA_LOTE_MIN) devidos.push({ vendaId: v.id, alertar: false })
            continue
        }
        if (v.dataEntregaPrevista === hoje) {
            const nasceuDepoisDoLote = Date.parse(v.criadoEm) >= loteDeOntem
            if (nasceuDepoisDoLote) devidos.push({ vendaId: v.id, alertar: false })
            else if (minuto >= HORA_SEGURANCA_MIN) devidos.push({ vendaId: v.id, alertar: true })
        }
    }
    return devidos
}
