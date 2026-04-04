import type {
    DomainVenda,
    DomainItemVenda,
    DomainContato,
    DomainPagamento,
    DomainProduto,
    DomainPurchaseOrder,
    DomainPurchaseOrderItem,
    DomainPurchaseOrderWithItems,
    PurchaseOrderStatus,
    PurchaseOrderPaymentStatus,
    DomainCatalogOrder,
    DomainCatalogOrderItem,
    CatalogOrderStatus,
    CatalogPaymentStatus,
    PagamentoMetodo
} from '../types/domain'
import type { Tables } from '@mont/shared'

// ---------------------------------------------------
// Row aliases for readability
// ---------------------------------------------------
type ContatoRow = Tables<'contatos'>
type ProdutoRow = Tables<'produtos'>
type ItemVendaRow = Tables<'itens_venda'>
type PagamentoRow = Tables<'pagamentos_venda'>
type VendaRow = Tables<'vendas'>
type PurchaseOrderRow = any
type PurchaseOrderItemRow = any
type PurchaseOrderPaymentRow = any
type CatalogOrderRow = any
type CatalogOrderItemRow = any

// ---------------------------------------------------
// Extended row types for Supabase joins
// (Partial allows test fixtures to omit optional fields)
// ---------------------------------------------------
export type ContatoRowWithIndicador = ContatoRow & {
    email?: string | null
    observacao?: string | null
    indicador?: { id: string; nome: string } | null
}

export type ItemVendaRowWithProduto = ItemVendaRow & {
    produto?: ProdutoRow | null
}

export type PagamentoRowWithStatus = PagamentoRow & {
    status?: string
}

export type VendaRowWithRelations = VendaRow & {
    contato?: ContatoRow | null
    itens?: ItemVendaRow[]
    pagamentos?: PagamentoRow[]
}

type ProdutoRowWithImages = ProdutoRow & {
    sis_imagens_produto?: { url: string } | null
}

type PurchaseOrderItemRowWithProduct = PurchaseOrderItemRow & {
    product?: ProdutoRow | null
}

type PurchaseOrderRowWithFornecedor = PurchaseOrderRow & {
    fornecedor?: { nome: string } | null
}

type PurchaseOrderRowWithRelations = PurchaseOrderRowWithFornecedor & {
    items?: PurchaseOrderItemRow[]
    payments?: PurchaseOrderPaymentRow[]
}

// ---------------------------------------------------
// Mappers
// ---------------------------------------------------

export const toDomainContato = (dbContato: ContatoRowWithIndicador): DomainContato => {
    if (!dbContato) throw new Error('Cannot map null contact')
    return {
        id: dbContato.id,
        nome: dbContato.nome,
        telefone: dbContato.telefone || '',
        email: dbContato.email || null,
        apelido: dbContato.apelido || null,
        origem: (dbContato.origem || 'direto') as DomainContato['origem'],
        status: (dbContato.status || 'lead') as DomainContato['status'],
        tipo: (dbContato.tipo || 'B2C') as DomainContato['tipo'],
        subtipo: dbContato.subtipo || null,
        indicadoPorId: dbContato.indicado_por_id,
        indicador: dbContato.indicador ? {
            id: dbContato.indicador.id,
            nome: dbContato.indicador.nome
        } : null,
        criadoEm: dbContato.criado_em || new Date().toISOString(),
        atualizadoEm: dbContato.atualizado_em || dbContato.criado_em || new Date().toISOString(),
        bairro: dbContato.bairro || null,
        cep: dbContato.cep || null,
        endereco: dbContato.endereco || null,
        logradouro: dbContato.logradouro || null,
        numero: dbContato.numero || null,
        complemento: dbContato.complemento || null,
        cidade: dbContato.cidade || null,
        uf: dbContato.uf || null,
        lat: dbContato.latitude || null,
        lng: dbContato.longitude || null,
        observacoes: dbContato.observacoes || dbContato.observacao || null
    }
}

export const toDomainProduto = (dbProduto: ProdutoRowWithImages): DomainProduto => {
    if (!dbProduto) throw new Error('Cannot map null product')
    return {
        id: dbProduto.id,
        nome: dbProduto.nome,
        codigo: dbProduto.codigo,
        preco: Number(dbProduto.preco || 0),
        unidade: dbProduto.unidade || 'un',
        ativo: dbProduto.ativo ?? true,
        custo: Number(dbProduto.custo || 0),
        estoqueAtual: Number(dbProduto.estoque_atual || 0),
        estoqueMinimo: Number(dbProduto.estoque_minimo || 0),
        criadoEm: dbProduto.criado_em || new Date().toISOString(),
        atualizadoEm: dbProduto.atualizado_em || dbProduto.criado_em || new Date().toISOString(),
        apelido: dbProduto.apelido || null,
        subtitulo: dbProduto.subtitulo || null,
        precoAncoragem: dbProduto.preco_ancoragem
            ? Number(dbProduto.preco_ancoragem)
            : null,
        categoria: dbProduto.categoria || null,
        imagemUrl: dbProduto.sis_imagens_produto?.url
    }
}

export const toDomainItemVenda = (dbItem: ItemVendaRowWithProduto): DomainItemVenda => {
    return {
        id: dbItem.id,
        produtoId: dbItem.produto_id,
        produto: dbItem.produto ? toDomainProduto(dbItem.produto as ProdutoRowWithImages) : undefined,
        quantidade: Number(dbItem.quantidade || 0),
        precoUnitario: Number(dbItem.preco_unitario || 0),
        subtotal: Number(dbItem.subtotal || 0)
    }
}

