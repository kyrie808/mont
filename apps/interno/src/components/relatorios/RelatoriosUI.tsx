import { TrendingUp, TrendingDown } from 'lucide-react'
import { C_CARD, C_BORDER, C_MUTED, C_MUTED_FG, C_SHADOW } from './Charts'

// ── Formatters ─────────────────────────────────────────────────────────────────
export const fmtBRL  = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
export const fmtBRLk = (n: number) =>
    n >= 1000
        ? 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k'
        : 'R$ ' + Math.round(n)
export const fmtPct = (n: number) =>
    n > 0 ? `+${n.toFixed(1)}%` : n < 0 ? `−${Math.abs(n).toFixed(1)}%` : '0%'
export const fmtNum = (n: number) => Math.round(n).toLocaleString('pt-BR')

export const MES_ABBREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

// ── Insight ────────────────────────────────────────────────────────────────────
// Cabeçalho de seção na escala tipográfica do sistema (Lexend): kicker discreto +
// frase-insight em text-base bold + apoio muted. Sem px inline mágico.
interface InsightProps {
    eyebrow?: string
    headline: string
    sub?: string
}

export function Insight({ eyebrow, headline, sub }: InsightProps) {
    return (
        <div className="mb-2.5 pl-1">
            {eyebrow && (
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</div>
            )}
            <div className="mt-1 text-base font-bold leading-snug text-foreground">{headline}</div>
            {sub && (
                <div className="mt-1 text-[13px] font-medium leading-snug text-muted-foreground">{sub}</div>
            )}
        </div>
    )
}

// ── ChartCard ──────────────────────────────────────────────────────────────────
interface ChartCardProps {
    children: React.ReactNode
    padding?: number
    style?: React.CSSProperties
    className?: string
}

export function ChartCard({ children, padding = 14, style, className }: ChartCardProps) {
    return (
        <div className={className} style={{
            background: C_CARD,
            border: `1px solid ${C_BORDER}`,
            borderRadius: 16,
            padding,
            boxShadow: C_SHADOW,
            ...style,
        }}>
            {children}
        </div>
    )
}

// ── MiniStat ───────────────────────────────────────────────────────────────────
interface MiniStatProps {
    label: string
    value: string
    accent?: string
    sub?: string
}

export function MiniStat({ label, value, accent, sub }: MiniStatProps) {
    return (
        <div className="rounded-[10px] bg-muted px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 font-mono text-base font-bold tabular-nums leading-tight text-foreground"
                 style={accent ? { color: accent } : undefined}>{value}</div>
            {sub && (
                <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">{sub}</div>
            )}
        </div>
    )
}

// ── DeltaPill ──────────────────────────────────────────────────────────────────
interface DeltaPillProps {
    delta: number
    size?: 'sm' | 'md' | 'lg'
}

export function DeltaPill({ delta, size = 'md' }: DeltaPillProps) {
    const pos = delta > 0
    const neg = delta < 0
    const color = pos ? '#0a8a0a' : neg ? '#b91c1c' : C_MUTED_FG
    const bg    = pos ? 'rgba(19,236,19,.10)' : neg ? 'rgba(239,68,68,.10)' : C_MUTED
    const Icon  = pos ? TrendingUp : neg ? TrendingDown : null
    const fs    = size === 'sm' ? 10 : size === 'lg' ? 13 : 11
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: size === 'lg' ? '4px 10px' : '2px 7px',
            borderRadius: 999, background: bg, color,
            fontSize: fs, fontWeight: 800,
            fontFamily: 'Lexend',
            fontVariantNumeric: 'tabular-nums',
        }}>
            {Icon && <Icon size={fs} strokeWidth={2.6} />}
            {fmtPct(delta)}
        </span>
    )
}

// ── SectionEyebrow ─────────────────────────────────────────────────────────────
interface SectionEyebrowProps {
    icon?: React.ReactNode
    children: React.ReactNode
    right?: React.ReactNode
}

export function SectionEyebrow({ icon, children, right }: SectionEyebrowProps) {
    return (
        <div className="mb-2 flex items-center justify-between pl-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {icon}{children}
            </span>
            {right}
        </div>
    )
}

// ── LegendDot ──────────────────────────────────────────────────────────────────
interface LegendDotProps {
    color: string
    label: string
}

export function LegendDot({ color, label }: LegendDotProps) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, color: C_MUTED_FG,
        }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
            {label}
        </span>
    )
}

// ── EmptyState ─────────────────────────────────────────────────────────────────
export function EmptyState({ msg }: { msg: string }) {
    return (
        <div style={{
            textAlign: 'center', padding: '48px 16px',
            color: C_MUTED_FG, fontSize: 13, fontWeight: 500,
        }}>{msg}</div>
    )
}
