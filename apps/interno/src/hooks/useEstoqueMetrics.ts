import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface EstoqueMetrics {
    totalProdutos: number
    produtosBaixoEstoque: number
}

export function useEstoqueMetrics() {
    const [metrics, setMetrics] = useState<EstoqueMetrics>({
        totalProdutos: 0,
        produtosBaixoEstoque: 0
    })
    const [loading, setLoading] = useState(true)

    async function fetchMetrics() {
        try {
            setLoading(true)

            // 1. Total de produtos ativos
            // Usamos count() para ser rápido
            const { count: total, error: errorTotal } = await supabase
                .from('produtos')
                .select('*', { count: 'exact', head: true })
                .eq('ativo', true)

            if (errorTotal) throw errorTotal

            // 2. Produtos com baixo estoque
            // Como a comparação de colunas (estoque_atual <= estoque_minimo) 
            // não é trivial com a API simples do Supabase JS sem RPC,
            // vamos buscar os produtos e filtrar no front (assumindo catálogo < 1000 itens para MVP).
            // Se escalar, criar uma VIEW ou RPC é melhor.
            const { data: produtos, error: errorBaixo } = await supabase
                .from('produtos')
                .select('estoque_atual, estoque_minimo')
                .eq('ativo', true)

            if (errorBaixo) throw errorBaixo

            const baixoEstoqueCount = produtos?.filter(p => {
                const atual = p.estoque_atual || 0
                const minimo = p.estoque_minimo ?? 10 // Fallback seguro
                return atual <= minimo
            }).length || 0

            setMetrics({
                totalProdutos: total || 0,
                produtosBaixoEstoque: baixoEstoqueCount
            })

        } catch (error) {
            console.error('Erro ao buscar métricas de estoque:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMetrics()

        // Opcional: Inscrever em mudanças se necessário
        // const subscription = supabase...
    }, [])

    return {
        ...metrics,
        loading,
        refetch: fetchMetrics
    }
}
