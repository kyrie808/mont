import { supabase } from '../lib/supabase'
import type { Tables } from '@mont/shared'
import type { DomainContato } from '../types/domain'
import { toDomainContato } from './mappers'
import { filtroBuscaContato } from '../utils/telefone'
import { isSegmentoCliente, type ContatoResumo, type SegmentoCliente } from '../utils/segmentoCliente'
import type { RitmoCliente } from '../utils/temperaturaCliente'

/**
 * Gestão de Clientes lida pelo banco (`view_contatos_segmento`, migração 20261106215818).
 *
 * Antes a página buscava `contatos` inteira e classificava/contava no navegador; o PostgREST
 * corta em 1000 linhas (max_rows), então "Todos" travava em 1000 e os contadores saíam baixos.
 * Agora: lista paginada e ordenada no servidor, contadores por `count: 'exact'` no banco, com o
 * MESMO filtro de busca (`filtroBuscaContato`) da lista — os dois nunca divergem.
 */

type LinhaSegmento = Tables<'view_contatos_segmento'>

/** Filtros da página (chips/abas). `novos-ia` não é segmento: é a fila de revisão da secretária. */
export type FiltroContatos = 'all' | 'clientes' | 'leads' | 'vips' | 'inativos' | 'novos-ia'

const FILTRO_SEGMENTO: Record<Exclude<FiltroContatos, 'all' | 'novos-ia'>, SegmentoCliente> = {
    clientes: 'cliente',
    leads: 'lead',
    vips: 'vip',
    inativos: 'inativo',
}

/** Colunas ordenáveis da grade (ids das colunas do ContatosDataGrid). */
export type ColunaOrdemContatos =
    | 'nome' | 'tipo' | 'origem' | 'segmento' | 'temperatura'
    | 'compras' | 'totalGasto' | 'ultimaCompra' | 'criadoEm'

export interface OrdemContatos {
    coluna: ColunaOrdemContatos
    desc: boolean
}

const COLUNA_DA_VIEW: Record<ColunaOrdemContatos, keyof LinhaSegmento> = {
    nome: 'nome',
    tipo: 'tipo',
    origem: 'origem_rotulo',
    segmento: 'segmento',
    temperatura: 'temperatura_ordem',
    compras: 'total_compras',
    totalGasto: 'total_gasto',
    ultimaCompra: 'ultima_compra',
    criadoEm: 'criado_em',
}

export function isColunaOrdemContatos(id: string): id is ColunaOrdemContatos {
    return id in COLUNA_DA_VIEW
}

/** Sem ordenação ativa = ordem de cadastro, mais novos primeiro (a ordem "natural" de sempre). */
export const ORDEM_PADRAO_CONTATOS: OrdemContatos = { coluna: 'criadoEm', desc: true }

/** Estado de ordenação da grade (TanStack) → ordem da consulta. Coluna não ordenável cai no padrão. */
export function ordemDaGrade(sorting: readonly { id: string; desc: boolean }[]): OrdemContatos {
    const primeira = sorting[0]
    if (!primeira || !isColunaOrdemContatos(primeira.id)) return ORDEM_PADRAO_CONTATOS
    return { coluna: primeira.id, desc: primeira.desc }
}

/** Contato da lista: o cadastro + o que a view calcula (segmento, compras, ritmo). */
export type ContatoListado = DomainContato & {
    segmento: SegmentoCliente
    resumo: ContatoResumo
    /** Ausente = sem ritmo (arquivado), igual a "sem linha no kanban" → termômetro "novo". */
    ritmo: RitmoCliente | undefined
}

export interface ParametrosListaContatos {
    busca: string
    filtro: FiltroContatos
    ordem: OrdemContatos
    /** Página a partir de 0. */
    pagina: number
    tamanho: number
}

export interface PaginaContatos {
    linhas: ContatoListado[]
    total: number
}

export interface ContagemContatos {
    all: number
    clientes: number
    leads: number
    vips: number
    inativos: number
    novosIa: number
}

function paraSegmento(valor: string | null): SegmentoCliente {
    if (!isSegmentoCliente(valor)) throw new Error(`Segmento desconhecido na view_contatos_segmento: ${String(valor)}`)
    return valor
}

function resumoDaLinha(l: LinhaSegmento): ContatoResumo {
    return {
        totalCompras: Number(l.total_compras) || 0,
        totalGasto: Number(l.total_gasto) || 0,
        ultimaCompra: l.ultima_compra,
    }
}

function ritmoDaLinha(l: LinhaSegmento): RitmoCliente | undefined {
    if (l.total_pedidos === null) return undefined
    return {
        total_pedidos: l.total_pedidos,
        intervalo_medio: l.intervalo_medio === null ? null : Number(l.intervalo_medio),
        atraso: l.atraso,
        sumido: l.sumido,
        dias_sem_compra: l.dias_sem_compra,
    }
}

