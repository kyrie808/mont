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
      campanhas: {
        Row: {
          ativo: boolean
          criado_em: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
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
          {
            foreignKeyName: "cat_pedidos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_relacionamento_kanban"
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
      cat_secoes: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          slug: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          slug: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
          campanha_id: string | null
          competencia: string | null
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
          recorrente_id: string | null
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
          campanha_id?: string | null
          competencia?: string | null
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
          recorrente_id?: string | null
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
          campanha_id?: string | null
          competencia?: string | null
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
          recorrente_id?: string | null
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
            foreignKeyName: "contas_a_pagar_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_pagar_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "rpt_campanhas"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "contas_a_pagar_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "plano_de_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_pagar_recorrente_id_fkey"
            columns: ["recorrente_id"]
            isOneToOne: false
            referencedRelation: "despesas_recorrentes"
            referencedColumns: ["id"]
          },
        ]
      }
      contato_campanhas: {
        Row: {
          campanha_id: string
          contato_id: string
          criado_em: string
        }
        Insert: {
          campanha_id: string
          contato_id: string
          criado_em?: string
        }
        Update: {
          campanha_id?: string
          contato_id?: string
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "contato_campanhas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contato_campanhas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "rpt_campanhas"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "contato_campanhas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contato_campanhas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_compras"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "contato_campanhas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_indicacoes"
            referencedColumns: ["indicador_id"]
          },
          {
            foreignKeyName: "contato_campanhas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "rpt_ltv_por_cliente"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "contato_campanhas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_home_alertas"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "contato_campanhas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_relacionamento_kanban"
            referencedColumns: ["contato_id"]
          },
        ]
      }
      contato_tags: {
        Row: {
          contato_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          contato_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          contato_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contato_tags_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contato_tags_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_compras"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "contato_tags_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_indicacoes"
            referencedColumns: ["indicador_id"]
          },
          {
            foreignKeyName: "contato_tags_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "rpt_ltv_por_cliente"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "contato_tags_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_home_alertas"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "contato_tags_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_relacionamento_kanban"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "contato_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contatos: {
        Row: {
          ad_referral: Json | null
          apelido: string | null
          arquivado_em: string | null
          atualizado_em: string
          bairro: string | null
          campanha_id: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_by: string | null
          criado_em: string
          ctwa_clid: string | null
          ctwa_clid_em: string | null
          endereco: string | null
          fonte: string | null
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
          status_relacionamento: Database["public"]["Enums"]["enum_relacionamento_status"]
          subtipo: string | null
          telefone: string
          tipo: string
          uf: string | null
          ultimo_contato: string | null
          updated_by: string | null
        }
        Insert: {
          ad_referral?: Json | null
          apelido?: string | null
          arquivado_em?: string | null
          atualizado_em?: string
          bairro?: string | null
          campanha_id?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_by?: string | null
          criado_em?: string
          ctwa_clid?: string | null
          ctwa_clid_em?: string | null
          endereco?: string | null
          fonte?: string | null
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
          status_relacionamento?: Database["public"]["Enums"]["enum_relacionamento_status"]
          subtipo?: string | null
          telefone: string
          tipo: string
          uf?: string | null
          ultimo_contato?: string | null
          updated_by?: string | null
        }
        Update: {
          ad_referral?: Json | null
          apelido?: string | null
          arquivado_em?: string | null
          atualizado_em?: string
          bairro?: string | null
          campanha_id?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_by?: string | null
          criado_em?: string
          ctwa_clid?: string | null
          ctwa_clid_em?: string | null
          endereco?: string | null
          fonte?: string | null
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
          status_relacionamento?: Database["public"]["Enums"]["enum_relacionamento_status"]
          subtipo?: string | null
          telefone?: string
          tipo?: string
          uf?: string | null
          ultimo_contato?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contatos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contatos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "rpt_campanhas"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "contatos_fonte_fkey"
            columns: ["fonte"]
            isOneToOne: false
            referencedRelation: "fontes"
            referencedColumns: ["slug"]
          },
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
          {
            foreignKeyName: "contatos_indicado_por_id_fkey"
            columns: ["indicado_por_id"]
            isOneToOne: false
            referencedRelation: "view_relacionamento_kanban"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "contatos_origem_fkey"
            columns: ["origem"]
            isOneToOne: false
            referencedRelation: "origens"
            referencedColumns: ["slug"]
          },
        ]
      }
      despesas_recorrentes: {
        Row: {
          ativa: boolean
          atualizado_em: string | null
          created_at: string | null
          created_by: string | null
          credor: string
          criado_em: string | null
          descricao: string
          dia_vencimento: number
          id: string
          plano_conta_id: string
          updated_at: string | null
          updated_by: string | null
          valor: number
          variavel: boolean
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string | null
          created_at?: string | null
          created_by?: string | null
          credor: string
          criado_em?: string | null
          descricao: string
          dia_vencimento: number
          id?: string
          plano_conta_id: string
          updated_at?: string | null
          updated_by?: string | null
          valor: number
          variavel?: boolean
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string | null
          created_at?: string | null
          created_by?: string | null
          credor?: string
          criado_em?: string | null
          descricao?: string
          dia_vencimento?: number
          id?: string
          plano_conta_id?: string
          updated_at?: string | null
          updated_by?: string | null
          valor?: number
          variavel?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "despesas_recorrentes_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "plano_de_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      entregadores: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
          repasse_por_entrega: number
          user_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
          repasse_por_entrega?: number
          user_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
          repasse_por_entrega?: number
          user_id?: string
        }
        Relationships: []
      }
      fontes: {
        Row: {
          ativo: boolean
          label: string
          ordem: number
          slug: string
        }
        Insert: {
          ativo?: boolean
          label: string
          ordem?: number
          slug: string
        }
        Update: {
          ativo?: boolean
          label?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      interacoes: {
        Row: {
          campanha_id: string | null
          canal: string | null
          contato_id: string
          criado_por: string | null
          data: string
          id: string
          observacao: string | null
          resultado: string | null
          sentido: string
          tipo: string | null
        }
        Insert: {
          campanha_id?: string | null
          canal?: string | null
          contato_id: string
          criado_por?: string | null
          data?: string
          id?: string
          observacao?: string | null
          resultado?: string | null
          sentido?: string
          tipo?: string | null
        }
        Update: {
          campanha_id?: string | null
          canal?: string | null
          contato_id?: string
          criado_por?: string | null
          data?: string
          id?: string
          observacao?: string | null
          resultado?: string | null
          sentido?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "rpt_campanhas"
            referencedColumns: ["campanha_id"]
          },
          {
            foreignKeyName: "interacoes_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_compras"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "interacoes_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_indicacoes"
            referencedColumns: ["indicador_id"]
          },
          {
            foreignKeyName: "interacoes_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "rpt_ltv_por_cliente"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "interacoes_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_home_alertas"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "interacoes_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_relacionamento_kanban"
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
          comprovante_url: string | null
          conta_destino_id: string | null
          conta_id: string
          created_by: string | null
          criado_em: string | null
          data: string
          descricao: string | null
          entregador_id: string | null
          id: string
          origem: string
          pagamento_id: string | null
          plano_conta_id: string | null
          tipo: string
          updated_by: string | null
          valor: number
          venda_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          comprovante_url?: string | null
          conta_destino_id?: string | null
          conta_id: string
          created_by?: string | null
          criado_em?: string | null
          data?: string
          descricao?: string | null
          entregador_id?: string | null
          id?: string
          origem: string
          pagamento_id?: string | null
          plano_conta_id?: string | null
          tipo: string
          updated_by?: string | null
          valor: number
          venda_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          comprovante_url?: string | null
          conta_destino_id?: string | null
          conta_id?: string
          created_by?: string | null
          criado_em?: string | null
          data?: string
          descricao?: string | null
          entregador_id?: string | null
          id?: string
          origem?: string
          pagamento_id?: string | null
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
            foreignKeyName: "lancamentos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos_venda"
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
      meta_eventos: {
        Row: {
          action_source: string
          contato_id: string
          criado_em: string
          ctwa_clid: string | null
          enviado_em: string | null
          event_id: string
          event_time: string
          evento: string
          id: string
          moeda: string
          resposta_meta: Json | null
          status: string
          tentativas: number
          valor: number | null
          venda_id: string | null
        }
        Insert: {
          action_source: string
          contato_id: string
          criado_em?: string
          ctwa_clid?: string | null
          enviado_em?: string | null
          event_id: string
          event_time: string
          evento: string
          id?: string
          moeda?: string
          resposta_meta?: Json | null
          status?: string
          tentativas?: number
          valor?: number | null
          venda_id?: string | null
        }
        Update: {
          action_source?: string
          contato_id?: string
          criado_em?: string
          ctwa_clid?: string | null
          enviado_em?: string | null
          event_id?: string
          event_time?: string
          evento?: string
          id?: string
          moeda?: string
          resposta_meta?: Json | null
          status?: string
          tentativas?: number
          valor?: number | null
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_eventos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_eventos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_compras"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "meta_eventos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "ranking_indicacoes"
            referencedColumns: ["indicador_id"]
          },
          {
            foreignKeyName: "meta_eventos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "rpt_ltv_por_cliente"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "meta_eventos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_home_alertas"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "meta_eventos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_relacionamento_kanban"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "meta_eventos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "rpt_projecao_recebimentos"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "meta_eventos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      origens: {
        Row: {
          ativo: boolean
          label: string
          ordem: number
          slug: string
        }
        Insert: {
          ativo?: boolean
          label: string
          ordem?: number
          slug: string
        }
        Update: {
          ativo?: boolean
          label?: string
          ordem?: number
          slug?: string
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
          conta_id: string | null
          criado_em: string
          data: string
          id: string
          metodo: string
          observacao: string | null
          valor: number
          venda_id: string
        }
        Insert: {
          conta_id?: string | null
          criado_em?: string
          data?: string
          id?: string
          metodo?: string
          observacao?: string | null
          valor: number
          venda_id: string
        }
        Update: {
          conta_id?: string | null
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
            foreignKeyName: "pagamentos_venda_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
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
      produto_componentes: {
        Row: {
          combo_id: string
          componente_id: string
          criado_em: string
          id: string
          quantidade: number
        }
        Insert: {
          combo_id: string
          componente_id: string
          criado_em?: string
          id?: string
          quantidade?: number
        }
        Update: {
          combo_id?: string
          componente_id?: string
          criado_em?: string
          id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "produto_componentes_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_componentes_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "rpt_giro_estoque"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "produto_componentes_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "rpt_margem_por_sku"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "produto_componentes_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "vw_catalogo_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_componentes_componente_id_fkey"
            columns: ["componente_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_componentes_componente_id_fkey"
            columns: ["componente_id"]
            isOneToOne: false
            referencedRelation: "rpt_giro_estoque"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "produto_componentes_componente_id_fkey"
            columns: ["componente_id"]
            isOneToOne: false
            referencedRelation: "rpt_margem_por_sku"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "produto_componentes_componente_id_fkey"
            columns: ["componente_id"]
            isOneToOne: false
            referencedRelation: "vw_catalogo_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          apelido: string | null
          ativo: boolean
          atualizado_em: string
          beneficios: string | null
          categoria: string | null
          codigo: string
          criado_em: string
          custo: number
          descricao: string | null
          destaque: boolean | null
          eh_combo: boolean
          estoque_atual: number | null
          estoque_minimo: number | null
          id: string
          instrucoes_preparo: string | null
          nome: string
          ordem_vitrine: number
          peso_kg: number | null
          preco: number
          preco_ancoragem: number | null
          secao_id: string | null
          selo: string | null
          slug: string
          subtitulo: string | null
          unidade: string
          visivel_catalogo: boolean
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          atualizado_em?: string
          beneficios?: string | null
          categoria?: string | null
          codigo: string
          criado_em?: string
          custo: number
          descricao?: string | null
          destaque?: boolean | null
          eh_combo?: boolean
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          instrucoes_preparo?: string | null
          nome: string
          ordem_vitrine?: number
          peso_kg?: number | null
          preco: number
          preco_ancoragem?: number | null
          secao_id?: string | null
          selo?: string | null
          slug: string
          subtitulo?: string | null
          unidade?: string
          visivel_catalogo?: boolean
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          atualizado_em?: string
          beneficios?: string | null
          categoria?: string | null
          codigo?: string
          criado_em?: string
          custo?: number
          descricao?: string | null
          destaque?: boolean | null
          eh_combo?: boolean
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          instrucoes_preparo?: string | null
          nome?: string
          ordem_vitrine?: number
          peso_kg?: number | null
          preco?: number
          preco_ancoragem?: number | null
          secao_id?: string | null
          selo?: string | null
          slug?: string
          subtitulo?: string | null
          unidade?: string
          visivel_catalogo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "produtos_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "cat_secoes"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "purchase_orders_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "view_relacionamento_kanban"
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
      tags: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          cor: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
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
          desconto: number
          dinheiro_acertado_em: string | null
          dinheiro_na_entrega: boolean
          entregador_id: string | null
          forma_pagamento: string
          fts: unknown
          id: string
          idempotency_key: string | null
          nota_entregador: string | null
          observacao_entregador: string | null
          observacoes: string | null
          ordem_rota: number | null
          origem: string | null
          pago: boolean
          parcelas: number | null
          recebido_em: string | null
          recebido_por_entregador_id: string | null
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
          desconto?: number
          dinheiro_acertado_em?: string | null
          dinheiro_na_entrega?: boolean
          entregador_id?: string | null
          forma_pagamento: string
          fts?: unknown
          id?: string
          idempotency_key?: string | null
          nota_entregador?: string | null
          observacao_entregador?: string | null
          observacoes?: string | null
          ordem_rota?: number | null
          origem?: string | null
          pago?: boolean
          parcelas?: number | null
          recebido_em?: string | null
          recebido_por_entregador_id?: string | null
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
          desconto?: number
          dinheiro_acertado_em?: string | null
          dinheiro_na_entrega?: boolean
          entregador_id?: string | null
          forma_pagamento?: string
          fts?: unknown
          id?: string
          idempotency_key?: string | null
          nota_entregador?: string | null
          observacao_entregador?: string | null
          observacoes?: string | null
          ordem_rota?: number | null
          origem?: string | null
          pago?: boolean
          parcelas?: number | null
          recebido_em?: string | null
          recebido_por_entregador_id?: string | null
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
          {
            foreignKeyName: "vendas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "view_relacionamento_kanban"
            referencedColumns: ["contato_id"]
          },
          {
            foreignKeyName: "vendas_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_recebido_por_entregador_id_fkey"
            columns: ["recebido_por_entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
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
          total_convertidos: number | null
          total_indicados: number | null
          total_vendas_indicados: number | null
        }
        Relationships: []
      }
      rpt_aquisicao_fonte: {
        Row: {
          converteram: number | null
          fonte: string | null
          leads: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contatos_fonte_fkey"
            columns: ["fonte"]
            isOneToOne: false
            referencedRelation: "fontes"
            referencedColumns: ["slug"]
          },
        ]
      }
      rpt_aquisicao_mensal: {
        Row: {
          ano: number | null
          mes: number | null
          novos_compradores: number | null
          novos_leads: number | null
          origem: string | null
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
      rpt_campanhas: {
        Row: {
          ativo: boolean | null
          campanha_id: string | null
          converteram: number | null
          leads: number | null
          nome: string | null
          receita_gerada: number | null
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
          receita_frete: number | null
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
          status_atividade: string | null
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
      rpt_relacionamento_funil: {
        Row: {
          a_contatar: number | null
          contatado: number | null
          em_negociacao: number | null
          resolvido: number | null
          total: number | null
          whatsapp_incorreto: number | null
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
          comprovante_url: string | null
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
          receita_frete: number | null
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
          receita_frete: number | null
        }
        Relationships: []
      }
      view_relacionamento_kanban: {
        Row: {
          aba_atual:
            | Database["public"]["Enums"]["enum_relacionamento_aba"]
            | null
          arquivado_em: string | null
          atraso: number | null
          balde_cheio: boolean | null
          coluna_efetiva:
            | Database["public"]["Enums"]["enum_relacionamento_status"]
            | null
          contato_id: string | null
          dias_sem_compra: number | null
          intervalo_medio: number | null
          nome: string | null
          primeira_compra: string | null
          proxima_esperada: string | null
          status_relacionamento:
            | Database["public"]["Enums"]["enum_relacionamento_status"]
            | null
          sumido: boolean | null
          telefone: string | null
          tentativas: number | null
          total_pedidos: number | null
          ultima_compra: string | null
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
          beneficios: string | null
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
          ordem_vitrine: number | null
          preco: number | null
          preco_ancoragem: number | null
          preco_formatado: string | null
          secao_id: string | null
          selo: string | null
          slug: string | null
          status_estoque: string | null
          subtitulo: string | null
          url_imagem_principal: string | null
          visivel_catalogo: boolean | null
        }
        Insert: {
          beneficios?: string | null
          categoria?: string | null
          codigo?: string | null
          descricao?: string | null
          destaque?: boolean | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string | null
          imagens?: never
          instrucoes_preparo?: string | null
          nome?: string | null
          ordem_vitrine?: number | null
          preco?: number | null
          preco_ancoragem?: number | null
          preco_formatado?: never
          secao_id?: string | null
          selo?: string | null
          slug?: string | null
          status_estoque?: never
          subtitulo?: string | null
          url_imagem_principal?: never
          visivel_catalogo?: boolean | null
        }
        Update: {
          beneficios?: string | null
          categoria?: string | null
          codigo?: string | null
          descricao?: string | null
          destaque?: boolean | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string | null
          imagens?: never
          instrucoes_preparo?: string | null
          nome?: string | null
          ordem_vitrine?: number | null
          preco?: number | null
          preco_ancoragem?: number | null
          preco_formatado?: never
          secao_id?: string | null
          selo?: string | null
          slug?: string | null
          status_estoque?: never
          subtitulo?: string | null
          url_imagem_principal?: never
          visivel_catalogo?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "cat_secoes"
            referencedColumns: ["id"]
          },
        ]
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
      _pagamento_venda_core: {
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
      add_image_reference: {
        Args: { p_produto_id: string; p_url: string }
        Returns: undefined
      }
      admin_extrato_entregadores: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          devido: number
          dinheiro_coletado: number
          entregador_id: string
          entregas: number
          nome: string
          pago: number
          repasse_por_entrega: number
          saldo_repasse: number
        }[]
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
      criar_venda: {
        Args: {
          p_contato_id: string
          p_data: string
          p_data_prevista_pagamento?: string
          p_desconto?: number
          p_dinheiro_na_entrega?: boolean
          p_entregador_id?: string
          p_forma_pagamento: string
          p_idempotency_key: string
          p_itens: Json
          p_observacao_entregador?: string
          p_taxa_entrega: number
        }
        Returns: string
      }
      delete_image_reference: {
        Args: { p_produto_id: string }
        Returns: undefined
      }
      entregador_marcar_entregue: {
        Args: { p_venda_id: string }
        Returns: undefined
      }
      entregador_marcar_recebido_dinheiro: {
        Args: { p_venda_id: string }
        Returns: string
      }
      entregador_meus_repasses: {
        Args: never
        Returns: {
          categoria: string
          comprovante_url: string
          data: string
          lancamento_id: string
          valor: number
        }[]
      }
      entregador_minhas_entregas: {
        Args: never
        Returns: {
          bairro: string
          cep: string
          cidade: string
          cliente_apelido: string
          cliente_nome: string
          cliente_telefone: string
          complemento: string
          data: string
          dinheiro_acertado_em: string
          endereco: string
          estado_pagamento: string
          logradouro: string
          nota_entregador: string
          numero: string
          observacao_entregador: string
          recebido_em: string
          repasse: number
          status_entrega: string
          taxa_entrega: number
          uf: string
          valor_a_receber: number
          valor_recebido: number
          venda_id: string
        }[]
      }
      entregador_reordenar_rota: {
        Args: { p_venda_ids: string[] }
        Returns: undefined
      }
      entregador_salvar_nota: {
        Args: { p_nota: string; p_venda_id: string }
        Returns: undefined
      }
      fn_ajusta_estoque_item: {
        Args: {
          p_delta_sinal: number
          p_produto_id: string
          p_quantidade: number
        }
        Returns: undefined
      }
      fn_capitalize_name: { Args: { nome: string }; Returns: string }
      fn_count_words: { Args: { texto: string }; Returns: number }
      fn_mover_card_relacionamento: {
        Args: {
          p_contato_id: string
          p_novo_status: Database["public"]["Enums"]["enum_relacionamento_status"]
          p_observacao?: string
        }
        Returns: undefined
      }
      fn_slugify: { Args: { p: string }; Returns: string }
      gerar_despesas_recorrentes: {
        Args: { p_competencia: string }
        Returns: number
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
      is_entregador: { Args: { check_user_id?: string }; Returns: boolean }
      produtos_comprados_juntos: {
        Args: { p_limit?: number; p_produto_id: string }
        Returns: {
          produto_id: string
          score: number
        }[]
      }
      receive_purchase_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      registrar_ajuste_saldo: {
        Args: { p_conta_id: string; p_saldo_real: number }
        Returns: string
      }
      registrar_despesa_manual: {
        Args: {
          p_comprovante_url?: string
          p_conta_id: string
          p_data: string
          p_descricao: string
          p_entregador_id?: string
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
      reorder_produtos_vitrine: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      reorder_secoes: { Args: { p_ids: string[] }; Returns: undefined }
      replace_combo_componentes: {
        Args: { p_combo_id: string; p_itens: Json }
        Returns: undefined
      }
      rpc_indicados_do_indicador: {
        Args: { p_indicador_id: string }
        Returns: {
          comprou: boolean
          contato_id: string
          nome: string
          total_compras: number
          total_gasto: number
          ultima_compra: string
        }[]
      }
      rpc_perfil_extras: { Args: { p_contato_id: string }; Returns: Json }
      rpc_ranking_compras: {
        Args: { p_ano?: number; p_mes?: number }
        Returns: {
          contato_id: string
          nome: string
          total_compras: number
          total_pontos: number
          ultima_compra: string
        }[]
      }
      rpc_total_a_receber_dashboard: {
        Args: { p_ano?: number; p_mes?: number }
        Returns: Json
      }
      rpt_distribuicao_forma_pagamento_periodo: {
        Args: { p_ate?: string; p_desde?: string }
        Returns: {
          faturamento: number
          forma_pagamento: string
          pct_contagem: number
          pct_faturamento: number
          total_vendas: number
          vendas_liquidadas: number
          vendas_pendentes: number
        }[]
      }
      rpt_giro_estoque_periodo: {
        Args: { p_ate?: string; p_desde?: string }
        Returns: {
          codigo: string
          estoque_atual: number
          estoque_minimo: number
          giro_estoque: number
          nome: string
          produto_id: string
          status_estoque: string
          total_comprado_historico: number
          total_vendido_historico: number
        }[]
      }
      rpt_ltv_por_cliente_periodo: {
        Args: { p_ate?: string; p_desde?: string }
        Returns: {
          contato_id: string
          dias_relacionamento: number
          ltv_total: number
          nome: string
          origem: string
          primeira_compra: string
          status: string
          status_atividade: string
          telefone: string
          ticket_medio: number
          tipo: string
          total_pedidos: number
          ultima_compra: string
        }[]
      }
      rpt_margem_por_sku_periodo: {
        Args: { p_ate?: string; p_desde?: string }
        Returns: {
          codigo: string
          custo_total: number
          lucro_bruto: number
          margem_pct: number
          nome: string
          produto_id: string
          receita_total: number
          total_vendido: number
          unidade: string
        }[]
      }
      rpt_marketing_pedidos_periodo: {
        Args: { p_ate?: string; p_desde?: string }
        Returns: {
          data_venda: string
          entregas_count: number
          faturamento: number
          faturamento_direto: number
          faturamento_online: number
          mes_iso: string
          pedidos_diretos: number
          pedidos_online: number
          retiradas_count: number
          semana_iso: string
          ticket_medio: number
          total_pedidos: number
        }[]
      }
      rpt_promocoes_periodo: {
        Args: { p_ate?: string; p_desde?: string }
        Returns: {
          brindes_clientes: number
          brindes_qtd: number
          brindes_valor: number
          desconto_qtd: number
          desconto_total: number
        }[]
      }
      rpt_relacionamento_esforco_periodo: {
        Args: { p_ate?: string; p_desde?: string }
        Returns: {
          aceitou: number
          aguardando: number
          respondeu: number
          sem_resposta: number
          tentativas: number
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
      enum_relacionamento_aba: "reativacao" | "recompra" | "cobranca" | "leads"
      enum_relacionamento_status:
        | "a_contatar"
        | "contatado"
        | "em_negociacao"
        | "resolvido"
        | "follow_up"
        | "sem_retorno"
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
      enum_relacionamento_aba: ["reativacao", "recompra", "cobranca", "leads"],
      enum_relacionamento_status: [
        "a_contatar",
        "contatado",
        "em_negociacao",
        "resolvido",
        "follow_up",
        "sem_retorno",
      ],
      purchase_order_payment_status: ["paid", "partial", "unpaid"],
      purchase_order_status: ["pending", "received", "cancelled"],
    },
  },
} as const
