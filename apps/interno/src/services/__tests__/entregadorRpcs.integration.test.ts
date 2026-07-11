import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@mont/shared'
import { createTestClient, cleanTestData, TEST_USER_ID } from '@mont/shared/test-utils'

/**
 * Integração (PRODUÇÃO) das RPCs do entregador (Área do Entregador — Stage 1).
 *
 * Dois clients: `admin` (conta-teste, admin → cria os dados e limpa) e `mauricio`
 * (conta do entregador real, não-admin → exercita as RPCs guardadas por is_entregador).
 * A venda é criada pela conta-teste (created_by dela → limpa pelo cleanup) e ATRIBUÍDA
 * ao Maurício (entregador_id), caindo no "app" dele.
 *
 * Cobre:
 *  - entregador_minhas_entregas: só as dele, campos CURADOS (zero receita/custo/margem),
 *    estado de pagamento derivado (receber_na_entrega × so_entregar), guard rejeita admin.
 *  - entregador_marcar_recebido_dinheiro: registra dinheiro no Caixa + marcador; rejeita
 *    fiado/brinde e venda de outro.
 *  - entregador_marcar_entregue: flipa status; rejeita venda de outro.
 *  - RLS Stage 0: o entregador NÃO lê vendas direto (só via RPC).
 *
 * Efeitos colaterais do 'entregue' são revertidos no afterEach: estoque volta no
 * entregue→cancelada (trigger), meta_eventos (CAPI) cai por CASCADE ao deletar a venda,
 * e os lançamentos criados pelo entregador (created_by dele) são apagados por venda_id.
 * Janela: manual, nunca com o Gilmar usando (ver skill tdd-mont-pragmatico).
 */

type Client = SupabaseClient<Database>

let admin: Client
let mauricio: Client
let entregadorId: string
let contaCaixaId: string

function env(key: string): string {
    const fromVite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key]
    const fromProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[key]
    const value = fromVite ?? fromProcess
    if (!value) throw new Error(`[entregador.test] env ${key} ausente — configure em apps/interno/.env.local`)
    return value
}

async function createEntregadorClient(): Promise<Client> {
    const client = createClient<Database>(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_ANON_KEY'), {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.signInWithPassword({
        email: env('VITE_ENTREGADOR_TEST_EMAIL'),
        password: env('VITE_ENTREGADOR_TEST_PASSWORD'),
    })
    if (error) throw new Error(`[entregador.test] login do entregador falhou: ${error.message}`)
    if (!data.user) throw new Error('[entregador.test] login do entregador sem user')
    return client
}

async function pegarProduto() {
    const { data, error } = await admin
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
    const { data, error } = await admin
        .from('contatos')
        .insert({ nome: `Cliente Entrega ${uniq}`, telefone: `1198${uniq.slice(-7)}`, tipo: 'B2C', endereco: 'Rua Teste, 123 - SBC' })
        .select('id').single()
    if (error) throw error
    return data.id as string
}

/** Cria uma venda pela conta-teste e atribui (ou não) a um entregador. */
async function criarVenda(opts: { forma: string; taxa?: number; entregadorId?: string | null; observacao?: string | null; dinheiroNaEntrega?: boolean }) {
    const produto = await pegarProduto()
    const contatoId = await criarContato()
    const { data: vendaId, error } = await admin.rpc('criar_venda', {
        p_contato_id: contatoId,
        p_data: '2026-07-10',
        p_forma_pagamento: opts.forma,
        p_taxa_entrega: opts.taxa ?? 0,
        p_itens: [{ produto_id: produto.id, quantidade: 2, preco_unitario: 20, subtotal: 40 }],
        p_idempotency_key: crypto.randomUUID(),
        p_entregador_id: opts.entregadorId ?? undefined,
        p_observacao_entregador: opts.observacao ?? undefined,
        p_dinheiro_na_entrega: opts.dinheiroNaEntrega ?? false,
    })
    if (error) throw error
    return { vendaId: vendaId as string, total: 40 + (opts.taxa ?? 0) }
}

beforeAll(async () => {
    admin = await createTestClient()
    mauricio = await createEntregadorClient()

    // entregador_id do Maurício (admin lê entregadores; pega pelo user_id logado)
    const { data: user } = await mauricio.auth.getUser()
    const { data: ent, error } = await admin
        .from('entregadores').select('id').eq('user_id', user.user!.id).single()
    if (error) throw new Error(`[entregador.test] entregador não provisionado: ${error.message}`)
    entregadorId = ent.id as string

    const { data: caixa } = await admin.from('contas').select('id').eq('tipo', 'dinheiro').order('criado_em', { ascending: true }).limit(1).single()
    contaCaixaId = caixa!.id as string
})

