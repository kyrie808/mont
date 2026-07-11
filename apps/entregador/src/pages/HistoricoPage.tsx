import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useEntregas } from '../hooks/useEntregas'
import { MesGrid } from '../components/MesGrid'
import { DiaSheet } from '../components/DiaSheet'
import { parseYMD, hojeSP } from '../lib/format'
import type { Entrega } from '../services/entregasService'

export function HistoricoPage() {
    const { data, isLoading } = useEntregas()

    const entregues = useMemo(
        () => (data ?? []).filter((e) => e.status_entrega === 'entregue' && e.data),
        [data],
    )

    // Agrupa por dia (YYYY-MM-DD) → chips na célula + conteúdo do sheet.
    const entregasPorDia = useMemo(() => {
        const map = new Map<string, Entrega[]>()
        for (const e of entregues) {
            const k = e.data as string
            const arr = map.get(k)
            if (arr) arr.push(e)
            else map.set(k, [e])
        }
        return map
    }, [entregues])

    // Default: mês da entrega mais recente; senão, mês atual.
    const mesDefault = useMemo(() => {
        if (entregues.length === 0) return new Date()
        const maxStr = entregues.reduce(
            (max, e) => ((e.data as string) > max ? (e.data as string) : max),
            entregues[0].data as string,
        )
        return parseYMD(maxStr)
    }, [entregues])

    const [mesOverride, setMesOverride] = useState<Date | null>(null)
    const mes = mesOverride ?? mesDefault
    const [diaSel, setDiaSel] = useState<string | null>(null)
    const hojeStr = hojeSP()

    const irMes = (delta: number) =>
        setMesOverride(new Date(mes.getFullYear(), mes.getMonth() + delta, 1))

    return (
        <div className="mx-auto flex min-h-dvh max-w-md flex-col pb-24">
            <header className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
                <h1 className="text-lg font-black text-slate-900">Histórico</h1>
                <p className="text-xs text-slate-500">{entregues.length} entrega(s) concluída(s)</p>
            </header>

            {isLoading ? (
                <div className="flex flex-1 justify-center py-16 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <MesGrid
                    mes={mes}
                    entregasPorDia={entregasPorDia}
                    hojeStr={hojeStr}
                    onPrev={() => irMes(-1)}
                    onNext={() => irMes(1)}
                    onSelecionarDia={setDiaSel}
                />
            )}

            {diaSel && (
                <DiaSheet
                    ymd={diaSel}
                    entregas={entregasPorDia.get(diaSel) ?? []}
                    onClose={() => setDiaSel(null)}
                />
            )}
        </div>
    )
}
