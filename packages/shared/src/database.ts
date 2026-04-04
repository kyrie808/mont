export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          criado_em: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          criado_em?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      cat_imagens_produto: {
        Row: {
          alt_text: string | null
          ativo: boolean | null
          created_at: string | null
          id: string
          ordem: number | null
          produto_id: string
          tipo: string
          updated_at: string | null
          url: string
        }
        Insert: {
          alt_text?: string | null
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          ordem?: number | null
          produto_id: string
          tipo?: string
          updated_at?: string | null
          url: string
        }
        Update: {
          alt_text?: string | null
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          ordem?: number | null
          produto_id?: string
          tipo?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "cat_imagens_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          }
        ]
      }
      cat_itens_pedido: {
        Row: {
          id: string
          nome_produto: string
          pedido_id: string | null
          preco_unitario: number | null
          produto_id: string | null
          quantidade: number
          total: number | null
        }
        Insert: {
          id?: string
          nome_produto: string
          pedido_id?: string | null
          preco_unitario?: number | null
          produto_id?: string | null
          quantidade: number
          total?: number | null
        }
        Update: {
          id?: string
          nome_produto?: string
          pedido_id?: string | null
          preco_unitario?: number | null
          produto_id?: string | null
          quantidade?: number
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_itens_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "cat_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cat_itens_pedido_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          }
        ]
      }
      cat_pedidos: {
        Row: {
          atualizado_em: string | null
          contato_id: string | null
          criado_em: string | null
          endereco_entrega: string | null
          frete: number | null
          id: string
          indicado_por: string | null
          metodo_entrega: string | null
          metodo_pagamento: string | null
          nome_cliente: string
          numero_pedido: number
          observacoes: string | null
          status: string | null
          status_pagamento: string | null
          subtotal: number | null
          telefone_cliente: string
          total: number | null
        }
        Insert: {
          atualizado_em?: string | null
          contato_id?: string | null
          criado_em?: string | null
          endereco_entrega?: string | null
          frete?: number | null
          id?: string
          indicado_por?: string | null
          metodo_entrega?: string | null
          metodo_pagamento?: string | null
          nome_cliente: string
          numero_pedido?: number
          observacoes?: string | null
          status?: string | null
          status_pagamento?: string | null
          subtotal?: number | null
          telefone_cliente: string
          total?: number | null
        }
        Update: {
          atualizado_em?: string | null
          contato_id?: string | null
          criado_em?: string | null
          endereco_entrega?: string | null
          frete?: number | null
          id?: string
          indicado_por?: string | null
          metodo_entrega?: string | null
          metodo_pagamento?: string | null
          nome_cliente?: string
          numero_pedido?: number
          observacoes?: string | null
          status?: string | null
          status_pagamento?: string | null
          subtotal?: number | null
          telefone_cliente?: string
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cat_pedidos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          }
        ]
      }
      configuracoes: {
        Row: {
          atualizado_em: string
          chave: string
          id: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          chave: string
          id?: string
          valor: Json
        }
        Update: {
          atualizado_em?: string
          chave?: string
          id?: string
          valor?: Json
        }
        Relationships: []
      }
      contas: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          banco: string | null
          codigo: string | null
          created_by: string | null
          criado_em: string | null
          id: string
          nome: string
          saldo_atual: number | null
          saldo_inicial: number | null
          tipo: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          banco?: string | null
          codigo?: string | null
          created_by?: string | null
          criado_em?: string | null
          id?: string
          nome: string
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          banco?: string | null
          codigo?: string | null
          created_by?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      contatos: {
        Row: {
          apelido: string | null
          atualizado_em: string
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_by: string | null
          criado_em: string
          endereco: string | null
          id: string
          indicado_por_id: string | null
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          nome: string
          numero: string | null
          observacoes: string | null
          origem: string
          status: string
          subtipo: string | null
          telefone: string
          tipo: string
          uf: string | null
          ultimo_contato: string | null
          updated_by: string | null
        }
        Insert: {
          apelido?: string | null
          atualizado_em?: string
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_by?: string | null
          criado_em?: string
          endereco?: string | null
          id?: string
          indicado_por_id?: string | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          origem?: string
          status?: string
          subtipo?: string | null
          telefone: string
          tipo: string
          uf?: string | null
          ultimo_contato?: string | null
          updated_by?: string | null
        }
        Update: {
          apelido?: string | null
          atualizado_em?: string
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_by?: string | null
          criado_em?: string
          endereco?: string | null
          id?: string
          indicado_por_id?: string | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          origem?: string
          status?: string
          subtipo?: string | null
          telefone?: string
          tipo?: string
          uf?: string | null
          ultimo_contato?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      itens_venda: {
        Row: {
          custo_unitario: number | null
          id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Insert: {
          custo_unitario?: number | null
          id?: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Update: {
          custo_unitario?: number | null
          id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
          venda_id?: string
        }
        Relationships: []
      }
      lancamentos: {
        Row: {
          atualizado_em: string | null
          conta_destino_id: string | null
          conta_id: string
          created_by: string | null
          criado_em: string | null
          data: string
          descricao: string | null
          id: string
          origem: string
          plano_conta_id: string | null
          tipo: string
          updated_by: string | null
          valor: number
          venda_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          conta_destino_id?: string | null
          conta_id: string
          created_by?: string | null
          criado_em?: string | null
          data?: string
          descricao?: string | null
          id?: string
          origem: string
          plano_conta_id?: string | null
          tipo: string
          updated_by?: string | null
          valor: number
          venda_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          conta_destino_id?: string | null
          conta_id?: string
          created_by?: string | null
          criado_em?: string | null
          data?: string
          descricao?: string | null
          id?: string
          origem?: string
          plano_conta_id?: string | null
          tipo?: string
          updated_by?: string | null
          valor?: number
          venda_id?: string | null
        }
        Relationships: []
      }
      pagamentos_venda: {
        Row: {
          criado_em: string
          data: string
          id: string
          metodo: string
          observacao: string | null
          valor: number
          venda_id: string
        }
        Insert: {
          criado_em?: string
          data?: string
          id?: string
          metodo?: string
          observacao?: string | null
          valor: number
          venda_id: string
        }
        Update: {
          criado_em?: string
          data?: string
          id?: string
          metodo?: string
          observacao?: string | null
          valor?: number
          venda_id?: string
        }
        Relationships: []
      }
      plano_de_contas: {
        Row: {
          ativo: boolean | null
          automatica: boolean | null
          categoria: string
          codigo: string | null
          criado_em: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          automatica?: boolean | null
          categoria: string
          codigo?: string | null
          criado_em?: string | null
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          automatica?: boolean | null
          categoria?: string
          codigo?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          apelido: string | null
          ativo: boolean
          atualizado_em: string
          categoria: string | null
          codigo: string
          criado_em: string
          custo: number
          descricao: string | null
          destaque: boolean | null
          estoque_atual: number | null
          estoque_minimo: number | null
          id: string
          instrucoes_preparo: string | null
          nome: string
          peso_kg: number | null
          preco: number
          preco_ancoragem: number | null
          slug: string | null
          subtitulo: string | null
          unidade: string
          visivel_catalogo: boolean
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          codigo: string
          criado_em?: string
          custo: number
          descricao?: string | null
          destaque?: boolean | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          instrucoes_preparo?: string | null
          nome: string
          peso_kg?: number | null
          preco: number
          preco_ancoragem?: number | null
          slug?: string | null
          subtitulo?: string | null
          unidade?: string
          visivel_catalogo?: boolean
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          codigo?: string
          criado_em?: string
          custo?: number
          descricao?: string | null
          destaque?: boolean | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          instrucoes_preparo?: string | null
          nome?: string
          peso_kg?: number | null
          preco?: number
          preco_ancoragem?: number | null
          slug?: string | null
          subtitulo?: string | null
          unidade?: string
          visivel_catalogo?: boolean
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          total_cost: number | null
          unit_cost: number
        }
        Insert: {
          id?: string
          product_id: string
          purchase_order_id: string
          quantity: number
          total_cost?: number | null
          unit_cost: number
        }
        Update: {
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          total_cost?: number | null
          unit_cost?: number
        }
        Relationships: []
      }
      purchase_order_payments: {
        Row: {
          amount: number
          atualizado_em: string | null
          conta_id: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          purchase_order_id: string
        }
        Insert: {
          amount: number
          atualizado_em?: string | null
          conta_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          purchase_order_id: string
        }
        Update: {
          amount?: number
          atualizado_em?: string | null
          conta_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          purchase_order_id?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          data_recebimento: string | null
          fornecedor_id: string
          id: string
          notes: string | null
          order_date: string
          payment_status: Database["public"]["Enums"]["purchase_order_payment_status"]
          status: Database["public"]["Enums"]["purchase_order_status"]
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          data_recebimento?: string | null
          fornecedor_id: string
          id?: string
          notes?: string | null
          order_date?: string
          payment_status?: Database["public"]["Enums"]["purchase_order_payment_status"]
          status?: Database["public"]["Enums"]["purchase_order_status"]
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          data_recebimento?: string | null
          fornecedor_id?: string
          id?: string
          notes?: string | null
          order_date?: string
          payment_status?: Database["public"]["Enums"]["purchase_order_payment_status"]
          status?: Database["public"]["Enums"]["purchase_order_status"]
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      contas_a_pagar: {
        Row: {
          atualizado_em: string | null
          created_at: string | null
          created_by: string | null
          credor: string
          criado_em: string | null
          data_emissao: string
          data_vencimento: string
          descricao: string
          id: string
          observacao: string | null
          parcela_atual: number | null
          plano_conta_id: string
          referencia: string | null
          saldo_devedor: number | null
          status: string
          total_parcelas: number | null
          updated_at: string | null
          updated_by: string | null
          valor_pago: number
          valor_total: number
        }
        Insert: {
          atualizado_em?: string | null
          created_at?: string | null
          created_by?: string | null
          credor: string
          criado_em?: string | null
          data_emissao?: string
          data_vencimento: string
          descricao: string
          id?: string
          observacao?: string | null
          parcela_atual?: number | null
          plano_conta_id: string
          referencia?: string | null
          saldo_devedor?: number | null
          status?: string
          total_parcelas?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valor_pago?: number
          valor_total: number
        }
        Update: {
          atualizado_em?: string | null
          created_at?: string | null
          created_by?: string | null
          credor?: string
          criado_em?: string | null
          data_emissao?: string
          data_vencimento?: string
          descricao?: string
          id?: string
          observacao?: string | null
          parcela_atual?: number | null
          plano_conta_id?: string
          referencia?: string | null
          saldo_devedor?: number | null
          status?: string
          total_parcelas?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valor_pago?: number
          valor_total?: number
        }
        Relationships: []
      }
      pagamentos_conta_a_pagar: {
        Row: {
          atualizado_em: string | null
          conta_a_pagar_id: string
          conta_id: string
          created_at: string | null
          created_by: string | null
          criado_em: string | null
          data_pagamento: string
          id: string
          metodo_pagamento: string
          observacao: string | null
          updated_by: string | null
          valor: number
        }
        Insert: {
          atualizado_em?: string | null
          conta_a_pagar_id: string
          conta_id: string
          created_at?: string | null
          created_by?: string | null
          criado_em?: string | null
          data_pagamento?: string
          id?: string
          metodo_pagamento?: string
          observacao?: string | null
          updated_by?: string | null
          valor: number
        }
        Update: {
          atualizado_em?: string | null
          conta_a_pagar_id?: string
          conta_id?: string
          created_at?: string | null
          created_by?: string | null
          criado_em?: string | null
          data_pagamento?: string
          id?: string
          metodo_pagamento?: string
          observacao?: string | null
          updated_by?: string | null
          valor?: number
        }
        Relationships: []
      }
      vendas: {
        Row: {
          atualizado_em: string
          cat_pedido_id: string | null
          contato_id: string
          created_by: string | null
          criado_em: string
          custo_total: number | null
          data: string
          data_entrega: string | null
          data_prevista_pagamento: string | null
          forma_pagamento: string
          id: string
          observacoes: string | null
          origem: string | null
          pago: boolean
          parcelas: number | null
          status: string
          taxa_entrega: number | null
          total: number
          updated_by: string | null
          valor_pago: number | null
        }
        Insert: {
          atualizado_em?: string
          cat_pedido_id?: string | null
          contato_id: string
          created_by?: string | null
          criado_em?: string
          custo_total?: number | null
          data?: string
          data_entrega?: string | null
          data_prevista_pagamento?: string | null
          forma_pagamento: string
          id?: string
          observacoes?: string | null
          origem?: string | null
          pago?: boolean
          parcelas?: number | null
          status?: string
          taxa_entrega?: number | null
          total: number
          updated_by?: string | null
          valor_pago?: number | null
        }
        Update: {
          atualizado_em?: string
          cat_pedido_id?: string | null
          contato_id?: string
          created_by?: string | null
          criado_em?: string
          custo_total?: number | null
          data?: string
          data_entrega?: string | null
          data_prevista_pagamento?: string | null
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          origem?: string | null
          pago?: boolean
          parcelas?: number | null
          status?: string
          taxa_entrega?: number | null
          total?: number
          updated_by?: string | null
          valor_pago?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      vw_catalogo_produtos: {
        Row: {
          categoria: string | null
          codigo: string | null
          descricao: string | null
          destaque: boolean | null
          estoque_atual: number | null
          estoque_minimo: number | null
          id: string | null
          imagens: Json | null
          instrucoes_preparo: string | null
          nome: string | null
          preco: number | null
          preco_ancoragem: number | null
          preco_formatado: string | null
          slug: string | null
          status_estoque: string | null
          subtitulo: string | null
          url_imagem_principal: string | null
          visivel_catalogo: boolean | null
        }
      }
      view_extrato_mensal: {
        Row: {
          categoria_nome: string | null
          categoria_tipo: string | null
          conta_id: string | null
          data: string | null
          descricao: string | null
          id: string | null
          origem: string | null
          tipo: string | null
          valor: number | null
        }
      }
      view_fluxo_resumo: {
        Row: {
          ano: number | null
          lucro_estimado: number | null
          mes: number | null
          total_a_receber: number | null
          total_entradas: number | null
          total_faturamento: number | null
          total_saidas: number | null
        }
      },
      cat_pedidos_pendentes_vinculacao: {
        Row: {
          criado_em: string
          cat_pedido_id: string
          id: string
          motivo_falha: string | null
        }
      }
    }
    Enums: {
      purchase_order_payment_status: "paid" | "partial" | "unpaid"
      purchase_order_status: "pending" | "received" | "cancelled"
    }
  }
}

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
