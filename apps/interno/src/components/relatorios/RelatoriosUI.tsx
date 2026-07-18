import { TrendingUp, TrendingDown } from 'lucide-react'
import { C_CARD, C_BORDER, C_MUTED, C_FG, C_MUTED_FG, C_SHADOW } from './Charts'

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
interface InsightProps {
    eyebrow?: string
    headline: string
    sub?: string
}

export function Insight({ eyebrow, headline, sub }: InsightProps) {
    return (
        <div style={{ marginBottom: 10, paddingLeft: 4 }}>
            {eyebrow && (
                <div style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.18em', color: C_MUTED_FG,
                }}>{eyebrow}</div>
            )}
            <div style={{
                marginTop: 4, fontSize: 15, fontWeight: 800, color: C_FG,
                letterSpacing: '-0.015em', lineHeight: 1.25,
            }}>{headline}</div>
            {sub && (
                <div style={{
                    marginTop: 3, fontSize: 11, color: C_MUTED_FG, fontWeight: 500,
                }}>{sub}</div>
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
        <div style={{ background: C_MUTED, borderRadius: 10, padding: '9px 11px' }}>
            <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: C_MUTED_FG,
            }}>{label}</div>
            <div style={{
                fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
                fontSize: 15, fontWeight: 700, color: accent ?? C_FG,
                letterSpacing: '-0.02em', marginTop: 3, lineHeight: 1.05,
            }}>{value}</div>
            {sub && (
                <div style={{ fontSize: 10, color: C_MUTED_FG, fontWeight: 500, marginTop: 2 }}>{sub}</div>
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
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8, paddingLeft: 4,
        }}>
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.15em', color: C_MUTED_FG,
            }}>{icon}{children}</span>
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
