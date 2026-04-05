import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface CicloRecompra {
    b2c: number
    b2b: number
}

interface RecompensaIndicacao {
    tipo: 'desconto' | 'produto_gratis'
    valor: number
    minIndicacoes?: number
}

interface Configuracoes {
    cicloRecompra: CicloRecompra
    recompensaIndicacao: RecompensaIndicacao
    mensagemRecompra: string
    taxaEntregaPadrao: number
}

const DEFAULT_CONFIG: Configuracoes = {
    cicloRecompra: { b2c: 15, b2b: 7 },
    recompensaIndicacao: { tipo: 'desconto', valor: 5 },
    mensagemRecompra: 'Olá {{nome}}! Faz {{dias}} dias que você não compra conosco. Que tal fazer um novo pedido? 🧀',
    taxaEntregaPadrao: 0,
}

interface UseConfiguracoesReturn {
    config: Configuracoes
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
    updateConfig: (chave: string, valor: Record<string, unknown>) => Promise<boolean>
}

export function useConfiguracoes(): UseConfiguracoesReturn {
    const [config, setConfig] = useState<Configuracoes>(DEFAULT_CONFIG)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchConfiguracoes = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const { data, error: queryError } = await supabase
                .from('configuracoes')
                .select('chave, valor')

            if (queryError) throw queryError

            // Parse config values
            const configObj = { ...DEFAULT_CONFIG }

            data?.forEach((item: any) => {
                switch (item.chave) {
                    case 'ciclo_recompra':
                        configObj.cicloRecompra = item.valor as unknown as CicloRecompra
                        break
                    case 'recompensa_indicacao':
                        configObj.recompensaIndicacao = item.valor as unknown as RecompensaIndicacao
                        break
                    case 'mensagem_recompra':
                        configObj.mensagemRecompra = (item.valor as unknown as { texto: string }).texto || DEFAULT_CONFIG.mensagemRecompra
                        break
                    case 'taxa_entrega_padrao':
                        configObj.taxaEntregaPadrao = (item.valor as unknown as { valor: number }).valor || 0
                        break
                }
            })

            setConfig(configObj)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar configurações')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchConfiguracoes()
    }, [fetchConfiguracoes])

    const updateConfig = async (chave: string, valor: Record<string, unknown>): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('configuracoes')
                .update({ valor: valor as unknown as Record<string, never> })
                .eq('chave', chave)

            if (error) throw error

            await fetchConfiguracoes()
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao atualizar configuração')
            return false
        }
    }

    return {
        config,
        loading,
        error,
        refetch: fetchConfiguracoes,
        updateConfig,
    }
}
