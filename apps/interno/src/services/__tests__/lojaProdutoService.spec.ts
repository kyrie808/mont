import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Aba "Loja" do produto (Parte B da paridade, 03/11/2026): lê e grava o complemento da vitrine
 * (loja_vitrine) pela RPC loja_salvar_vitrine. Camada unit (jsdom, sem banco): supabase mockado.
 * O comportamento no banco (exclusividade, limites, só admin) está em supabase/tests/loja_salvar_vitrine.sql.
 */

const rpcSpy = vi.fn()
let linha: Record<string, unknown> | null = null

vi.mock('../../lib/supabase', () => ({
    supabase: {
        rpc: (nome: string, args: unknown) => {
            rpcSpy(nome, args)
            return Promise.resolve({ error: null })
        },
        from: () => ({
            select: () => ({
                eq: () => ({ maybeSingle: () => Promise.resolve({ data: linha, error: null }) }),
            }),
        }),
    },
}))

import { lojaProdutoService } from '../lojaProdutoService'
import { LOJA_PRODUTO_PADRAO } from '../../schemas/lojaProduto'

const SECAO = '6aca7e95-9544-47ac-bd81-da8fc961eefe'

describe('lojaProdutoService', () => {
    beforeEach(() => {
        rpcSpy.mockClear()
        linha = null
    })

    it('sem linha na vitrine, abre com os padrões (vale o cadastro)', async () => {
        expect(await lojaProdutoService.obter('p1')).toEqual(LOJA_PRODUTO_PADRAO)
    })

    it('linha desligada (visivel = false) também abre com os padrões', async () => {
        linha = { visivel: false, nome_loja: 'X', disponivel: false }
        expect(await lojaProdutoService.obter('p1')).toEqual(LOJA_PRODUTO_PADRAO)
    })

    it('lê a linha: esgotado é o contrário de disponível; nulos viram campo vazio', async () => {
        linha = {
            visivel: true, nome_loja: 'Balde de massa 4 kg', frase_card: null, resumo: null, secao_id: SECAO,
            ordem_loja: 2, destaque_hero: false, leva_junto: true, disponivel: false, usa_estoque: true,
            usar_ancoragem: false,
        }
        expect(await lojaProdutoService.obter('p1')).toEqual({
            nomeLoja: 'Balde de massa 4 kg', fraseCard: '', resumo: '', secaoId: SECAO, ordemLoja: '2',
            destaqueHero: false, levaJunto: true, esgotado: true, usaEstoque: true, usarAncoragem: false,
        })
    })

    it('grava pela RPC; seção e ordem vazias não vão (= igual ao cadastro)', async () => {
        await lojaProdutoService.salvar('p1', { ...LOJA_PRODUTO_PADRAO, fraseCard: ' Rende pra família toda. ', esgotado: true })
        expect(rpcSpy).toHaveBeenCalledWith('loja_salvar_vitrine', {
            p_produto_id: 'p1', p_nome_loja: '', p_frase_card: 'Rende pra família toda.', p_resumo: '',
            p_destaque_hero: false, p_leva_junto: false, p_disponivel: false, p_usa_estoque: false,
            p_usar_ancoragem: false,
        })
    })

    it('seção e ordem só da loja vão quando preenchidas', async () => {
        await lojaProdutoService.salvar('p1', { ...LOJA_PRODUTO_PADRAO, secaoId: SECAO, ordemLoja: '3' })
        expect(rpcSpy.mock.calls[0][1]).toMatchObject({ p_secao_id: SECAO, p_ordem_loja: 3 })
    })

    it('recusa antes do banco: frase com mais de 80 caracteres ou com quebra de linha, ordem não numérica', async () => {
        await expect(lojaProdutoService.salvar('p1', { ...LOJA_PRODUTO_PADRAO, fraseCard: 'a'.repeat(81) })).rejects.toThrow(
            /Frase do card/,
        )
        await expect(lojaProdutoService.salvar('p1', { ...LOJA_PRODUTO_PADRAO, fraseCard: 'duas\nlinhas' })).rejects.toThrow(
            /uma linha/,
        )
        await expect(lojaProdutoService.salvar('p1', { ...LOJA_PRODUTO_PADRAO, ordemLoja: 'abc' })).rejects.toThrow(/Ordem/)
        expect(rpcSpy).not.toHaveBeenCalled()
    })
})
