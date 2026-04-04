import type { Database } from './database'

export type VendaStatus = 'pendente' | 'entregue' | 'cancelada'
export type PagamentoMetodo = 'pix' | 'dinheiro' | 'cartao' | 'fiado' | 'brinde' | 'pre_venda'
export type PagamentoStatus = 'pendente' | 'pago'

export interface DomainContato {
    id: string
    nome: string
    apelido?: string | null
    telefone: string
    email?: string | null
    tipo: 'B2C' | 'B2B' | 'FORNECEDOR' | 'catalogo'
    subtipo?: string | null
    status: 'lead' | 'cliente' | 'inativo' | 'fornecedor'
    origem: 'direto' | 'indicacao' | 'catalogo'
    indicadoPorId?: string | null
    indicador?: {
        id: string
        nome: string
    } | null
    endereco?: string | null
    // Address breakdown
    logradouro?: string | null
    numero?: string | null
    complemento?: string | null
    cidade?: string | null
    uf?: string | null
    cep?: string | null
    bairro?: string | null
    lat?: number | null
    lng?: number | null
    observacoes?: string | null
    criadoEm: string
    atualizadoEm: string
}

export interface DomainProduto {
    id: string
    nome: string
    codigo: string
    preco: number
    preco_ancoragem?: number | null
    precoAncoragem?: number | null
    unidade?: string
    apelido?: string | null
    ativo: boolean
    custo: number
    estoqueAtual: number
    estoqueMinimo: number
    criadoEm: string
    atualizadoEm: string
    imagemUrl?: string
    categoria?: string | null
    subtitulo?: string | null
}

export interface DomainItemVenda {
    id: string
    produtoId: string
    produto?: DomainProduto
    quantidade: number
    precoUnitario: number
    subtotal: number
}

export interface DomainPagamento {
    id: string
    vendaId: string
    valor: number
    data: string
    metodo: PagamentoMetodo
    status: PagamentoStatus
    observacao?: string | null
}

export interface DomainVenda {
    id: string
    contatoId: string
    contato?: DomainContato
    data: string // ISO Date
    total: number
    custoTotal?: number
    status: VendaStatus
    pago: boolean
    formaPagamento: PagamentoMetodo
    taxaEntrega: number
    itens: DomainItemVenda[]
    pagamentos: DomainPagamento[]
    criadoEm: string
    valorPago: number
    origem?: 'catalogo' | 'direta' | string | null
    dataPrevistaPagamento?: string | null
}

// Creation/Update types (Domain-side)
export type CreateProduto = Omit<DomainProduto, 'id' | 'criadoEm' | 'atualizadoEm' | 'estoqueAtual'>
export type UpdateProduto = Partial<CreateProduto> & { ativo?: boolean; preco_ancoragem?: number | null }

export type CreateContato = Omit<DomainContato, 'id' | 'criadoEm' | 'atualizadoEm' | 'indicador'>
export type UpdateContato = Partial<CreateContato>

export interface CreateVenda {
    contatoId: string
    data: string
    formaPagamento: PagamentoMetodo
    taxaEntrega: number
    dataPrevistaPagamento?: string | null
    itens: {
        produtoId: string
        quantidade: number
        precoUnitario: number
        subtotal: number
    }[]
}

export type UpdateVenda = Partial<Omit<CreateVenda, 'itens'>> & {
    status?: VendaStatus
    pago?: boolean
}

export interface VendasMetrics {
    faturamentoTotal: number
    faturamentoDia: number
    faturamentoMes: number
    totalVendas: number
    vendasMes: number
    ticketMedio: number
    produtosVendidos: { total: number; pote1kg: number; pote4kg: number }
    recebido: number
    aReceber: number
    entregasPendentes: number
    entregasRealizadas: number
    lucroMes: number
}

// Purchase Order Domain Types
export type PurchaseOrderStatus = 'pending' | 'received' | 'cancelled'
export type PurchaseOrderPaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface DomainPurchaseOrderItem {
    id: string
    productId: string
    product?: DomainProduto
    quantity: number
    unitCost: number
    totalCost: number
}

export interface DomainPurchaseOrder {
    id: string
    fornecedorId: string
    fornecedor?: { id: string, nome: string }
    orderDate: string
    status: PurchaseOrderStatus
    paymentStatus: PurchaseOrderPaymentStatus
    totalAmount: number
    amountPaid: number
    notes?: string | null
    dataRecebimento?: string | null
    createdAt: string
}

export type PurchaseOrderPaymentRow = Database['public']['Tables']['purchase_order_payments']['Row']

export interface DomainPurchaseOrderWithItems extends DomainPurchaseOrder {
    items: DomainPurchaseOrderItem[]
    payments: PurchaseOrderPaymentRow[]
}

export type CreatePurchaseOrder = Omit<DomainPurchaseOrder, 'id' | 'createdAt' | 'status' | 'paymentStatus' | 'amountPaid'>
export type CreatePurchaseOrderItem = Omit<DomainPurchaseOrderItem, 'id' | 'product' | 'totalCost'>
export type UpdatePurchaseOrder = Partial<CreatePurchaseOrder> & {
    status?: PurchaseOrderStatus
    paymentStatus?: PurchaseOrderPaymentStatus
    dataRecebimento?: string | null
}
// Catalog Orders Domain Types
export type CatalogOrderStatus = 'pendente' | 'confirmado' | 'preparando' | 'enviado' | 'entregue' | 'cancelado'
export type CatalogPaymentStatus = 'pendente' | 'pago' | 'parcial'

export interface DomainCatalogOrderItem {
    id: string
    pedidoId: string
    produtoId?: string | null
    nomeProduto: string
    quantidade: number
    precoUnitario: number
    total: number
}

export interface DomainCatalogOrder {
    id: string
    numeroPedido: number
    nomeCliente: string
    telefoneCliente: string
    enderecoEntrega?: string | null
    metodoEntrega?: 'entrega' | 'retirada' | null
    status: CatalogOrderStatus
    subtotal: number
    frete: number
    total: number
    metodoPagamento?: PagamentoMetodo | null
    statusPagamento: CatalogPaymentStatus
    observacoes?: string | null
    indicadoPor?: string | null
    criadoEm: string
    atualizadoEm: string
    contatoId?: string | null
    vendaId?: string | null
    itens?: DomainCatalogOrderItem[]
}

export interface LocalPartida {
    id: string
    nome: string
    endereco: string
    lat: number
    lng: number
}