afterEach(async () => {
    const { data: testVendas } = await admin.from('vendas').select('id, status').eq('created_by', TEST_USER_ID)
    const ids = (testVendas ?? []).map((v) => v.id as string)
    if (ids.length) {
        const entregues = (testVendas ?? []).filter((v) => v.status === 'entregue').map((v) => v.id as string)
        if (entregues.length) {
            // devolve estoque (trigger) e apaga lançamento de brinde, se houver
            await admin.from('vendas').update({ status: 'cancelada' }).in('id', entregues)
        }
        // lançamentos ancorados nas vendas de teste — inclui os do entregador (created_by dele)
        await admin.from('lancamentos').delete().in('venda_id', ids)
    }
    await cleanTestData(admin) // meta_eventos cai por CASCADE ao deletar a venda
})

describe('entregador_minhas_entregas (integração)', () => {
    it('marcado "dinheiro na entrega" → receber_na_entrega, com valor_a_receber = total', async () => {
        const atribuida = await criarVenda({ forma: 'venda', taxa: 5, entregadorId, observacao: 'Cobrar em dinheiro', dinheiroNaEntrega: true })
        const outra = await criarVenda({ forma: 'venda', taxa: 5, entregadorId: null, dinheiroNaEntrega: true }) // não atribuída

        const { data, error } = await mauricio.rpc('entregador_minhas_entregas')
        expect(error).toBeNull()
        const linha = (data ?? []).find((r) => r.venda_id === atribuida.vendaId)
        expect(linha).toBeTruthy()
        expect((data ?? []).some((r) => r.venda_id === outra.vendaId)).toBe(false)

        // curado: estado derivado do flag, valor a receber = total (não o frete), etc.
        expect(linha!.estado_pagamento).toBe('receber_na_entrega')
        expect(Number(linha!.valor_a_receber)).toBe(atribuida.total) // 45, não o frete
        expect(Number(linha!.taxa_entrega)).toBe(5)
        expect(linha!.observacao_entregador).toBe('Cobrar em dinheiro')
        expect(Number(linha!.repasse)).toBe(5)
        expect(linha!.cliente_nome).toContain('Cliente Entrega')

        // NÃO vaza financeiro (valor_a_receber é o que ele coleta, não receita/margem)
        expect('total' in linha!).toBe(false)
        expect('custo_total' in linha!).toBe(false)
        expect('lucro' in linha!).toBe(false)
        expect('valor_pago' in linha!).toBe(false)
    })

    it('SEM flag (cliente paga a Mont por PIX) → so_entregar', async () => {
        const pix = await criarVenda({ forma: 'venda', taxa: 5, entregadorId }) // sem dinheiroNaEntrega
        const { data } = await mauricio.rpc('entregador_minhas_entregas')
        const linha = (data ?? []).find((r) => r.venda_id === pix.vendaId)
        expect(linha!.estado_pagamento).toBe('so_entregar')
    })

    it('fiado aparece como "so_entregar" (não coleta na entrega)', async () => {
        const fiado = await criarVenda({ forma: 'fiado', entregadorId })
        const { data } = await mauricio.rpc('entregador_minhas_entregas')
        const linha = (data ?? []).find((r) => r.venda_id === fiado.vendaId)
        expect(linha!.estado_pagamento).toBe('so_entregar')
    })

    it('guard: admin (não-entregador) não pode chamar', async () => {
        const { error } = await admin.rpc('entregador_minhas_entregas')
        expect(error).not.toBeNull()
    })
})