export const toDomainPagamento = (dbPagamento: PagamentoRowWithStatus): DomainPagamento => {
    return {
        id: dbPagamento.id,
        vendaId: dbPagamento.venda_id,
        valor: Number(dbPagamento.valor || 0),
        data: dbPagamento.data,
        metodo: dbPagamento.metodo as DomainPagamento['metodo'],
        status: (dbPagamento.status || 'pago') as DomainPagamento['status'],
        observacao: dbPagamento.observacao
    }
}

export const toDomainVenda = (dbVenda: VendaRowWithRelations): DomainVenda => {
    return {
        id: dbVenda.id,
        contatoId: dbVenda.contato_id,
        contato: dbVenda.contato ? toDomainContato(dbVenda.contato as ContatoRowWithIndicador) : undefined,
        data: dbVenda.data,
        total: Number(dbVenda.total || 0),
        custoTotal: Number(dbVenda.custo_total || 0),
        status: dbVenda.status as DomainVenda['status'],
        pago: dbVenda.pago ?? false,
        formaPagamento: dbVenda.forma_pagamento as DomainVenda['formaPagamento'],
        taxaEntrega: Number(dbVenda.taxa_entrega || 0),
        itens: (dbVenda.itens || []).map(i => toDomainItemVenda(i as ItemVendaRowWithProduto)),
        pagamentos: (dbVenda.pagamentos || []).map(p => toDomainPagamento(p as PagamentoRowWithStatus)),
        criadoEm: dbVenda.criado_em,
        valorPago: (dbVenda.pagamentos || []).reduce((acc: number, p) => acc + Number((p as PagamentoRowWithStatus).valor || 0), 0),
        origem: dbVenda.origem,
        dataPrevistaPagamento: dbVenda.data_prevista_pagamento
    }
}

/* PURCHASE ORDERS MAPPERS */

export const toDomainPurchaseOrderItem = (dbItem: PurchaseOrderItemRowWithProduct): DomainPurchaseOrderItem => {
    return {
        id: dbItem.id,
        productId: dbItem.product_id,
        product: dbItem.product ? toDomainProduto(dbItem.product as ProdutoRowWithImages) : undefined,
        quantity: Number(dbItem.quantity || 0),
        unitCost: Number(dbItem.unit_cost || 0),
        totalCost: Number(dbItem.total_cost || (Number(dbItem.quantity || 0) * Number(dbItem.unit_cost || 0)))
    }
}

export const toDomainPurchaseOrder = (dbOrder: PurchaseOrderRowWithFornecedor): DomainPurchaseOrder => {
    return {
        id: dbOrder.id,
        fornecedorId: dbOrder.fornecedor_id,
        fornecedor: dbOrder.fornecedor ? {
            id: dbOrder.fornecedor_id,
            nome: dbOrder.fornecedor.nome
        } : undefined,
        orderDate: dbOrder.order_date,
        status: dbOrder.status as PurchaseOrderStatus,
        paymentStatus: dbOrder.payment_status as PurchaseOrderPaymentStatus,
        totalAmount: Number(dbOrder.total_amount || 0),
        amountPaid: Number(dbOrder.amount_paid || 0),
        notes: dbOrder.notes,
        dataRecebimento: dbOrder.data_recebimento,
        createdAt: dbOrder.created_at || new Date().toISOString()
    }
}

export const toDomainPurchaseOrderWithItems = (dbOrder: PurchaseOrderRowWithRelations): DomainPurchaseOrderWithItems => {
    return {
        ...toDomainPurchaseOrder(dbOrder),
        items: (dbOrder.items || []).map((i: any) => toDomainPurchaseOrderItem(i as PurchaseOrderItemRowWithProduct)),
        payments: dbOrder.payments || []
    }
}

export type CatalogOrderRowWithItems = CatalogOrderRow & {
    itens?: CatalogOrderItemRow[]
    venda_id?: string | null
}

export const toDomainCatalogOrderItem = (dbItem: CatalogOrderItemRow): DomainCatalogOrderItem => {
    return {
        id: dbItem.id,
        pedidoId: dbItem.pedido_id || '',
        produtoId: dbItem.produto_id || '',
        nomeProduto: dbItem.nome_produto,
        quantidade: Number(dbItem.quantidade || 0),
        precoUnitario: Number(dbItem.preco_unitario || 0),
        total: Number(dbItem.total || 0)
    }
}

export const toDomainCatalogOrder = (dbOrder: CatalogOrderRowWithItems): DomainCatalogOrder => {
    return {
        id: dbOrder.id,
        numeroPedido: dbOrder.numero_pedido,
        nomeCliente: dbOrder.nome_cliente,
        telefoneCliente: dbOrder.telefone_cliente,
        enderecoEntrega: dbOrder.endereco_entrega,
        metodoEntrega: dbOrder.metodo_entrega as DomainCatalogOrder['metodoEntrega'],
        status: dbOrder.status as CatalogOrderStatus,
        subtotal: Number(dbOrder.subtotal || 0),
        frete: Number(dbOrder.frete || 0),
        total: Number(dbOrder.total || 0),
        metodoPagamento: dbOrder.metodo_pagamento as PagamentoMetodo,
        statusPagamento: dbOrder.status_pagamento as CatalogPaymentStatus,
        observacoes: dbOrder.observacoes,
        indicadoPor: dbOrder.indicado_por,
        criadoEm: dbOrder.criado_em || new Date().toISOString(),
        atualizadoEm: dbOrder.atualizado_em || dbOrder.criado_em || new Date().toISOString(),
        contatoId: dbOrder.contato_id,
        vendaId: dbOrder.venda_id ?? null,
        itens: (dbOrder.itens || []).map((i: any) => toDomainCatalogOrderItem(i))
    }
}
