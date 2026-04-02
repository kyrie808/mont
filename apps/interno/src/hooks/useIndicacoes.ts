import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Contato } from '../types/database'

export interface Indicado {
    id: string
    nome: string
    telefone: string
    status: string
    totalCompras: number
    primeiraCompra: string | null
}

export interface IndicadorComIndicados {
    indicador: Contato
    indicados: Indicado[]
    totalIndicacoes: number
    indicacoesConvertidas: number  // status === 'cliente'
    recompensaAcumulada: number    // R$5 por indicação convertida (default)
}

interface UseIndicacoesReturn {
    indicadores: IndicadorComIndicados[]
    loading: boolean
    error: string | null
    totalIndicacoes: number
    totalConversoes: number
    taxaConversao: number
    refetch: () => Promise<void>
    getIndicadorById: (id: string) => IndicadorComIndicados | undefined
}

export function useIndicacoes(): UseIndicacoesReturn {
    const [indicadores, setIndicadores] = useState<IndicadorComIndicados[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchIndicacoes = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            // Fetch all contacts that have indicated someone
            const { data: contatos, error: contatosError } = await supabase
                .from('contatos')
                .select('id, nome, telefone, status, indicado_por_id, ultimo_contato')
                .not('indicado_por_id', 'is', null)

            if (contatosError) throw contatosError

            // Normalize indicator data
            const indicados = ((contatos as Record<string, unknown>[]) ?? []).map(c => ({
                ...c,
                indicador: Array.isArray(c.indicador) ? c.indicador[0] : c.indicador
            })) as unknown as Contato[]

            // Fetch all contacts that are indicadores (have indicated at least one person)
            const { data: todosContatos, error: todosError } = await supabase
                .from('contatos')
                .select('id, nome')

            if (todosError) throw todosError
            const allContatos = ((todosContatos as Record<string, unknown>[]) ?? []).map(c => ({
                ...c,
                indicador: Array.isArray(c.indicador) ? c.indicador[0] : c.indicador
            })) as unknown as Contato[]

            // Fetch sales count per contact
            const { data: vendasCount, error: vendasError } = await supabase
                .from('vendas')
                .select('contato_id, id')
                .eq('status', 'entregue')

            if (vendasError) throw vendasError

            // Build map of contact ID to number of purchases
            const comprasPorContato = new Map<string, number>()
            vendasCount?.forEach((v) => {
                const count = comprasPorContato.get(v.contato_id) || 0
                comprasPorContato.set(v.contato_id, count + 1)
            })

            // Group indicados by indicador
            const indicadosPorIndicador = new Map<string, Contato[]>()
            indicados.forEach((c) => {
                if (c.indicado_por_id) {
                    const list = indicadosPorIndicador.get(c.indicado_por_id) || []
                    list.push(c)
                    indicadosPorIndicador.set(c.indicado_por_id, list)
                }
            })

            // Build indicadores list
            const indicadoresList: IndicadorComIndicados[] = []

            indicadosPorIndicador.forEach((indicadosList, indicadorId) => {
                const indicador = allContatos.find((c) => c.id === indicadorId)
                if (!indicador) return

                const indicadosFormatados: Indicado[] = indicadosList.map((i) => ({
                    id: i.id,
                    nome: i.nome,
                    telefone: i.telefone,
                    status: i.status,
                    totalCompras: comprasPorContato.get(i.id) || 0,
                    primeiraCompra: i.ultimo_contato,
                }))

                const indicacoesConvertidas = indicadosList.filter(
                    (i) => i.status === 'cliente'
                ).length

                // R$5 per converted referral (configurable in future)
                const recompensaAcumulada = indicacoesConvertidas * 5

                indicadoresList.push({
                    indicador,
                    indicados: indicadosFormatados,
                    totalIndicacoes: indicadosList.length,
                    indicacoesConvertidas,
                    recompensaAcumulada,
                })
            })

            // Sort by conversions (descending)
            indicadoresList.sort(
                (a, b) => b.indicacoesConvertidas - a.indicacoesConvertidas
            )

            setIndicadores(indicadoresList)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar indicações')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchIndicacoes()
    }, [fetchIndicacoes])

    // Metrics
    const totalIndicacoes = useMemo(
        () => indicadores.reduce((acc, i) => acc + i.totalIndicacoes, 0),
        [indicadores]
    )

    const totalConversoes = useMemo(
        () => indicadores.reduce((acc, i) => acc + i.indicacoesConvertidas, 0),
        [indicadores]
    )

    const taxaConversao = useMemo(
        () => (totalIndicacoes > 0 ? (totalConversoes / totalIndicacoes) * 100 : 0),
        [totalIndicacoes, totalConversoes]
    )

    const getIndicadorById = useCallback(
        (id: string) => indicadores.find((i) => i.indicador.id === id),
        [indicadores]
    )

    return {
        indicadores,
        loading,
        error,
        totalIndicacoes,
        totalConversoes,
        taxaConversao,
        refetch: fetchIndicacoes,
        getIndicadorById,
    }
}
