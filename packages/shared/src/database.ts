export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
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
          },
          {
            foreignKeyName: "cat_imagens_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "rpt_giro_estoque"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "cat_imagens_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "rpt_margem_por_sku"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "cat_imagens_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_catalogo_produtos"
            referencedColumns: ["id"]
          },
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
          },
          {
            foreignKeyName: "cat_itens_pedido_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "rpt_giro_estoque"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "cat_itens_pedido_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "rpt_margem_por_sku"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "cat_itens_pedido_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_catalogo_produtos"
            referencedColumns: ["id"]
          },
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
          },
          {
            foreignKeyName: "cat_pedidos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_compras"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "cat_pedidos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_indicacoes"
            referencedColumns: ["indicador_id"]
          },
          {
            foreignKeyName: "cat_pedidos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "rpt_ltv_por_cliente"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "cat_pedidos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_home_alertas"
            referencedColumns: ["contato_id"]
          },
        ]
      }
      cat_pedidos_pendentes_vinculacao: {
        Row: {
          cat_pedido_id: string
          criado_em: string | null
          id: string
          motivo_falha: string
        }
        Insert: {
          cat_pedido_id: string
          criado_em?: string | null
          id?: string
          motivo_falha: string
        }
        Update: {
          cat_pedido_id?: string
          criado_em?: string | null
          id?: string
          motivo_falha?: string
        }
        Relationships: [
          {
            foreignKeyName: "cat_pedidos_pendentes_vinculacao_cat_pedido_id_fkey"
            columns: ["cat_pedido_id"]
            isOneToOne: false
            referencedRelation: "cat_pedidos"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "contas_a_pagar_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "plano_de_contas"
            referencedColumns: ["id"]
          },
        ]
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
          fts: unknown
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
          fts?: unknown
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
          fts?: unknown
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
        Relationships: [
          {
            foreignKeyName: "contatos_indicado_por_id_fkey"
            columns: ["indicado_por_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contatos_indicado_por_id_fkey"
            columns: ["indicado_por_id"]
            isOneToOne: false
            referencedRelation: "ranking_compras"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "contatos_indicado_por_id_fkey"
            columns: ["indicado_por_id"]
            isOneToOne: false
            referencedRelation: "ranking_indicacoes"
            referencedColumns: ["indicador_id"]
          },
          {
            foreignKeyName: "contatos_indicado_por_id_fkey"
            columns: ["indicado_por_id"]
            isOneToOne: false
            referencedRelation: "rpt_ltv_por_cliente"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "contatos_indicado_por_id_fkey"
            columns: ["indicado_por_id"]
            isOneToOne: false
            referencedRelation: "view_home_alertas"
            referencedColumns: ["contato_id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "itens_venda_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_venda_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "rpt_giro_estoque"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "itens_venda_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "rpt_margem_por_sku"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "itens_venda_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_catalogo_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_venda_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "rpt_projecao_recebimentos"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "itens_venda_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "lancamentos_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "plano_de_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "rpt_projecao_recebimentos"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "lancamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "pagamentos_conta_a_pagar_conta_a_pagar_id_fkey"
            columns: ["conta_a_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_a_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_conta_a_pagar_conta_a_pagar_id_fkey"
            columns: ["conta_a_pagar_id"]
            isOneToOne: false
            referencedRelation: "rpt_projecao_pagamentos"
            referencedColumns: ["conta_a_pagar_id"]
          },
          {
            foreignKeyName: "pagamentos_conta_a_pagar_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "pagamentos_venda_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "rpt_projecao_recebimentos"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "pagamentos_venda_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "rpt_giro_estoque"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "rpt_margem_por_sku"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_catalogo_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "purchase_order_payments_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_payments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "purchase_orders_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "ranking_compras"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "purchase_orders_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "ranking_indicacoes"
            referencedColumns: ["indicador_id"]
          },
          {
            foreignKeyName: "purchase_orders_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "rpt_ltv_por_cliente"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "purchase_orders_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "view_home_alertas"
            referencedColumns: ["contato_id"]
          },
        ]
      }
      sis_imagens_produto: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          ordem: number | null
          produto_id: string | null
          tipo: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          ordem?: number | null
          produto_id?: string | null
          tipo?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          ordem?: number | null
          produto_id?: string | null
          tipo?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sis_imagens_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sis_imagens_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
            referencedRelation: "rpt_giro_estoque"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "sis_imagens_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
            referencedRelation: "rpt_margem_por_sku"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "sis_imagens_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
            referencedRelation: "vw_catalogo_produtos"
            referencedColumns: ["id"]
          },
        ]
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
          fts: unknown
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
          fts?: unknown
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
          fts?: unknown
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
        Relationships: [
          {
            foreignKeyName: "vendas_cat_pedido_id_fkey"
            columns: ["cat_pedido_id"]
            isOneToOne: true
            referencedRelation: "cat_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_compras"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "vendas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_indicacoes"
            referencedColumns: ["indicador_id"]
          },
          {
            foreignKeyName: "vendas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "rpt_ltv_por_cliente"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "vendas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_home_alertas"
            referencedColumns: ["contato_id"]
          },
        ]
      }
    }
    Views: {
      crm_view_monthly_sales: {
        Row: {
          ano: number | null
          custo_total: number | null
          faturamento: number | null
          lucro: number | null
          mes: number | null
          ticket_medio: number | null
          total_vendas: number | null
        }
        Relationships: []
      }
      crm_view_operational_snapshot: {
        Row: {
          clientes_ativos: number | null
          entregas_hoje_pendentes: number | null
          entregas_hoje_realizadas: number | null
          entregas_pendentes_total: number | null
          total_a_receber: number | null
        }
        Relationships: []
      }
      ranking_compras: {
        Row: {
          contato_id: string | null
          nome: string | null
          total_compras: number | null
          total_pontos: number | null
          ultima_compra: string | null
        }
        Relationships: []
      }
      ranking_indicacoes: {
        Row: {
          indicador_id: string | null
          nome: string | null
          total_indicados: number | null
          total_vendas_indicados: number | null
        }
        Relationships: []
      }
      rpt_break_even_mensal: {
        Row: {
          break_even_receita: number | null
          cobertura_despesas: number | null
          custo_fabrica: number | null
          custo_produtos: number | null
          despesas_operacionais: number | null
          lucro_bruto: number | null
          lucro_liquido: number | null
          margem_contribuicao_pct: number | null
          margem_liquida_pct: number | null
          mes: string | null
          receita_bruta: number | null
        }
        Relationships: []
      }
      rpt_distribuicao_forma_pagamento: {
        Row: {
          faturamento: number | null
          forma_pagamento: string | null
          pct_contagem: number | null
          pct_faturamento: number | null
          total_vendas: number | null
          vendas_liquidadas: number | null
          vendas_pendentes: number | null
        }
        Relationships: []
      }
      rpt_faturamento_comparativo: {
        Row: {
          ano: number | null
          faturamento: number | null
          faturamento_anterior: number | null
          liquidado_mes: number | null
          lucro_estimado: number | null
          margem_bruta_pct: number | null
          mes: number | null
          total_a_receber: number | null
          variacao_faturamento_percentual: number | null
        }
        Relationships: []
      }
      rpt_giro_estoque: {
        Row: {
          codigo: string | null
          estoque_atual: number | null
          estoque_minimo: number | null
          giro_estoque: number | null
          nome: string | null
          produto_id: string | null
          status_estoque: string | null
          total_comprado_historico: number | null
          total_vendido_historico: number | null
        }
        Relationships: []
      }
      rpt_ltv_por_cliente: {
        Row: {
          contato_id: string | null
          dias_relacionamento: number | null
          ltv_total: number | null
          nome: string | null
          primeira_compra: string | null
          status: string | null
          telefone: string | null
          ticket_medio: number | null
          tipo: string | null
          total_pedidos: number | null
          ultima_compra: string | null
        }
        Relationships: []
      }
      rpt_margem_por_sku: {
        Row: {
          codigo: string | null
          custo_total: number | null
          lucro_bruto: number | null
          margem_pct: number | null
          nome: string | null
          produto_id: string | null
          receita_total: number | null
          total_vendido: number | null
          unidade: string | null
        }
        Relationships: []
      }
      rpt_prazo_medio_recebimento: {
        Row: {
          mes: string | null
          pagamento_imediato: number | null
          pago_1_7_dias: number | null
          pago_8_30_dias: number | null
          pago_mais_30_dias: number | null
          prazo_medio_dias: number | null
          vendas_liquidadas: number | null
        }
        Relationships: []
      }
      rpt_projecao_pagamentos: {
        Row: {
          categoria_nome: string | null
          conta_a_pagar_id: string | null
          credor: string | null
          data_vencimento: string | null
          descricao: string | null
          dias_atraso: number | null
          parcela_atual: number | null
          plano_conta_id: string | null
          referencia: string | null
          saldo_devedor: number | null
          situacao: string | null
          total_parcelas: number | null
          valor_pago: number | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_a_pagar_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "plano_de_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      rpt_projecao_recebimentos: {
        Row: {
          contato_nome: string | null
          contato_telefone: string | null
          data_prevista_pagamento: string | null
          data_venda: string | null
          saldo_aberto: number | null
          situacao: string | null
          total: number | null
          valor_pago: number | null
          venda_id: string | null
        }
        Relationships: []
      }
      view_contas_a_pagar_dashboard: {
        Row: {
          qtd_pendentes: number | null
          qtd_vencidas: number | null
          total_a_pagar: number | null
          total_vencido: number | null
        }
        Relationships: []
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
        Relationships: []
      }
      view_extrato_saldo: {
        Row: {
          entradas: number | null
          mes: string | null
          mes_ordem: string | null
          saidas: number | null
          saldo_acumulado: number | null
          saldo_mes: number | null
        }
        Relationships: []
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
        Relationships: []
      }
      view_home_alertas: {
        Row: {
          contato_id: string | null
          data_ultima_compra: string | null
          dias_sem_compra: number | null
          nome: string | null
          telefone: string | null
        }
        Relationships: []
      }
      view_home_financeiro: {
        Row: {
          alertas_financeiros: Json | null
          ano: number | null
          faturamento: number | null
          faturamento_anterior: number | null
          liquidado_mes: number | null
          liquidado_mes_count: number | null
          lucro_estimado: number | null
          mes: number | null
          ticket_medio: number | null
          total_a_receber: number | null
          variacao_faturamento_percentual: number | null
        }
        Relationships: []
      }
      view_home_operacional: {
        Row: {
          ano: number | null
          clientes_ativos: number | null
          mes: number | null
          pedidos_entregues_hoje: number | null
          pedidos_pendentes: number | null
          ranking_indicacoes: Json | null
          total_itens: number | null
          total_vendas: number | null
          ultimas_vendas: Json | null
        }
        Relationships: []
      }
      view_liquidado_mensal: {
        Row: {
          mes: string | null
          total_liquidado: number | null
          vendas_liquidadas: number | null
        }
        Relationships: []
      }
      view_lucro_liquido_mensal: {
        Row: {
          custo_fabrica: number | null
          custo_produtos: number | null
          despesas_operacionais: number | null
          lucro_bruto: number | null
          lucro_liquido: number | null
          margem_liquida_pct: number | null
          mes: string | null
          receita_bruta: number | null
        }
        Relationships: []
      }
      vw_admin_dashboard: {
        Row: {
          faturamento_hoje: number | null
          faturamento_mes: number | null
          pedidos_pendentes: number | null
          produtos_ativos: number | null
          produtos_estoque_baixo: number | null
          produtos_inativos: number | null
          ultimos_pedidos: Json | null
        }
        Relationships: []
      }
      vw_catalogo_produtos: {
        Row: {
          anchor_price: number | null
          category: string | null
          codigo: string | null
          descricao: string | null
          id: string | null
          images: Json | null
          instrucoes_preparo: string | null
          is_active: boolean | null
          is_featured: boolean | null
          nome: string | null
          price: number | null
          price_formatted: string | null
          primary_image_url: string | null
          slug: string | null
          stock_min_alert: number | null
          stock_quantity: number | null
          stock_status: string | null
          subtitle: string | null
        }
        Insert: {
          anchor_price?: number | null
          category?: string | null
          codigo?: string | null
          descricao?: string | null
          id?: string | null
          images?: never
          instrucoes_preparo?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          nome?: string | null
          price?: number | null
          price_formatted?: never
          primary_image_url?: never
          slug?: string | null
          stock_min_alert?: number | null
          stock_quantity?: number | null
          stock_status?: never
          subtitle?: string | null
        }
        Update: {
          anchor_price?: number | null
          category?: string | null
          codigo?: string | null
          descricao?: string | null
          id?: string | null
          images?: never
          instrucoes_preparo?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          nome?: string | null
          price?: number | null
          price_formatted?: never
          primary_image_url?: never
          slug?: string | null
          stock_min_alert?: number | null
          stock_quantity?: number | null
          stock_status?: never
          subtitle?: string | null
        }
        Relationships: []
      }
      vw_marketing_pedidos: {
        Row: {
          data_venda: string | null
          entregas_count: number | null
          faturamento: number | null
          faturamento_direto: number | null
          faturamento_online: number | null
          mes_iso: string | null
          pedidos_diretos: number | null
          pedidos_online: number | null
          retiradas_count: number | null
          semana_iso: string | null
          ticket_medio: number | null
          total_pedidos: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_image_reference: {
        Args: { p_produto_id: string; p_url: string }
        Returns: undefined
      }
      criar_obrigacao_parcelada: {
        Args: {
          p_credor: string
          p_data_vencimento: string
          p_descricao: string
          p_observacao?: string
          p_plano_conta_id: string
          p_referencia?: string
          p_total_parcelas?: number
          p_valor_total: number
        }
        Returns: string[]
      }
      criar_pedido: {
        Args: {
          p_bairro?: string
          p_cep?: string
          p_cidade?: string
          p_complemento?: string
          p_endereco_entrega: string
          p_frete: number
          p_indicado_por?: string
          p_itens?: Json
          p_logradouro?: string
          p_metodo_entrega: string
          p_metodo_pagamento: string
          p_nome_cliente: string
          p_numero?: string
          p_observacoes?: string
          p_subtotal: number
          p_telefone_cliente: string
          p_total: number
          p_uf?: string
        }
        Returns: Json
      }
      delete_image_reference: {
        Args: { p_produto_id: string }
        Returns: undefined
      }
      get_areceber_breakdown: {
        Args: never
        Returns: {
          sem_data: number
          valor_hoje: number
          valor_sem_data: number
          valor_semana: number
          valor_vencido: number
          vencem_hoje: number
          vencem_semana: number
          vencidos: number
        }[]
      }
      is_admin: { Args: { check_user_id?: string }; Returns: boolean }
      receive_purchase_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      registrar_despesa_manual: {
        Args: {
          p_conta_id: string
          p_data: string
          p_descricao: string
          p_plano_conta_id: string
          p_valor: number
        }
        Returns: string
      }
      registrar_entrada_manual: {
        Args: {
          p_conta_id: string
          p_data: string
          p_descricao: string
          p_plano_conta_id: string
          p_valor: number
        }
        Returns: string
      }
      registrar_pagamento_conta_a_pagar: {
        Args: {
          p_conta_a_pagar_id: string
          p_conta_credor_id?: string
          p_conta_id: string
          p_data_pagamento: string
          p_metodo_pagamento?: string
          p_observacao?: string
          p_valor: number
        }
        Returns: string
      }
      registrar_pagamento_venda: {
        Args: {
          p_conta_id: string
          p_data: string
          p_metodo: string
          p_observacao?: string
          p_valor: number
          p_venda_id: string
        }
        Returns: string
      }
      rpc_total_a_receber_dashboard: { Args: never; Returns: Json }
      rpc_total_a_receber_simples: { Args: never; Returns: number }
      rpt_churn: {
        Args: { p_dias_threshold?: number }
        Returns: {
          contato_id: string
          dias_sem_compra: number
          nome: string
          qtd_pedidos: number
          telefone: string
          total_historico: number
          ultima_compra: string
        }[]
      }
      rpt_vendas_por_periodo: {
        Args: { p_agrupamento?: string; p_fim: string; p_inicio: string }
        Returns: {
          clientes_unicos: number
          faturamento: number
          periodo: string
          ticket_medio: number
          total_itens: number
          total_vendas: number
        }[]
      }
      update_purchase_order_with_items: {
        Args: {
          p_fornecedor_id: string
          p_items: Json
          p_notes: string
          p_order_date: string
          p_order_id: string
          p_payment_status: string
          p_status: string
          p_total_amount: number
        }
        Returns: undefined
      }
    }
    Enums: {
      purchase_order_payment_status: "paid" | "partial" | "unpaid"
      purchase_order_status: "pending" | "received" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      purchase_order_payment_status: ["paid", "partial", "unpaid"],
      purchase_order_status: ["pending", "received", "cancelled"],
    },
  },
} as const
type Table<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
type View<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']
export type Insert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Update<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

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
