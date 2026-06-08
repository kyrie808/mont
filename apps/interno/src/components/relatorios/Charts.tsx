import { useState, useEffect } from 'react'

// ── CSS variable helpers (Tailwind HSL channels → full colors) ──────────────
export const C_CARD      = 'hsl(var(--card))'
export const C_BORDER    = 'hsl(var(--border))'
export const C_MUTED     = 'hsl(var(--muted))'
export const C_FG        = 'hsl(var(--foreground))'
export const C_MUTED_FG  = 'hsl(var(--muted-foreground))'
export const C_BG        = 'hsl(var(--background))'
export const C_SHADOW    = 'var(--shadow-card)'
export const C_MONO      = 'ui-monospace, monospace'

// ── Animation hook (RAF ease-out, 700ms) ──────────────────────────────────────
// eslint-disable-next-line react-hooks/exhaustive-deps
export function useAnim(deps: unknown[]): number {
    const [t, setT] = useState(0)
    useEffect(() => {
        setT(0)
        const start = performance.now()
        const dur = 700
        let raf: number
        const tick = (now: number) => {
            const elapsed = Math.min(1, (now - start) / dur)
            const eased = 1 - Math.pow(1 - elapsed, 3)
            setT(eased)
            if (elapsed < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)
    return t
}

function makePath(points: [number, number][]): string {
    return points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ')
}

function smoothCatmull(points: [number, number][], tension = 6): string {
    if (points.length < 2) return ''
    let d = `M ${points[0][0]} ${points[0][1]}`
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = points[i + 2] ?? p2
        const cp1x = p1[0] + (p2[0] - p0[0]) / tension
        const cp1y = p1[1] + (p2[1] - p0[1]) / tension
        const cp2x = p2[0] - (p3[0] - p1[0]) / tension
        const cp2y = p2[1] - (p3[1] - p1[1]) / tension
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`
    }
    return d
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
interface SparklineProps {
    data: number[]
    color?: string
    width?: number
    height?: number
    animKey: string | number
}

export function Sparkline({ data, color = '#13ec13', width = 80, height = 24, animKey }: SparklineProps) {
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const pts: [number, number][] = data.map((v, i) => [
        (i / (data.length - 1)) * width,
        height - ((v - min) / range) * height,
    ])
    const t = useAnim([animKey])
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <defs>
                <clipPath id={`sp-${animKey}`}>
                    <rect x="0" y="0" width={width * t} height={height} />
                </clipPath>
            </defs>
            <path d={makePath(pts)} fill="none" stroke={color} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  clipPath={`url(#sp-${animKey})`} />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]}
                    r="3" fill={color} opacity={t} />
        </svg>
    )
}

// ── AreaChart ─────────────────────────────────────────────────────────────────
interface AreaChartProps {
    data: number[]
    labels: string[]
    currentIndex?: number
    width?: number
    height?: number
    color?: string
    animKey: string | number
}

export function AreaChart({ data, labels, currentIndex, width = 360, height = 140, color = '#13ec13', animKey }: AreaChartProps) {
    const PADL = 8, PADR = 8, PADT = 12, PADB = 22
    const innerW = width - PADL - PADR
    const innerH = height - PADT - PADB
    const max = Math.max(...data) * 1.08 || 1
    const pts: [number, number][] = data.map((v, i) => [
        PADL + (i / (data.length - 1)) * innerW,
        PADT + innerH - (v / max) * innerH,
    ])
    const linePath = smoothCatmull(pts)
    const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${PADT + innerH} L ${pts[0][0]} ${PADT + innerH} Z`
    const t = useAnim([animKey])
    const curr = currentIndex ?? (data.length - 1)
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%' }}>
            <defs>
                <linearGradient id={`area-grad-${animKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
                <clipPath id={`area-clip-${animKey}`}>
                    <rect x={PADL} y={PADT} width={innerW * t} height={innerH} />
                </clipPath>
            </defs>
            <line x1={PADL} y1={PADT + innerH} x2={width - PADR} y2={PADT + innerH}
                  stroke={C_BORDER} strokeDasharray="2 4" />
            <path d={areaPath} fill={`url(#area-grad-${animKey})`} clipPath={`url(#area-clip-${animKey})`} />
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  clipPath={`url(#area-clip-${animKey})`} />
            <circle cx={pts[curr][0]} cy={pts[curr][1]} r="5" fill="#fff"
                    stroke={color} strokeWidth="2.5" opacity={t > 0.9 ? 1 : 0} />
            {labels.map((l, i) => (
                <text key={i} x={pts[i][0]} y={height - 6}
                      textAnchor="middle" fontSize="9" fontWeight="600"
                      fill={i === curr ? C_FG : C_MUTED_FG}
                      fontFamily={C_MONO}>{l}</text>
            ))}
        </svg>
    )
}

// ── HBars ─────────────────────────────────────────────────────────────────────
export interface HBarEntry {
    id: string | null
    label: string | null
    value: number
    color?: string
}
interface HBarsProps {
    data: HBarEntry[]
    width?: number
    animKey: string | number
    fmtValue: (v: number) => string
    barHeight?: number
    gap?: number
}

export function HBars({ data, width = 358, animKey, fmtValue, barHeight = 22, gap = 8 }: HBarsProps) {
    const max = Math.max(...data.map(d => d.value)) || 1
    const labelW = 130
    const valueW = 78
    const barAreaW = width - labelW - valueW - 12
    const totalH = data.length * (barHeight + gap) - gap
    const t = useAnim([animKey])
    return (
        <svg width={width} height={totalH} viewBox={`0 0 ${width} ${totalH}`} style={{ width: '100%' }}>
            {data.map((d, i) => {
                const y = i * (barHeight + gap)
                const w = (d.value / max) * barAreaW * t
                const color = d.color ?? '#13ec13'
                const label = d.label ?? ''
                return (
                    <g key={d.id ?? i}>
                        <text x="0" y={y + barHeight / 2 + 3} fontSize="11" fontWeight="700"
                              fill={C_FG} fontFamily="Lexend">
                            {label.length > 22 ? label.slice(0, 21) + '…' : label}
                        </text>
                        <rect x={labelW} y={y + 4} width={barAreaW} height={barHeight - 8}
                              rx="3" fill={C_MUTED} />
                        <rect x={labelW} y={y + 4} width={w} height={barHeight - 8} rx="3" fill={color} />
                        <text x={width} y={y + barHeight / 2 + 3} textAnchor="end"
                              fontSize="11" fontWeight="700" fill={C_FG} fontFamily={C_MONO}>
                            {fmtValue(d.value)}
                        </text>
                    </g>
                )
            })}
        </svg>
    )
}

// ── Donut ─────────────────────────────────────────────────────────────────────
export interface DonutSegment {
    pct: number
    color: string
}
interface DonutProps {
    segments: DonutSegment[]
    centerLabel: string
    centerSub?: string
    size?: number
    strokeW?: number
    animKey: string | number
}

export function Donut({ segments, centerLabel, centerSub, size = 110, strokeW = 14, animKey }: DonutProps) {
    const r = (size - strokeW) / 2
    const c = 2 * Math.PI * r
    const t = useAnim([animKey])
    let acc = 0
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
                 style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                        stroke={C_MUTED} strokeWidth={strokeW} />
                {segments.map((s, i) => {
                    const arc = (s.pct / 100) * c * t
                    const dasharray = `${arc} ${c}`
                    const dashoffset = -((acc / 100) * c)
                    acc += s.pct
                    return (
                        <circle key={i}
                                cx={size / 2} cy={size / 2} r={r}
                                fill="none" stroke={s.color} strokeWidth={strokeW}
                                strokeDasharray={dasharray} strokeDashoffset={dashoffset} />
                    )
                })}
            </svg>
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
            }}>
                <div style={{
                    fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                    fontSize: 22, fontWeight: 800, color: C_FG,
                    letterSpacing: '-0.03em', lineHeight: 1,
                }}>{centerLabel}</div>
                {centerSub && (
                    <div style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.15em', color: C_MUTED_FG, marginTop: 3,
                    }}>{centerSub}</div>
                )}
            </div>
        </div>
    )
}

