import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { startOfDay, differenceInDays, isBefore, isSameDay, addDays, parseISO } from 'date-fns'

export type StatusVencimento = 'vencido' | 'hoje' | 'a_vencer'

export interface AlertaContaAPagar {
    id: string
    descricao: string
    credor: string
    valor: number // saldo_devedor (o que ainda falta pagar)
    dataVencimento: string
    status: StatusVencimento
    /** dias de atraso (vencido) ou dias restantes (a_vencer); 0 quando hoje */
    dias: number
}

interface UseAlertasContasAPagarReturn {
    alertas: AlertaContaAPagar[]
    count: number
    totalVencido: number
    totalAVencer: number
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
}

/** Janela de antecedência do lembrete (em dias) antes do vencimento. */
const DIAS_A_VENCER = 3

/**
 * Lembretes de vencimento de contas a pagar (não pagas): vencidas, vencendo hoje,
 * e a vencer nos próximos DIAS_A_VENCER dias. Espelha o padrão de useAlertasFinanceiros
 * (recebíveis). Pull-based; consumido pela central de notificações (sino do Dashboard).
 */
export function useAlertasContasAPagar(enabled: boolean = true): UseAlertasContasAPagarReturn {
    const [alertas, setAlertas] = useState<AlertaContaAPagar[]>([])
    const [loading, setLoading] = useState(enabled)
    const [error, setError] = useState<string | null>(null)

    const fetchAlertas = useCallback(async () => {
        if (!enabled) return
        setLoading(true)
        setError(null)
        try {
            const { data, error: queryError } = await supabase
                .from('contas_a_pagar')
                .select('id, descricao, credor, valor_total, valor_pago, saldo_devedor, data_vencimento, status')
                .neq('status', 'pago')
                .order('data_vencimento', { ascending: true })

            if (queryError) throw queryError

            const hoje = startOfDay(new Date())
            const limiteAVencer = addDays(hoje, DIAS_A_VENCER)
            const processados: AlertaContaAPagar[] = []

            for (const c of data ?? []) {
                if (!c.data_vencimento) continue
                const saldo = Number(c.saldo_devedor ?? 0)
                if (saldo <= 0) continue

                const venc = startOfDay(parseISO(c.data_vencimento))
                let status: StatusVencimento | null = null
                let dias = 0

                if (isBefore(venc, hoje)) {
                    status = 'vencido'
                    dias = differenceInDays(hoje, venc)
                } else if (isSameDay(venc, hoje)) {
                    status = 'hoje'
                } else if (isBefore(venc, limiteAVencer) || isSameDay(venc, limiteAVencer)) {
                    status = 'a_vencer'
                    dias = differenceInDays(venc, hoje)
                }

                if (status) {
                    processados.push({
                        id: c.id,
                        descricao: c.descricao,
                        credor: c.credor,
                        valor: saldo,
                        dataVencimento: c.data_vencimento,
                        status,
                        dias,
                    })
                }
            }

            setAlertas(processados)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar contas a vencer')
        } finally {
            setLoading(false)
        }
    }, [enabled])

    useEffect(() => {
        fetchAlertas()
    }, [fetchAlertas])

    const totalVencido = useMemo(
        () => alertas.filter(a => a.status === 'vencido').reduce((acc, a) => acc + a.valor, 0),
        [alertas],
    )
    const totalAVencer = useMemo(
        () => alertas.filter(a => a.status !== 'vencido').reduce((acc, a) => acc + a.valor, 0),
        [alertas],
    )

    return {
        alertas,
        count: alertas.length,
        totalVencido,
        totalAVencer,
        loading,
        error,
        refetch: fetchAlertas,
    }
}
