import { Info, type LucideIcon } from 'lucide-react'
import { cn, formatCurrency } from '@mont/shared'

/** Meta pela média histórica: current vs goal (média). */
export interface KpiMeta {
    current: number
    goal: number
    /** Mês corrente (parcial) → compara com o RITMO até hoje (pro-rata). */
    emCurso?: boolean
    /** Métrica acumulativa (faturamento, lucro…) → pro-rata no mês em curso.
     *  Ratio (ticket médio) → false: compara direto, sem pro-rata. Default true. */
    cumulative?: boolean
    /** Formato do rótulo da meta. Default 'brl'. */
    unit?: 'brl' | 'num'
}

interface KpiCardDesktopProps {
    title: string
    value: string
    icon?: LucideIcon
    /** Se presente → barra = % da meta (média) + badge vs média. Senão, usa `subtitle`. */
    meta?: KpiMeta
    subtitle?: string
    onClick?: () => void
    tooltip?: string
    loading?: boolean
    className?: string
}

function KpiTooltip({ tooltip }: { tooltip: string }) {
    return (
        <div className="group/tooltip relative flex items-center">
            <Info className="h-3 w-3 cursor-help text-muted-foreground transition-colors hover:text-primary" />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-tooltip mb-2 w-48 -translate-x-1/2 rounded bg-foreground p-2 text-center text-[10px] font-normal leading-tight text-background opacity-0 shadow-modal transition-opacity group-hover/tooltip:opacity-100">
                {tooltip}
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-foreground" />
            </div>
        </div>
    )
}

/** Semáforo: cor conforme o % (barra pelo ritmo; texto idem). */
function barColorByPct(pct: number): string {
    if (pct >= 100) return 'bg-success'
    if (pct >= 66) return 'bg-warning'
    if (pct >= 33) return 'bg-warning-strong'
    return 'bg-destructive'
}
function textColorByPct(pct: number): string {
    if (pct >= 100) return 'text-semantic-green'
    if (pct >= 66) return 'text-warning-strong'
    return 'text-destructive'
}

function MetaRow({ meta }: { meta: KpiMeta }) {
    const { current, goal, emCurso, cumulative = true, unit = 'brl' } = meta
    const hasGoal = goal > 0

    // Mês em curso + métrica acumulativa → compara com o RITMO até hoje.
    const now = new Date()
    const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const paceFactor = emCurso && cumulative ? Math.min(now.getDate() / diasNoMes, 1) : 1
    const expected = goal * paceFactor

    const fillPct = hasGoal ? Math.min((current / goal) * 100, 100) : 0 // largura: rumo à meta cheia
    const paceRatio = expected > 0 ? current / expected : 0 // cor: adiantado/atrasado

    const barColor = hasGoal ? barColorByPct(paceRatio * 100) : 'bg-muted-foreground/40'
    const metaFmt = unit === 'num' ? Math.round(goal).toLocaleString('pt-BR') : formatCurrency(goal)

    // Badge: no ritmo (mês em curso acumulativo) ou vs média (fechado / ratio).
    let badge: string
    let badgeColor: string
    if (!hasGoal) {
        badge = '—'
        badgeColor = 'text-muted-foreground'
    } else if (emCurso && cumulative) {
        badge = `${Math.round(paceRatio * 100)}% do ritmo`
        badgeColor = textColorByPct(paceRatio * 100)
    } else {
        const delta = (current / goal - 1) * 100
        badge = `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}% vs média`
        badgeColor = delta >= 0 ? 'text-semantic-green' : 'text-warning-strong'
    }

    return (
        <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{hasGoal ? `Meta ${metaFmt} · média` : 'Sem histórico ainda'}</span>
                <span className={cn('font-bold tabular-nums', badgeColor)}>{badge}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${fillPct}%` }} />
            </div>
        </div>
    )
}

export function KpiCardDesktop({ title, value, meta, subtitle, onClick, tooltip, loading, className }: KpiCardDesktopProps) {
    if (loading) return <div className={cn('h-[112px] w-full animate-pulse rounded-xl bg-muted', className)} />

    return (
        <div
            onClick={onClick}
            className={cn(
                'rounded-xl border border-border bg-card p-5 shadow-card',
                onClick && 'cursor-pointer transition-shadow hover:shadow-elevated',
                className,
            )}
        >
            <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
                {tooltip && <KpiTooltip tooltip={tooltip} />}
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>

            {meta ? (
                <MetaRow meta={meta} />
            ) : subtitle ? (
                <p className="mt-2 text-xs font-medium text-muted-foreground">{subtitle}</p>
            ) : null}
        </div>
    )
}
