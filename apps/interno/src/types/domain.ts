import type { 
    Database, 
    Venda, 
    ItemVenda, 
    PagamentoVenda, 
    Produto, 
    PurchaseOrder, 
    PurchaseOrderItem, 
    PurchaseOrderPayment 
} from '@mont/shared'

export type VendaStatus = 'pendente' | 'entregue' | 'cancelada'
// 'venda' = intenção de venda normal (forma real informada no Quitar). 'fiado'/'brinde' carregam lógica.
// pix/dinheiro/cartao/pre_venda permanecem para compat com vendas históricas.
export type PagamentoMetodo = 'venda' | 'pix' | 'dinheiro' | 'cartao' | 'fiado' | 'brinde' | 'pre_venda'
export type PagamentoStatus = 'pendente' | 'pago'

export interface IndicadorRef {
    id: string
    nome: string
    telefone?: string | null
}

export interface DomainContato {
    id: string
    nome: string
    apelido?: string | null
    telefone: string
    email?: string | null
    tipo: 'B2C' | 'B2B' | 'FORNECEDOR' | 'catalogo'
    subtipo?: string | null
    status: 'lead' | 'cliente' | 'inativo' | 'fornecedor'
    origem: string
    // Aquisição (preenchidos só quando origem = 'anuncio')
    fonte?: string | null
    campanhaId?: string | null
    indicadoPorId?: string | null
    indicador?: IndicadorRef | null
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
    // Apresentação no catálogo (consolidado no interno — fonte única)
    descricao?: string | null
    pesoKg?: number | null
    destaque?: boolean
    // Selo (badge) do card do catálogo: 'mais_vendido' | 'oferta' | 'queridinho' | null.
    // Desacoplado de `destaque` (que é só "aparece no carrossel").
    selo?: string | null
    slug?: string | null
    instrucoesPreparo?: string | null
    beneficios?: string | null
    visivelCatalogo?: boolean
    // Kit/combo (composição em produto_componentes)
    ehCombo?: boolean
    // Seção da vitrine (aba do catálogo) — FK cat_secoes
    secaoId?: string | null
}

export interface DomainItemVenda {
    id: string
    produtoId: string
    produto?: DomainProduto
    quantidade: number
    precoUnitario: number
    subtotal: number
}

// Composição de um combo/kit (linha de produto_componentes)
export interface DomainProdutoComponente {
    id: string
    comboId: string
    componenteId: string
    quantidade: number
    componente?: DomainProduto
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
    // Receita de frete (separada do faturamento de produto)
    receitaFrete: number
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

export interface VendaComItens extends Venda {
  itens: (ItemVenda & {
    produto?: {
      id: string
      nome: string
      codigo: string
    }
  })[]
  contato?: {
    id: string
    nome: string
    telefone: string
    origem: string
    indicado_por_id?: string | null
    indicador?: {
      id: string
      nome: string
    } | null
    status: string
  }
  pagamentos?: PagamentoVenda[]
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  fornecedor: { nome: string }
  items: (PurchaseOrderItem & {
    product: Produto
  })[]
  payments: PurchaseOrderPayment[]
}
