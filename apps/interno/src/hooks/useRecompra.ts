import { useEffect, useState, useMemo, useCallback } from 'react'
import { useConfiguracoes } from './useConfiguracoes'
import { recompraService, type ContatoRecompra, type StatusRecompra } from '../services/recompraService'

interface UseRecompraReturn {
    contatos: ContatoRecompra[]
    loading: boolean
    error: string | null
    atrasados: number
    proximos: number
    emDia: number
    refetch: () => Promise<void>
    marcarComoContatado: (contatoId: string) => Promise<boolean>
}

export function useRecompra(enabled: boolean = true): UseRecompraReturn {
    const { config, loading: loadingConfig } = useConfiguracoes()
    const [contatos, setContatos] = useState<ContatoRecompra[]>([])
    const [loading, setLoading] = useState(enabled)
    const [error, setError] = useState<string | null>(null)

    const fetchRecompra = useCallback(async () => {
        if (!enabled || loadingConfig) return

        setLoading(true)
        setError(null)

        try {
            const data = await recompraService.getRecompraData(config.cicloRecompra)
            setContatos(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar alertas')
        } finally {
            setLoading(false)
        }
    }, [config.cicloRecompra, loadingConfig, enabled])

    useEffect(() => {
        fetchRecompra()
    }, [fetchRecompra])

    const atrasados = useMemo(
        () => contatos.filter((c) => c.status === 'atrasado').length,
        [contatos]
    )

    const proximos = useMemo(
        () => contatos.filter((c) => c.status === 'proximo').length,
        [contatos]
    )

    const emDia = useMemo(
        () => contatos.filter((c) => c.status === 'ok').length,
        [contatos]
    )

    const marcarComoContatado = async (contatoId: string): Promise<boolean> => {
        try {
            await recompraService.marcarComoContatado(contatoId)
            await fetchRecompra()
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao marcar como contatado')
            return false
        }
    }

    return {
        contatos,
        loading: loading || loadingConfig,
        error,
        atrasados,
        proximos,
        emDia,
        refetch: fetchRecompra,
        marcarComoContatado,
    }
}

export type { StatusRecompra, ContatoRecompra }