describe('entregador_marcar_recebido_dinheiro (integração)', () => {
    it('registra o restante em dinheiro no Caixa + marcador de recebido', async () => {
        const { vendaId, total } = await criarVenda({ forma: 'venda', taxa: 5, entregadorId, dinheiroNaEntrega: true })

        const { error } = await mauricio.rpc('entregador_marcar_recebido_dinheiro', { p_venda_id: vendaId })
        expect(error).toBeNull()

        const { data: venda } = await admin.from('vendas')
            .select('pago, valor_pago, recebido_por_entregador_id, recebido_em').eq('id', vendaId).single()
        expect(venda!.pago).toBe(true)
        expect(Number(venda!.valor_pago)).toBe(total)
        expect(venda!.recebido_por_entregador_id).toBe(entregadorId)
        expect(venda!.recebido_em).toBeTruthy()

        const { data: pags } = await admin.from('pagamentos_venda')
            .select('valor, metodo, conta_id').eq('venda_id', vendaId)
        expect(pags).toHaveLength(1)
        expect(pags![0].metodo).toBe('dinheiro')
        expect(pags![0].conta_id).toBe(contaCaixaId)
        expect(Number(pags![0].valor)).toBe(total)
    })

    it('rejeita venda SEM flag dinheiro_na_entrega (paga por PIX à Mont)', async () => {
        const { vendaId } = await criarVenda({ forma: 'venda', taxa: 5, entregadorId }) // sem flag
        const { error } = await mauricio.rpc('entregador_marcar_recebido_dinheiro', { p_venda_id: vendaId })
        expect(error).not.toBeNull()
    })

    it('rejeita venda não atribuída ao entregador', async () => {
        const { vendaId } = await criarVenda({ forma: 'venda', entregadorId: null, dinheiroNaEntrega: true })
        const { error } = await mauricio.rpc('entregador_marcar_recebido_dinheiro', { p_venda_id: vendaId })
        expect(error).not.toBeNull()
    })
})

describe('entregador_marcar_entregue (integração)', () => {
    it('flipa o status da venda dele para entregue', async () => {
        const { vendaId } = await criarVenda({ forma: 'venda', taxa: 5, entregadorId })

        const { error } = await mauricio.rpc('entregador_marcar_entregue', { p_venda_id: vendaId })
        expect(error).toBeNull()

        const { data: venda } = await admin.from('vendas').select('status').eq('id', vendaId).single()
        expect(venda!.status).toBe('entregue')
    })

    it('rejeita marcar entregue de venda não atribuída a ele', async () => {
        const { vendaId } = await criarVenda({ forma: 'venda', entregadorId: null })
        const { error } = await mauricio.rpc('entregador_marcar_entregue', { p_venda_id: vendaId })
        expect(error).not.toBeNull()
    })
})

describe('RLS Stage 0 — o entregador não lê tabelas sensíveis direto', () => {
    it('select direto em vendas volta vazio para o entregador', async () => {
        await criarVenda({ forma: 'venda', entregadorId })
        const { data, error } = await mauricio.from('vendas').select('id').limit(5)
        expect(error).toBeNull() // RLS não dá erro, só filtra
        expect(data ?? []).toHaveLength(0)
    })
})

describe('entregador_meus_repasses + repasse via despesa manual (integração)', () => {
    async function pegarCategoriaRepasse() {
        const { data, error } = await admin.from('plano_de_contas')
            .select('id').eq('codigo', 'TAXA_ENTREGA_ENTREGADOR').single()
        if (error) throw error
        return data.id as string
    }

    it('admin loga repasse com entregador+comprovante → Maurício vê em meus_repasses', async () => {
        const catId = await pegarCategoriaRepasse()
        const path = `${entregadorId}/fake-test-${Date.now()}.jpg`
        const { error: eDesp } = await admin.rpc('registrar_despesa_manual', {
            p_valor: 5,
            p_descricao: 'Repasse teste',
            p_data: '2026-07-10',
            p_conta_id: contaCaixaId,
            p_plano_conta_id: catId,
            p_entregador_id: entregadorId,
            p_comprovante_url: path,
        })
        expect(eDesp).toBeNull()

        const { data: repasses, error } = await mauricio.rpc('entregador_meus_repasses')
        expect(error).toBeNull()
        const r = (repasses ?? []).find((x) => x.comprovante_url === path)
        expect(r).toBeTruthy()
        expect(Number(r!.valor)).toBe(5)
        expect(r!.categoria).toBe('Taxa de Entrega')
    })

    it('guard: admin (não-entregador) não pode chamar entregador_meus_repasses', async () => {
        const { error } = await admin.rpc('entregador_meus_repasses')
        expect(error).not.toBeNull()
    })
})