/** Consulta base na view, já com a busca aplicada (mesmo filtro da lista e dos contadores). */
function consultaComBusca<T extends string>(colunas: T, busca: string, contar: 'lista' | 'contagem') {
    let q = supabase
        .from('view_contatos_segmento')
        .select(colunas, contar === 'contagem' ? { count: 'exact', head: true } : { count: 'exact' })
    const filtro = filtroBuscaContato(busca)
    if (filtro) q = q.or(filtro)
    return q
}

async function contar(consulta: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
    const { count, error } = await consulta
    if (error) throw new Error(`Erro ao contar contatos: ${error.message}`)
    return count ?? 0
}

export const contatosSegmentoService = {
    async listar({ busca, filtro, ordem, pagina, tamanho }: ParametrosListaContatos): Promise<PaginaContatos> {
        let q = consultaComBusca('*', busca, 'lista')
        if (filtro === 'novos-ia') q = q.eq('precisa_revisao', true)
        else if (filtro !== 'all') q = q.eq('segmento', FILTRO_SEGMENTO[filtro])

        // Vazio (sem compra, sem tipo…) conta como o MENOR valor, como na ordenação da grade:
        // primeiro no crescente, último no decrescente.
        const coluna = COLUNA_DA_VIEW[ordem.coluna]
        q = q.order(coluna, { ascending: !ordem.desc, nullsFirst: !ordem.desc })
        if (coluna !== 'criado_em') q = q.order('criado_em', { ascending: false })
        q = q.order('contato_id', { ascending: true })

        const inicio = pagina * tamanho
        const { data, count, error } = await q.range(inicio, inicio + tamanho - 1)
        if (error) throw new Error(`Erro ao buscar contatos: ${error.message}`)

        const pagina_ = data ?? []
        const ids = pagina_.flatMap((l) => (l.contato_id ? [l.contato_id] : []))
        if (ids.length === 0) return { linhas: [], total: count ?? 0 }

        // Cadastro completo (com indicador) só dos contatos desta página.
        const { data: contatos, error: erroContatos } = await supabase
            .from('contatos')
            .select('*, indicador:contatos!indicado_por_id ( id, nome, telefone )')
            .in('id', ids)
        if (erroContatos) throw new Error(`Erro ao buscar contatos: ${erroContatos.message}`)

        const porId = new Map((contatos ?? []).map((c) => [c.id, toDomainContato(c)]))
        const linhas = pagina_.flatMap((l): ContatoListado[] => {
            const contato = l.contato_id ? porId.get(l.contato_id) : undefined
            if (!contato) return []
            return [{ ...contato, segmento: paraSegmento(l.segmento), resumo: resumoDaLinha(l), ritmo: ritmoDaLinha(l) }]
        })
        return { linhas, total: count ?? 0 }
    },

    /** Contadores dos filtros, contados no banco com a mesma busca da lista. */
    async contar(busca: string): Promise<ContagemContatos> {
        const base = () => consultaComBusca('contato_id', busca, 'contagem')
        const [all, clientes, leads, vips, inativos, novosIa] = await Promise.all([
            contar(base()),
            contar(base().eq('segmento', 'cliente')),
            contar(base().eq('segmento', 'lead')),
            contar(base().eq('segmento', 'vip')),
            contar(base().eq('segmento', 'inativo')),
            contar(base().eq('precisa_revisao', true)),
        ])
        return { all, clientes, leads, vips, inativos, novosIa }
    },

    /** Segmento de um contato (perfil do cliente). `null` se o contato não existe/não é visível. */
    async segmentoDoContato(contatoId: string): Promise<SegmentoCliente | null> {
        const { data, error } = await supabase
            .from('view_contatos_segmento')
            .select('segmento')
            .eq('contato_id', contatoId)
            .maybeSingle()
        if (error) throw new Error(`Erro ao buscar segmento do contato: ${error.message}`)
        return data ? paraSegmento(data.segmento) : null
    },

    /**
     * Indicações convertidas de um indicador: indicados com ao menos uma compra (entregue
     * não-brinde, paga ou não — a mesma régua que o antigo useIndicacoes usava).
     */
    async conversoesDoIndicador(indicadorId: string): Promise<number> {
        return contar(
            supabase
                .from('view_contatos_segmento')
                .select('contato_id', { count: 'exact', head: true })
                .eq('indicado_por_id', indicadorId)
                .gt('total_compras', 0),
        )
    },

    /** Total de indicações convertidas (todos os indicadores). */
    async totalConversoes(): Promise<number> {
        return contar(
            supabase
                .from('view_contatos_segmento')
                .select('contato_id', { count: 'exact', head: true })
                .not('indicado_por_id', 'is', null)
                .gt('total_compras', 0),
        )
    },
}
