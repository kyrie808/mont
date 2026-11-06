import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createTestClient, cleanTestData } from '@mont/shared/test-utils'
import type { Database } from '@mont/shared'

/**
 * Integração (PRODUÇÃO, conta-teste, SÓ LEITURA) da Gestão de Clientes lida pelo banco
 * (`view_contatos_segmento`). Exercita o serviço REAL do app — só o client Supabase que ele
 * importa é trocado pelo client logado como a conta-teste (mesma RLS do app).
 *
 * O que prova, contra a tabela inteira (lida em lotes de 1000, sem o corte do PostgREST):
 *  - "Todos" = total real de `contatos`; contadores = classificação do app sobre todos;
 *  - paginação cobre todos os contatos sem repetir, nos filtros e nas ordenações;
 *  - cada coluna ordenável sai ordenada; temperatura na ordem frio → morno → quente → novo;
 *  - busca por nome, apelido, telefone e palavra exata devolve o MESMO conjunto da busca antiga
 *    (`contatoService.func`), e os contadores reagem à busca;
 *  - conversões de indicação = a conta do antigo useIndicacoes sem o corte de 1000.
 *
 * Nada é gravado. Janela: manual (ver skill tdd-mont-pragmatico).
 */

type Client = SupabaseClient<Database>
const alvo = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('../../lib/supabase', () => ({
    get supabase() {
        if (!alvo.cliente) throw new Error('client de teste não inicializado')
        return alvo.cliente
    },
}))

import { contatosSegmentoService, type ColunaOrdemContatos, type ContatoListado, type FiltroContatos } from '../contatosSegmentoService'
import { contatoService } from '../contatoService'
import { classificarContato, type ContatoResumo, type SegmentoCliente } from '../../utils/segmentoCliente'
import { precisaRevisao } from '../../utils/filaRevisao'
import { stripAccents } from '@mont/shared'
import { temperaturaCliente } from '../../utils/temperaturaCliente'
import { origemBadge } from '../../utils/origemContato'
import { toDomainContato } from '../mappers'

let supabase: Client

/** Lê uma tabela/view inteira em lotes de 1000 (o max_rows). */
async function tudo<T>(ler: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
    const linhas: T[] = []
    for (let de = 0; ; de += 1000) {
        const { data, error } = await ler(de, de + 999)
        if (error) throw new Error(error.message)
        linhas.push(...(data ?? []))
        if (!data || data.length < 1000) return linhas
    }
}

/** Todas as páginas de uma listagem do serviço. */
async function listarTudo(busca: string, filtro: FiltroContatos, coluna: ColunaOrdemContatos = 'criadoEm', desc = true, tamanho = 200) {
    const linhas: ContatoListado[] = []
    let total = 0
    for (let pagina = 0; ; pagina++) {
        const r = await contatosSegmentoService.listar({ busca, filtro, ordem: { coluna, desc }, pagina, tamanho })
        total = r.total
        linhas.push(...r.linhas)
        if (r.linhas.length < tamanho) return { linhas, total }
    }
}

beforeAll(async () => {
    supabase = await createTestClient()
    alvo.cliente = supabase
})

// Os testes só leem; o cleanup padrão fica por disciplina (não há nada da conta-teste a apagar).
afterEach(async () => {
    await cleanTestData(supabase)
})