describe('admin_extrato_entregadores (integração)', () => {
    it('agrega o repasse pago e mantém a invariante saldo = devido − pago', async () => {
        const { data: cat } = await admin.from('plano_de_contas')
            .select('id').eq('codigo', 'TAXA_ENTREGA_ENTREGADOR').single()
        await admin.rpc('registrar_despesa_manual', {
            p_valor: 7,
            p_descricao: 'Repasse extrato teste',
            p_data: '2026-07-11',
            p_conta_id: contaCaixaId,
            p_plano_conta_id: cat!.id as string,
            p_entregador_id: entregadorId,
        })

        const { data: extrato, error } = await admin.rpc('admin_extrato_entregadores', {
            p_inicio: '2026-07-01', p_fim: '2026-07-31',
        })
        expect(error).toBeNull()
        const row = (extrato ?? []).find((r) => r.entregador_id === entregadorId)
        expect(row).toBeTruthy()
        expect(Number(row!.pago)).toBeGreaterThanOrEqual(7)
        // invariante do cálculo
        expect(Number(row!.saldo_repasse)).toBeCloseTo(Number(row!.devido) - Number(row!.pago), 2)
    })

    it('guard: entregador (não-admin) não pode chamar', async () => {
        const { error } = await mauricio.rpc('admin_extrato_entregadores', {
            p_inicio: '2026-07-01', p_fim: '2026-07-31',
        })
        expect(error).not.toBeNull()
    })
})

describe('acerto do dinheiro (Stage 2d) (integração)', () => {
    it('recolher → valor_recebido>0 e não acertado; admin acerta → acertado', async () => {
        const { vendaId, total } = await criarVenda({ forma: 'venda', taxa: 0, entregadorId, dinheiroNaEntrega: true })
        // Maurício recolhe o dinheiro na entrega
        await mauricio.rpc('entregador_marcar_recebido_dinheiro', { p_venda_id: vendaId })

        // minhas_entregas: valor_recebido = total e ainda não acertado
        const { data: ent1 } = await mauricio.rpc('entregador_minhas_entregas')
        const linha1 = (ent1 ?? []).find((r) => r.venda_id === vendaId)
        expect(Number(linha1!.valor_recebido)).toBe(total)
        expect(linha1!.dinheiro_acertado_em).toBeNull()

        // aparece na lista "a acertar" do admin
        const { data: aAcertar } = await admin.from('vendas')
            .select('id').eq('id', vendaId)
            .is('dinheiro_acertado_em', null).not('recebido_por_entregador_id', 'is', null)
        expect((aAcertar ?? []).length).toBe(1)

        // admin confirma o recebimento
        await admin.from('vendas').update({ dinheiro_acertado_em: new Date().toISOString() }).eq('id', vendaId)

        // minhas_entregas: agora acertado (sai do "em mãos")
        const { data: ent2 } = await mauricio.rpc('entregador_minhas_entregas')
        const linha2 = (ent2 ?? []).find((r) => r.venda_id === vendaId)
        expect(linha2!.dinheiro_acertado_em).not.toBeNull()
    })
})

describe('entregador_salvar_nota (Feature #4 — prova de entrega) (integração)', () => {
    it('Maurício salva a observação na venda dele → aparece em minhas_entregas', async () => {
        const { vendaId } = await criarVenda({ forma: 'venda', taxa: 5, entregadorId })
        const nota = `Deixei com o vizinho, portão 12 ${Date.now()}`

        const { error } = await mauricio.rpc('entregador_salvar_nota', { p_venda_id: vendaId, p_nota: nota })
        expect(error).toBeNull()

        const { data } = await mauricio.rpc('entregador_minhas_entregas')
        const linha = (data ?? []).find((r) => r.venda_id === vendaId)
        expect(linha!.nota_entregador).toBe(nota)
    })

    it('texto em branco limpa a nota (NULLIF/trim → null)', async () => {
        const { vendaId } = await criarVenda({ forma: 'venda', entregadorId })
        await mauricio.rpc('entregador_salvar_nota', { p_venda_id: vendaId, p_nota: 'algo' })
        await mauricio.rpc('entregador_salvar_nota', { p_venda_id: vendaId, p_nota: '   ' })

        const { data } = await mauricio.rpc('entregador_minhas_entregas')
        const linha = (data ?? []).find((r) => r.venda_id === vendaId)
        expect(linha!.nota_entregador).toBeNull()
    })

    it('rejeita salvar nota em venda não atribuída a ele', async () => {
        const { vendaId } = await criarVenda({ forma: 'venda', entregadorId: null })
        const { error } = await mauricio.rpc('entregador_salvar_nota', { p_venda_id: vendaId, p_nota: 'x' })
        expect(error).not.toBeNull()
    })
})
