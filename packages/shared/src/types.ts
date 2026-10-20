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

// Selo (badge) do card do catálogo — curado manualmente no interno (campo produtos.selo).
// NÃO é métrica de vendas; `destaque` continua sendo só "aparece no carrossel".
export type SeloVariant = 'mais_vendido' | 'oferta' | 'queridinho'

// Seções da vitrine do catálogo (curadoria gerenciada no interno)
export type Secao = Table<'cat_secoes'>
export type SecaoInsert = Insert<'cat_secoes'>
export type SecaoUpdate = Update<'cat_secoes'>

// Meta fixa de faturamento por mês (mínima/alvo) — painel do interno
export type MetaMensal = Table<'metas_mensais'>

// Agenda de Retornos — tabela lembretes e as leituras agenda_itens / agenda_atrasados /
// agenda_sem_data (migration 20261019195019_agenda_lembretes).
export type Lembrete = Table<'lembretes'>
export type LembreteInsert = Insert<'lembretes'>

type RetornoFn<T extends keyof Database['public']['Functions']> =
    Database['public']['Functions'][T]['Returns'] extends (infer R)[] ? R : never

export type OrigemItemAgenda = 'lembrete' | 'vencimento' | 'entrega' | 'conta_pagar' | 'retomada'

/**
 * Um item de agenda_itens() / agenda_atrasados() (mesmo formato nas duas).
 * O gerador do Supabase marca toda coluna de RETURNS TABLE como não-nula; aqui fica a
 * nulidade real: hora (dia inteiro), tipo (só lembrete), contato_* (conta a pagar e
 * lembrete sem cliente), venda_id, forma_pagamento, descricao, valor e responsavel podem vir NULL.
 */
export type ItemAgenda = Omit<
    RetornoFn<'agenda_itens'>,
    'origem' | 'hora' | 'descricao' | 'tipo' | 'contato_id' | 'contato_nome' | 'contato_telefone' | 'venda_id' | 'forma_pagamento' | 'valor' | 'responsavel'
> & {
    origem: OrigemItemAgenda
    hora: string | null
    descricao: string | null
    tipo: string | null
    contato_id: string | null
    contato_nome: string | null
    contato_telefone: string | null
    venda_id: string | null
    forma_pagamento: string | null
    valor: number | null
    /** luccas | gilmar | equipe no lembrete; NULL nas camadas (migration 20261019205333). */
    responsavel: string | null
}

/** Uma venda em aberto sem data de agenda_sem_data() (todas as colunas vêm preenchidas). */
export type ItemSemData = RetornoFn<'agenda_sem_data'>
