import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfMonth } from 'date-fns'

interface ProdutoAgregado {
    produtoId: string
    nome: string
    codigo: string
    quantidade: number
}

interface RelatorioData {
    produtos: ProdutoAgregado[]
    total: number
    dataInicio: string
    dataFim: string
}

interface UseRelatorioFabricaReturn {
    relatorio: RelatorioData | null
    loading: boolean
    error: string | null
    gerarRelatorio: (dataInicio: string, dataFim: string) => Promise<void>
}

export function useRelatorioFabrica(): UseRelatorioFabricaReturn {
    const [relatorio, setRelatorio] = useState<RelatorioData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const gerarRelatorio = useCallback(async (dataInicio: string, dataFim: string) => {
        setLoading(true)
        setError(null)
        setRelatorio(null)

        try {
            // Query para buscar itens de venda com produtos e vendas
            const { data, error: queryError } = await supabase
                .from('itens_venda')
                .select(`
                    quantidade,
                    produto_id,
                    produtos (id, nome, codigo),
                    vendas!inner (data, status)
                `)
                .gte('vendas.data', dataInicio)
                .lte('vendas.data', dataFim)
                .neq('vendas.status', 'cancelada')

            if (queryError) throw queryError

            // Agrupar por produto e somar quantidade
            const agregados: Record<string, ProdutoAgregado> = {}

            for (const item of data || []) {
                const produto = item.produtos as unknown as { id: string; nome: string; codigo: string }
                if (!produto) continue

                const produtoId = produto.id

                if (!agregados[produtoId]) {
                    agregados[produtoId] = {
                        produtoId,
                        nome: produto.nome,
                        codigo: produto.codigo,
                        quantidade: 0,
                    }
                }

                agregados[produtoId].quantidade += Number(item.quantidade)
            }

            const produtos = Object.values(agregados).sort((a, b) => a.nome.localeCompare(b.nome))
            const total = produtos.reduce((acc, p) => acc + p.quantidade, 0)

            setRelatorio({
                produtos,
                total,
                dataInicio,
                dataFim,
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao gerar relatório')
        } finally {
            setLoading(false)
        }
    }, [])

    return {
        relatorio,
        loading,
        error,
        gerarRelatorio,
    }
}

// Helper para obter datas padrão
export function getDefaultDates() {
    const hoje = new Date()
    const primeiroDia = startOfMonth(hoje)

    return {
        dataInicio: format(primeiroDia, 'yyyy-MM-dd'),
        dataFim: format(hoje, 'yyyy-MM-dd'),
    }
}