// ── StackedTimeline ───────────────────────────────────────────────────────────
interface TimelineEntry {
    dia: number
    receber: number
    pagar: number
}
interface StackedTimelineProps {
    data: TimelineEntry[]
    width?: number
    height?: number
    animKey: string | number
}

export function StackedTimeline({ data, width = 358, height = 130, animKey }: StackedTimelineProps) {
    const PADL = 4, PADR = 4, PADT = 10, PADB = 24
    const innerW = width - PADL - PADR
    const innerH = height - PADT - PADB
    const max = Math.max(...data.flatMap(d => [d.receber, d.pagar]), 1)
    const n = data.length
    const slot = innerW / n
    const barW = slot * 0.4
    const t = useAnim([animKey])
    const midY = PADT + innerH / 2
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%' }}>
            <line x1={PADL} y1={midY} x2={width - PADR} y2={midY} stroke={C_BORDER} />
            {data.map((d, i) => {
                const xCenter = PADL + slot * (i + 0.5)
                const hR = ((d.receber / max) * (innerH / 2)) * t
                const hP = ((d.pagar / max) * (innerH / 2)) * t
                return (
                    <g key={d.dia}>
                        <rect x={xCenter - barW - 1} y={midY - hR} width={barW} height={hR}
                              rx="1.5" fill="#13ec13" />
                        <rect x={xCenter + 1} y={midY} width={barW} height={hP}
                              rx="1.5" fill="#ef4444" opacity="0.7" />
                    </g>
                )
            })}
            {[1, 8, 15, 22, 30].map(d => (
                <text key={d} x={PADL + slot * (d - 0.5)} y={height - 6}
                      textAnchor="middle" fontSize="9" fontWeight="600"
                      fill={C_MUTED_FG} fontFamily={C_MONO}>d{d}</text>
            ))}
            <text x={PADL + 4} y={PADT + 10} fontSize="8" fontWeight="800"
                  fill="#0a8a0a" fontFamily="Lexend">↑ A RECEBER</text>
            <text x={PADL + 4} y={height - PADB + 14} fontSize="8" fontWeight="800"
                  fill="#b91c1c" fontFamily="Lexend">↓ A PAGAR</text>
        </svg>
    )
}