describe('Gestão de Clientes pela view_contatos_segmento (integração, só leitura)', () => {
    it('"Todos" = total real da tabela contatos, e os contadores batem com a classificação do app', async () => {
        const { count, error } = await supabase.from('contatos').select('id', { count: 'exact', head: true })
        expect(error).toBeNull()

        const contatos = (await tudo((de, ate) => supabase.from('contatos').select('*').order('id').range(de, ate)))
            .map(toDomainContato)
        const resumos = await tudo((de, ate) => supabase.from('contato_compras_resumo')
            .select('contato_id, total_compras, total_gasto, ultima_compra').order('contato_id').range(de, ate))
        const resumoDe = new Map<string, ContatoResumo>(resumos.flatMap((r) => r.contato_id
            ? [[r.contato_id, { totalCompras: Number(r.total_compras) || 0, totalGasto: Number(r.total_gasto) || 0, ultimaCompra: r.ultima_compra }]]
            : []))

        const esperado = { all: contatos.length, clientes: 0, leads: 0, vips: 0, inativos: 0, novosIa: 0 }
        const hoje = new Date()
        for (const c of contatos) {
            const seg = classificarContato(c, resumoDe.get(c.id), hoje)
            if (seg === 'cliente') esperado.clientes++
            else if (seg === 'lead') esperado.leads++
            else if (seg === 'vip') esperado.vips++
            else if (seg === 'inativo') esperado.inativos++
            if (precisaRevisao(c)) esperado.novosIa++
        }

        const contagem = await contatosSegmentoService.contar('')
        const pagina = await contatosSegmentoService.listar({ busca: '', filtro: 'all', ordem: { coluna: 'nome', desc: false }, pagina: 0, tamanho: 25 })

        expect(contatos.length).toBe(count)
        expect(contatos.length).toBeGreaterThan(1000)
        expect(contagem).toEqual(esperado)
        expect(pagina.total).toBe(count)
        expect(pagina.linhas).toHaveLength(25)
    }, 300_000)

    it('paginação cobre todos os contatos sem repetir, em cada filtro', async () => {
        const contagem = await contatosSegmentoService.contar('')
        const porFiltro: [FiltroContatos, number, SegmentoCliente | null][] = [
            ['all', contagem.all, null],
            ['clientes', contagem.clientes, 'cliente'],
            ['leads', contagem.leads, 'lead'],
            ['vips', contagem.vips, 'vip'],
            ['inativos', contagem.inativos, 'inativo'],
            ['novos-ia', contagem.novosIa, null],
        ]
        for (const [filtro, esperado, segmento] of porFiltro) {
            // celular: páginas de 30, mais novos primeiro
            const { linhas, total } = await listarTudo('', filtro, 'criadoEm', true, 30)
            expect(total, filtro).toBe(esperado)
            expect(linhas, filtro).toHaveLength(esperado)
            expect(new Set(linhas.map((l) => l.id)).size, filtro).toBe(esperado)
            if (segmento) expect(linhas.every((l) => l.segmento === segmento), filtro).toBe(true)
            if (filtro === 'novos-ia') expect(linhas.every((l) => precisaRevisao(l)), filtro).toBe(true)
            for (let i = 1; i < linhas.length; i++) expect(linhas[i - 1].criadoEm >= linhas[i].criadoEm, filtro).toBe(true)
        }
    }, 300_000)

    it('cada coluna da grade ordena no servidor (crescente e decrescente), cobrindo todos', async () => {
        const total = (await contatosSegmentoService.contar('')).all
        const ordemTemperatura: Record<string, number> = { frio: 0, morno: 1, quente: 2, novo: 3 }
        const chave: Record<ColunaOrdemContatos, (l: ContatoListado) => number | string | null> = {
            nome: (l) => l.nome,
            tipo: (l) => l.tipo,
            origem: (l) => origemBadge(l.origem, l.fonte).label, // conferido por blocos contíguos (abaixo)
            segmento: (l) => l.segmento,
            temperatura: (l) => ordemTemperatura[temperaturaCliente(l.ritmo).estado],
            compras: (l) => l.resumo.totalCompras,
            totalGasto: (l) => l.resumo.totalGasto,
            ultimaCompra: (l) => l.resumo.ultimaCompra,
            criadoEm: (l) => l.criadoEm,
        }
        const blocosOrigem: Record<'asc' | 'desc', string[]> = { asc: [], desc: [] }
        const comparaTexto = new Intl.Collator('en-US', { sensitivity: 'base' })
        for (const coluna of Object.keys(chave) as ColunaOrdemContatos[]) {
            for (const desc of [false, true]) {
                const { linhas } = await listarTudo('', 'all', coluna, desc, 250) // desktop
                expect(linhas, `${coluna} ${desc}`).toHaveLength(total)
                expect(new Set(linhas.map((l) => l.id)).size, `${coluna} ${desc}`).toBe(total)
                const valores = linhas.map(chave[coluna])
                if (coluna === 'origem') {
                    // Rótulo ordenado pela colação do banco: cada rótulo forma UM bloco contíguo,
                    // e o decrescente traz os blocos na ordem inversa do crescente.
                    const blocos = valores.filter((v, i) => i === 0 || v !== valores[i - 1])
                    expect(new Set(blocos).size, 'origem em blocos contíguos').toBe(blocos.length)
                    blocosOrigem[desc ? 'desc' : 'asc'] = blocos.map(String)
                    continue
                }
                for (let i = 1; i < valores.length; i++) {
                    const a = valores[i - 1], b = valores[i]
                    // vazio = menor valor: primeiro no crescente, último no decrescente
                    const cmp = a === null ? (b === null ? 0 : -1) : b === null ? 1
                        : typeof a === 'number' && typeof b === 'number' ? a - b
                        : coluna === 'nome' ? comparaTexto.compare(String(a), String(b))
                        : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
                    expect(desc ? cmp >= 0 : cmp <= 0, `${coluna} ${desc ? 'desc' : 'asc'} #${i}: ${String(a)} → ${String(b)}`).toBe(true)
                }
            }
        }
        expect(blocosOrigem.desc).toEqual([...blocosOrigem.asc].reverse())
    }, 180_000)

    it('busca por nome, apelido, telefone e palavra exata = mesmo resultado da busca antiga; contadores reagem', async () => {
        const amostra = await tudo((de, ate) => supabase.from('contatos')
            .select('nome, apelido, telefone').order('criado_em').range(de, ate))
        const primeiro = (s: string) => s.trim().split(/\s+/)[0]
        const comAcento = amostra.find((c) => /[À-ú]/.test(c.nome))
        const termos = [
            primeiro(amostra[10].nome),
            primeiro(amostra[500].nome).slice(0, 4),
            primeiro(amostra.find((c) => c.apelido)?.apelido ?? 'a'),
            amostra[300].telefone.replace(/\D/g, '').slice(-4),
            amostra[700].telefone.replace(/\D/g, ''),
            `${primeiro(amostra[42].nome)} `, // espaço no fim = palavra exata
            comAcento ? stripAccents(primeiro(comAcento.nome)) : 'Jose',
            'a',
        ]
        for (const termo of termos) {
            const antiga = await contatoService.func(termo)
            expect(antiga.length, `"${termo}" (a busca antiga tem de caber em 1000 para servir de gabarito)`).toBeLessThan(1000)
            const { linhas, total } = await listarTudo(termo, 'all')
            const contagem = await contatosSegmentoService.contar(termo)
            expect(new Set(linhas.map((l) => l.id)), `"${termo}"`).toEqual(new Set(antiga.map((c) => c.id)))
            expect(total, `"${termo}"`).toBe(antiga.length)
            expect(contagem.all, `"${termo}"`).toBe(antiga.length)
            expect(contagem.clientes + contagem.leads + contagem.vips + contagem.inativos, `"${termo}"`)
                .toBe(linhas.filter((l) => l.segmento !== 'fornecedor').length)
        }
    }, 120_000)

    it('conversões de indicação = a conta do antigo useIndicacoes sem o corte de 1000', async () => {
        const contatos = await tudo((de, ate) => supabase.from('contatos').select('id, indicado_por_id').order('id').range(de, ate))
        const vendas = await tudo((de, ate) => supabase.from('vendas').select('id, contato_id')
            .eq('status', 'entregue').neq('forma_pagamento', 'brinde').order('id').range(de, ate))
        const compras = new Map<string, number>()
        for (const v of vendas) compras.set(v.contato_id, (compras.get(v.contato_id) ?? 0) + 1)
        const existe = new Set(contatos.map((c) => c.id))
        const porIndicador = new Map<string, number>()
        for (const c of contatos) {
            if (!c.indicado_por_id || !existe.has(c.indicado_por_id)) continue
            if ((compras.get(c.id) ?? 0) > 0) porIndicador.set(c.indicado_por_id, (porIndicador.get(c.indicado_por_id) ?? 0) + 1)
        }
        const total = [...porIndicador.values()].reduce((a, b) => a + b, 0)

        expect(await contatosSegmentoService.totalConversoes()).toBe(total)
        for (const [indicador, n] of porIndicador) {
            expect(await contatosSegmentoService.conversoesDoIndicador(indicador), indicador).toBe(n)
        }
        console.info(`[indicações] ${total} conversões em ${porIndicador.size} indicadores`)
    }, 120_000)

    it('segmento do perfil = segmento da lista', async () => {
        const { linhas } = await contatosSegmentoService.listar({ busca: '', filtro: 'all', ordem: { coluna: 'totalGasto', desc: true }, pagina: 0, tamanho: 15 })
        for (const l of linhas) expect(await contatosSegmentoService.segmentoDoContato(l.id), l.id).toBe(l.segmento)
    }, 60_000)
})

