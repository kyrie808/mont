import type { Database } from './database'

type Table<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
type View<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']
export type Insert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Update<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type Tables<T extends keyof (Database['public']['Tables'] & Database['public']['Views'])> = (Database['public']['Tables'] & Database['public']['Views'])[T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

export type Conta = Table<'contas'>
export type PlanoConta = Table<'plano_de_contas'>
export type Lancamento = Table<'lancamentos'>
export type ExtratoItem = View<'view_extrato_mensal'>
export type FluxoResumo = View<'view_fluxo_resumo'>

export type Venda = Table<'vendas'>
export type Contato = Table<'contatos'>
export type Produto = Table<'produtos'>
export type ItemVenda = Table<'itens_venda'>
export type PagamentoVenda = Table<'pagamentos_venda'>

export type PurchaseOrder = Table<'purchase_orders'>
export type PurchaseOrderItem = Table<'purchase_order_items'>
export type PurchaseOrderPayment = Table<'purchase_order_payments'>

export type ContaAPagar = Table<'contas_a_pagar'>
export type PagamentoContaAPagar = Table<'pagamentos_conta_a_pagar'>

export type VendaInsert = Insert<'vendas'>
export type VendaUpdate = Update<'vendas'>
export type ContatoInsert = Insert<'contatos'>
export type ContatoUpdate = Update<'contatos'>
export type ProdutoInsert = Insert<'produtos'>
export type ProdutoUpdate = Update<'produtos'>
export type ItemVendaInsert = Insert<'itens_venda'>

export type ProdutoCatalogo = View<'vw_catalogo_produtos'>
export type PedidoCatalogo = Table<'cat_pedidos'>
export type ItemPedidoCatalogo = Table<'cat_itens_pedido'>
export type ImagemProdutoCatalogo = Table<'cat_imagens_produto'>
