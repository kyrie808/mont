import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTestClient, cleanTestData } from '@mont/shared/test-utils'

/**
 * Integração (PRODUÇÃO, conta-teste, SÓ LEITURA): Relatórios (Clientes, Marketing, Produtos) e
 * Ranking passam a ler TOTAIS do banco em vez de somar no navegador uma lista que o PostgREST
 * corta em 1000. Gabarito: a lista INTEIRA lida em lotes de 1000 e as MESMAS contas que as telas
 * faziam. Exercita o serviço/hook reais — só o client Supabase é o da conta-teste.
 */

const alvo = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('../../lib/supabase', () => ({
    get supabase() {
        if (!alvo.cliente) throw new Error('client de teste não inicializado')
        return alvo.cliente
    },
}))

import { relatorioService, rangeDoPeriodo, type LtvCliente } from '../relatorioService'
import { useRankingCompras } from '../../hooks/useRankingCompras'

type Client = Awaited<ReturnType<typeof createTestClient>>
let supabase: Client

const centavos = (x: number) => Math.round(x * 100)

async function ltvInteiro(desde: string | null, ate: string | null): Promise<LtvCliente[]> {
    const linhas: LtvCliente[] = []
    for (let de = 0; ; de += 1000) {
        const { data, error } = await supabase
            .rpc('rpt_ltv_por_cliente_periodo', { p_desde: desde ?? undefined, p_ate: ate ?? undefined })
            .order('ltv_total', { ascending: false }).order('contato_id').range(de, de + 999)
        if (error) throw error
        linhas.push(...(data ?? []))
        if (!data || data.length < 1000) return linhas
    }
}

const hoje = new Date()
const PERIODOS = [
    ['geral', { tipo: 'geral' as const }],
    ['mês', { tipo: 'mes' as const, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }],
] as const

beforeAll(async () => {
    supabase = await createTestClient()
    alvo.cliente = supabase
})

afterEach(async () => {
    await cleanTestData(supabase)
})

describe('Relatórios e Ranking com totais do banco (integração, só leitura)', () => {
    for (const [nome, periodo] of PERIODOS) {
        it(`LTV ${nome}: resumo = contas das telas sobre a lista inteira; listas nominais completas`, async () => {
            const { desde, ate } = rangeDoPeriodo(periodo)
            const lista = await ltvInteiro(desde, ate)
            const resumo = await relatorioService.getLtvResumo(desde, ate)
            expect(resumo).not.toBeNull()
            if (!resumo) return

            const soma = (rows: LtvCliente[]) => rows.reduce((s, c) => s + (c.ltv_total ?? 0), 0)
            const por = (s: string) => lista.filter((c) => c.status_atividade === s)
            const top20 = Math.ceil(lista.length * 0.2)
            expect(resumo.total_clientes).toBe(lista.length)
            expect(centavos(resumo.total_ltv)).toBe(centavos(soma(lista)))
            expect(centavos(resumo.soma_ticket_medio)).toBe(centavos(lista.reduce((s, c) => s + (c.ticket_medio ?? 0), 0)))
            for (const [campo, s] of [['ativos', 'ativo'], ['risco', 'risco'], ['adormecidos', 'adormecido']] as const) {
                expect(resumo[campo], campo).toBe(por(s).length)
                expect(centavos(resumo[`${campo}_ltv`]), `${campo}_ltv`).toBe(centavos(soma(por(s))))
            }
            expect(resumo.top20_clientes).toBe(Math.min(top20, lista.length))
            expect(centavos(resumo.top20_ltv)).toBe(centavos(soma(lista.slice(0, top20))))
            const pedidos = (f: (n: number) => boolean) => lista.filter((c) => f(c.total_pedidos ?? 0)).length
            expect(resumo.compras_1).toBe(pedidos((n) => n === 1))
            expect(resumo.compras_2).toBe(pedidos((n) => n === 2))
            expect(resumo.compras_3a5).toBe(pedidos((n) => n >= 3 && n <= 5))
            expect(resumo.compras_6mais).toBe(pedidos((n) => n >= 6))
            expect(resumo.recompraram).toBe(pedidos((n) => n >= 2))

            // origem (TabMarketing)
            const origens = await relatorioService.getLtvPorOrigem(desde, ate)
            const esperado = new Map<string, { n: number; ltv: number; rec: number }>()
            for (const c of lista) {
                const o = c.origem ?? 'direto'
                const a = esperado.get(o) ?? { n: 0, ltv: 0, rec: 0 }
                a.n += 1; a.ltv += c.ltv_total ?? 0; if ((c.total_pedidos ?? 0) >= 2) a.rec += 1
                esperado.set(o, a)
            }
            expect(origens).toHaveLength(esperado.size)
            for (const o of origens) {
                const e = esperado.get(o.origem)
                expect(e, o.origem).toBeDefined()
                expect(o.clientes).toBe(e?.n)
                expect(centavos(o.ltv_total)).toBe(centavos(e?.ltv ?? 0))
                expect(o.recompraram).toBe(e?.rec)
            }

            // listas nominais: top 8, todos em risco, todos com 1 compra
            const top8 = await relatorioService.getLtvTop(desde, ate, 8)
            expect(top8.map((c) => centavos(c.ltv_total))).toEqual(lista.slice(0, 8).map((c) => centavos(c.ltv_total)))
            const risco = await relatorioService.getLtvFiltrado(desde, ate, { status: 'risco' })
            expect(new Set(risco.map((c) => c.contato_id))).toEqual(new Set(por('risco').map((c) => c.contato_id)))
            const uma = await relatorioService.getLtvFiltrado(desde, ate, { totalPedidos: 1 })
            expect(uma).toHaveLength(resumo.compras_1)
        }, 120_000)
    }

    for (const [nome, ano, mes] of [['geral', null, null], ['mês', hoje.getFullYear(), hoje.getMonth() + 1]] as const) {
        it(`Ranking ${nome}: KPIs = soma da lista inteira; top 10 = os 10 primeiros`, async () => {
            const args = { p_ano: ano ?? undefined, p_mes: mes ?? undefined }
            const lista: { total_pontos: number; total_compras: number }[] = []
            for (let de = 0; ; de += 1000) {
                const { data, error } = await supabase.rpc('rpc_ranking_compras', args)
                    .order('total_pontos', { ascending: false }).order('contato_id').range(de, de + 999)
                if (error) throw error
                lista.push(...(data ?? []))
                if (!data || data.length < 1000) break
            }

            const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
            const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)
            const { result } = renderHook(() => useRankingCompras({ ano, mes }, 10), { wrapper })
            await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 30_000 })

            expect(result.current.error).toBeNull()
            expect(result.current.resumo.totalClientes).toBe(lista.length)
            expect(centavos(result.current.resumo.somaPontos)).toBe(centavos(lista.reduce((s, c) => s + (Number(c.total_pontos) || 0), 0)))
            expect(result.current.resumo.totalCompras).toBe(lista.reduce((s, c) => s + (Number(c.total_compras) || 0), 0))
            expect(result.current.rankingCompras.map((r) => centavos(r.totalPontos)))
                .toEqual(lista.slice(0, 10).map((c) => centavos(Number(c.total_pontos))))
            expect(result.current.rankingCompras.map((r) => r.ranking)).toEqual(lista.slice(0, 10).map((_, i) => i + 1))
        }, 60_000)
    }
})