// ── StackedArea ───────────────────────────────────────────────────────────────
export interface WeekEntry {
    sem: string
    online: number
    direto: number
}
interface StackedAreaProps {
    weeks: WeekEntry[]
    width?: number
    height?: number
    animKey: string | number
}

export function StackedArea({ weeks, width = 358, height = 140, animKey }: StackedAreaProps) {
    const PADL = 8, PADR = 8, PADT = 18, PADB = 22
    const innerW = width - PADL - PADR
    const innerH = height - PADT - PADB
    const n = weeks.length
    const max = Math.max(...weeks.map(w => w.online + w.direto)) * 1.1 || 1
    const X = (i: number) => PADL + (i / (n - 1)) * innerW
    const Y = (v: number) => PADT + innerH - (v / max) * innerH
    const diretoPts: [number, number][] = weeks.map((w, i) => [X(i), Y(w.direto)])
    const onlinePts: [number, number][] = weeks.map((w, i) => [X(i), Y(w.direto + w.online)])
    const diretoLine = smoothCatmull(diretoPts, 5)
    const onlineLine = smoothCatmull(onlinePts, 5)
    const baseLine = `L ${PADL + innerW} ${PADT + innerH} L ${PADL} ${PADT + innerH} Z`
    const diretoArea = `${diretoLine} ${baseLine}`
    const reverseSmooth = (points: [number, number][]) =>
        smoothCatmull([...points].reverse(), 5).replace(/^M/, 'L')
    const onlineArea = `${onlineLine} ${reverseSmooth(diretoPts)} Z`
    const t = useAnim([animKey])
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%' }}>
            <defs>
                <linearGradient id={`sa-online-${animKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#13ec13" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#13ec13" stopOpacity="0.18" />
                </linearGradient>
                <linearGradient id={`sa-direto-${animKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.35" />
                </linearGradient>
                <clipPath id={`sa-clip-${animKey}`}>
                    <rect x={PADL} y={PADT} width={innerW * t} height={innerH} />
                </clipPath>
            </defs>
            <line x1={PADL} y1={PADT + innerH} x2={width - PADR} y2={PADT + innerH} stroke={C_BORDER} />
            <path d={diretoArea} fill={`url(#sa-direto-${animKey})`} clipPath={`url(#sa-clip-${animKey})`} />
            <path d={onlineArea} fill={`url(#sa-online-${animKey})`} clipPath={`url(#sa-clip-${animKey})`} />
            <path d={diretoLine} fill="none" stroke="#10b981" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"
                  clipPath={`url(#sa-clip-${animKey})`} />
            <path d={onlineLine} fill="none" stroke="#13ec13" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round"
                  clipPath={`url(#sa-clip-${animKey})`} />
            <circle cx={onlinePts[n - 1][0]} cy={onlinePts[n - 1][1]}
                    r="4" fill="#fff" stroke="#13ec13" strokeWidth="2"
                    opacity={t > 0.9 ? 1 : 0} />
            {weeks.map((w, i) => (
                <text key={i} x={X(i)} y={height - 6} textAnchor="middle"
                      fontSize="9" fontWeight={i === n - 1 ? '800' : '600'}
                      fill={i === n - 1 ? C_FG : C_MUTED_FG}
                      fontFamily={C_MONO}>{w.sem}</text>
            ))}
        </svg>
    )
}
