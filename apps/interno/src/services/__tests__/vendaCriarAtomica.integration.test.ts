import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createTestClient, cleanTestData } from '@mont/shared/test-utils'

/**
 * Integração (PRODUÇÃO, conta-teste) da criação atômica de venda via RPC criar_venda.
 *
 * Reproduz/blinda os bugs de sinal fraco:
 *  - ATOMICIDADE: header (vendas) e itens (itens_venda) numa transação só — nunca
 *    header órfão. Confere total (subtotais + frete) e custo_total (do custo do produto).
 *  - IDEMPOTÊNCIA (regressão da duplicata vista na prod): chamar 2× com a MESMA
 *    idempotency_key cria UMA venda e retorna o MESMO id (cobre retry/clique-duplo).
 *
 * Não cria produtos (cleanTestData não os limpa → poluiria o catálogo real): usa um
 * produto existente, só leitura. Cria contato+venda, limpos por created_by.
 * A conta-teste é admin → passa no guard is_admin() da RPC. Janela: manual, nunca com
 * o Gilmar usando (ver skill tdd-mont-pragmatico).
 */

type Client = Awaited<ReturnType<typeof createTestClient>>

let supabase: Client

async function pegarProdutoComCusto() {
    const { data, error } = await supabase
        .from('produtos')
        .select('id, custo')
        .not('custo', 'is', null)
        .gt('custo', 0)
        .limit(1)
        .single()
    if (error) throw error
    return { id: data.id as string, custo: Number(data.custo) }
}

async function criarContato() {
    const uniq = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    const { data, error } = await supabase
        .from('contatos')
        .insert({ nome: `Cliente Teste ${uniq}`, telefone: `1199${uniq.slice(-7)}`, tipo: 'B2C' })
        .select('id').single()
    if (error) throw error
    return data.id as string
}

beforeAll(async () => {
    supabase = await createTestClient()
})

afterEach(async () => {
    await cleanTestData(supabase)
})

describe('criar_venda — criação atômica + idempotência (integração)', () => {
    it('grava header + itens atomicamente, com total e custo_total corretos', async () => {
        const produto = await pegarProdutoComCusto()
        const contatoId = await criarContato()
        const key = crypto.randomUUID()

        const { data: vendaId, error } = await supabase.rpc('criar_venda', {
            p_contato_id: contatoId,
            p_data: '2026-07-09',
            p_forma_pagamento: 'pix',
            p_taxa_entrega: 5,
            p_itens: [{ produto_id: produto.id, quantidade: 3, preco_unitario: 25, subtotal: 75 }],
            p_idempotency_key: key,
        })
        expect(error).toBeNull()
        expect(vendaId).toBeTruthy()

        // Header
        const { data: venda } = await supabase
            .from('vendas')
            .select('total, custo_total, status, taxa_entrega, idempotency_key')
            .eq('id', vendaId as string).single()
        expect(Number(venda!.total)).toBe(80)                    // 75 (subtotal) + 5 (frete)
        expect(Number(venda!.custo_total)).toBe(produto.custo * 3) // custo do produto * qtd
        expect(venda!.status).toBe('pendente')
        expect(venda!.idempotency_key).toBe(key)

        // Itens (atomicidade: existem junto com o header)
        const { data: itens } = await supabase
            .from('itens_venda')
            .select('quantidade, subtotal, custo_unitario')
            .eq('venda_id', vendaId as string)
        expect(itens).toHaveLength(1)
        expect(Number(itens![0].quantidade)).toBe(3)
        expect(Number(itens![0].custo_unitario)).toBe(produto.custo)
    })

    it('dedup: 2 chamadas com a mesma idempotency_key criam UMA venda (mesmo id)', async () => {
        const produto = await pegarProdutoComCusto()
        const contatoId = await criarContato()
        const key = crypto.randomUUID()
        const payload = {
            p_contato_id: contatoId,
            p_data: '2026-07-09',
            p_forma_pagamento: 'pix',
            p_taxa_entrega: 0,
            p_itens: [{ produto_id: produto.id, quantidade: 2, preco_unitario: 20, subtotal: 40 }],
            p_idempotency_key: key,
        }

        const { data: id1, error: e1 } = await supabase.rpc('criar_venda', payload)
        const { data: id2, error: e2 } = await supabase.rpc('criar_venda', payload) // reenvio / clique duplo
        expect(e1).toBeNull()
        expect(e2).toBeNull()
        expect(id2).toBe(id1)

        // Só UMA venda com essa chave
        const { data: vendas } = await supabase.from('vendas').select('id').eq('idempotency_key', key)
        expect(vendas).toHaveLength(1)

        // Itens NÃO duplicados
        const { data: itens } = await supabase.from('itens_venda').select('id').eq('venda_id', id1 as string)
        expect(itens).toHaveLength(1)
    })
})
