import { useState, useEffect, useRef } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { ParentSize } from '@visx/responsive'
import { scaleLinear } from '@visx/scale'
import { LinePath, AreaClosed, Line } from '@visx/shape'
import { LinearGradient } from '@visx/gradient'
import { curveMonotoneX } from '@visx/curve'
import { useTooltip, TooltipWithBounds } from '@visx/tooltip'

// ── Cores (CSS vars = theme-aware) ─────────────────────────────────────────────
export const C_CARD      = 'hsl(var(--card))'
export const C_BORDER    = 'hsl(var(--border))'
export const C_MUTED     = 'hsl(var(--muted))'
export const C_FG        = 'hsl(var(--foreground))'
export const C_MUTED_FG  = 'hsl(var(--muted-foreground))'
export const C_BG        = 'hsl(var(--background))'
export const C_SHADOW    = 'var(--shadow-card)'
export const C_MONO      = 'ui-monospace, monospace'
export const COL_PRIMARY = 'hsl(var(--primary))'         // receita / positivo
export const COL_DESTRUCT = 'hsl(var(--destructive))'    // saída / negativo
export const COL_WARNING = 'hsl(var(--warning-strong))'  // atenção

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const tooltipStyle: CSSProperties = {
    position: 'absolute',
    background: 'hsl(var(--popover))',
    color: 'hsl(var(--popover-foreground))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    padding: '6px 9px',
    fontFamily: 'Lexend',
    fontSize: 11,
    lineHeight: 1.35,
    boxShadow: 'var(--shadow-elevated)',
    pointerEvents: 'none',
    zIndex: 30,
}

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
            setT(1 - Math.pow(1 - elapsed, 3))
            if (elapsed < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)
    return t
}

// ── Responsivo: mede a largura real e posiciona tooltips (position: relative) ───
function Responsive({ height, children }: { height: number; children: (width: number) => ReactNode }) {
    return (
        <div style={{ position: 'relative', width: '100%', height }}>
            <ParentSize debounceTime={16} parentSizeStyles={{ width: '100%', height: '100%' }}>
                {({ width }) => (width > 0 ? children(width) : null)}
            </ParentSize>
        </div>
    )
}

function makePath(points: [number, number][]): string {
    return points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ')
}

// ── Sparkline (mini, sem interação) ────────────────────────────────────────────
interface SparklineProps { data: number[]; color?: string; width?: number; height?: number; animKey: string | number }

export function Sparkline({ data, color = COL_PRIMARY, width = 80, height = 24, animKey }: SparklineProps) {
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
    const pts: [number, number][] = data.map((v, i) => [
        (i / Math.max(1, data.length - 1)) * width,
        height - ((v - min) / range) * height,
    ])
    const t = useAnim([animKey])
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <defs><clipPath id={`sp-${animKey}`}><rect x="0" y="0" width={width * t} height={height} /></clipPath></defs>
            <path d={makePath(pts)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round" clipPath={`url(#sp-${animKey})`} />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} opacity={t} />
        </svg>
    )
}

// ── AreaChart (série mensal) ──────────────────────────────────────────────────
interface AreaChartProps {
    data: number[]; labels: string[]; currentIndex?: number
    width?: number; height?: number; color?: string; animKey: string | number
    // Formatação dos valores (eixo Y + tooltip). Default = moeda; passe fmtNum p/ contagens.
    fmtValue?: (v: number) => string
    fmtAxis?: (v: number) => string
}

export function AreaChart({ height = 170, ...props }: AreaChartProps) {
    return <Responsive height={height}>{(width) => <AreaChartSvg {...props} width={width} height={height} />}</Responsive>
}

function AreaChartSvg({ data, labels, currentIndex, width, height = 170, color = COL_PRIMARY, animKey, fmtValue = fmtBRL, fmtAxis = fmtBRLk }: AreaChartProps & { width: number }) {
    const svgRef = useRef<SVGSVGElement>(null)
    const t = useAnim([animKey])
    const { tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } = useTooltip<{ i: number }>()
    const padL = 44, padR = 14, padT = 14, padB = 24
    const n = data.length
    const max = Math.max(...data, 1) * 1.12
    const x = scaleLinear({ domain: [0, Math.max(1, n - 1)], range: [padL, width - padR] })
    const y = scaleLinear({ domain: [0, max], range: [height - padB, padT] })
    const yTicks = y.ticks(3)
    const curr = currentIndex ?? n - 1
    const gid = `area-${animKey}`
    // Afinar rótulos do eixo X quando há muitos pontos (ex.: série diária ~30 dias),
    // pra não virar sopa de letrinha. O tooltip continua usando labels[i] cheio.
    const labelStep = Math.max(1, Math.ceil(n / 8))

    const onMove = (e: React.MouseEvent) => {
        const rect = svgRef.current?.getBoundingClientRect()
        if (!rect) return
        const px = e.clientX - rect.left
        const i = clamp(Math.round(x.invert(px)), 0, n - 1)
        showTooltip({ tooltipData: { i }, tooltipLeft: x(i), tooltipTop: y(data[i]) })
    }

    return (
        <>
            <svg ref={svgRef} width={width} height={height} style={{ overflow: 'visible' }}>
                <LinearGradient id={gid} from={color} to={color} fromOpacity={0.28} toOpacity={0} />
                {yTicks.map((tv) => (
                    <g key={tv}>
                        <line x1={padL} x2={width - padR} y1={y(tv)} y2={y(tv)} stroke={C_BORDER} strokeDasharray="2 4" opacity={0.5} />
                        <text x={padL - 7} y={y(tv) + 3} textAnchor="end" fontSize="9" fill={C_MUTED_FG} fontFamily={C_MONO}>
                            {fmtAxis(tv)}
                        </text>
                    </g>
                ))}
                <defs><clipPath id={`clip-${gid}`}><rect x={padL} y={padT} width={(width - padL - padR) * t} height={height - padT - padB} /></clipPath></defs>
                <g clipPath={`url(#clip-${gid})`}>
                    <AreaClosed data={data} x={(_d, i) => x(i)} y={(d) => y(d)} yScale={y} curve={curveMonotoneX} fill={`url(#${gid})`} />
                    <LinePath data={data} x={(_d, i) => x(i)} y={(d) => y(d)} curve={curveMonotoneX} stroke={color} strokeWidth={2.5} />
                </g>
                {labels.map((l, i) => {
                    const hovered = i === tooltipData?.i
                    // Mostra 1 a cada labelStep + o último + o ponto em hover.
                    if (!(i % labelStep === 0 || i === n - 1 || hovered)) return null
                    return (
                        <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="9" fontWeight="600"
                              fill={i === (tooltipData?.i ?? curr) ? C_FG : C_MUTED_FG} fontFamily={C_MONO}>{l}</text>
                    )
                })}
                {tooltipData ? (
                    <>
                        <Line from={{ x: tooltipLeft ?? 0, y: padT }} to={{ x: tooltipLeft ?? 0, y: height - padB }} stroke={C_MUTED_FG} strokeWidth={1} strokeDasharray="3 3" />
                        <circle cx={tooltipLeft} cy={tooltipTop} r={4.5} fill={C_CARD} stroke={color} strokeWidth={2.5} />
                    </>
                ) : (
                    <circle cx={x(curr)} cy={y(data[curr])} r={4.5} fill={C_CARD} stroke={color} strokeWidth={2.5} opacity={t > 0.9 ? 1 : 0} />
                )}
                <rect x={padL} y={padT} width={Math.max(0, width - padL - padR)} height={height - padT - padB}
                      fill="transparent" onMouseMove={onMove} onMouseLeave={hideTooltip} />
            </svg>
            {tooltipData && (
                <TooltipWithBounds left={(tooltipLeft ?? 0) + 8} top={(tooltipTop ?? 0) - 8} style={tooltipStyle}>
                    <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{labels[tooltipData.i]}</div>
                    <div style={{ fontFamily: C_MONO }}>{fmtValue(data[tooltipData.i])}</div>
                </TooltipWithBounds>
            )}
        </>
    )
}

// ── HBars ──────────────────────────────────────────────────────────────────────
export interface HBarEntry { id: string | null; label: string | null; value: number; color?: string }
interface HBarsProps { data: HBarEntry[]; width?: number; animKey: string | number; fmtValue: (v: number) => string; barHeight?: number; gap?: number }

export function HBars({ data, animKey, fmtValue, barHeight = 22, gap = 8 }: HBarsProps) {
    const totalH = Math.max(0, data.length * (barHeight + gap) - gap)
    return <Responsive height={totalH}>{(width) => (
        <HBarsSvg width={width} data={data} animKey={animKey} fmtValue={fmtValue} barHeight={barHeight} gap={gap} />
    )}</Responsive>
}

function HBarsSvg({ data, width, animKey, fmtValue, barHeight = 22, gap = 8 }: HBarsProps & { width: number }) {
    const max = Math.max(...data.map(d => d.value), 1)
    const labelW = Math.min(150, Math.max(100, width * 0.32))
    const valueW = 78
    const barAreaW = Math.max(0, width - labelW - valueW - 12)
    const totalH = Math.max(0, data.length * (barHeight + gap) - gap)
    const t = useAnim([animKey])
    const { tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } = useTooltip<HBarEntry>()
    return (
        <>
            <svg width={width} height={totalH} style={{ overflow: 'visible' }}>
                {data.map((d, i) => {
                    const yTop = i * (barHeight + gap)
                    const w = (d.value / max) * barAreaW * t
                    const color = d.color ?? COL_PRIMARY
                    const active = tooltipData?.id === d.id
                    return (
                        <g key={d.id ?? i}
                           onMouseMove={() => showTooltip({ tooltipData: d, tooltipLeft: labelW + w, tooltipTop: yTop })}
                           onMouseLeave={hideTooltip} style={{ cursor: 'default' }}>
                            <rect x="0" y={yTop} width={width} height={barHeight} fill="transparent" />
                            <text x="0" y={yTop + barHeight / 2 + 3} fontSize="11" fontWeight="700" fill={C_FG} fontFamily="Lexend">
                                {(d.label ?? '').length > 22 ? (d.label ?? '').slice(0, 21) + '…' : (d.label ?? '')}
                            </text>
                            <rect x={labelW} y={yTop + 4} width={barAreaW} height={barHeight - 8} rx="3" fill={C_MUTED} />
                            <rect x={labelW} y={yTop + 4} width={w} height={barHeight - 8} rx="3" fill={color} opacity={active ? 1 : 0.9} />
                            <text x={width} y={yTop + barHeight / 2 + 3} textAnchor="end" fontSize="11" fontWeight="700" fill={C_FG} fontFamily={C_MONO}>
                                {fmtValue(d.value)}
                            </text>
                        </g>
                    )
                })}
            </svg>
            {tooltipData && (
                <TooltipWithBounds left={(tooltipLeft ?? 0) + 8} top={(tooltipTop ?? 0)} style={tooltipStyle}>
                    <div style={{ fontWeight: 700 }}>{tooltipData.label}</div>
                    <div style={{ fontFamily: C_MONO }}>{fmtValue(tooltipData.value)}</div>
                </TooltipWithBounds>
            )}
        </>
    )
}

// ── Donut ──────────────────────────────────────────────────────────────────────
export interface DonutSegment { pct: number; color: string; label?: string; value?: number }
interface DonutProps {
    segments: DonutSegment[]; centerLabel: string; centerSub?: string
    size?: number; strokeW?: number; animKey: string | number
    // Formatação do valor no hover. Default = moeda; passe fmtNum p/ contagens.
    fmtValue?: (v: number) => string
}

export function Donut({ segments, centerLabel, centerSub, size = 120, strokeW = 16, animKey, fmtValue = fmtBRLk }: DonutProps) {
    const r = (size - strokeW) / 2
    const c = 2 * Math.PI * r
    const t = useAnim([animKey])
    const [hover, setHover] = useState<number | null>(null)
    let acc = 0
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C_MUTED} strokeWidth={strokeW} />
                {segments.map((s, i) => {
                    const arc = (s.pct / 100) * c * t
                    const dashoffset = -((acc / 100) * c)
                    acc += s.pct
                    return (
                        <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
                                strokeWidth={hover === i ? strokeW + 3 : strokeW}
                                strokeDasharray={`${arc} ${c}`} strokeDashoffset={dashoffset}
                                style={{ cursor: 'default', transition: 'stroke-width 0.12s' }}
                                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                    )
                })}
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                {hover !== null && segments[hover].label ? (
                    <>
                        <div style={{ fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums', fontSize: 18, fontWeight: 800, color: C_FG, lineHeight: 1 }}>
                            {segments[hover].value !== undefined ? fmtValue(segments[hover].value!) : `${Math.round(segments[hover].pct)}%`}
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C_MUTED_FG, marginTop: 3 }}>
                            {segments[hover].label}
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 800, color: C_FG, letterSpacing: '-0.03em', lineHeight: 1 }}>{centerLabel}</div>
                        {centerSub && <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: C_MUTED_FG, marginTop: 3 }}>{centerSub}</div>}
                    </>
                )}
            </div>
        </div>
    )
}

// ── StackedTimeline (30 dias, a receber ↑ / a pagar ↓) ─────────────────────────
interface TimelineEntry { dia: number; receber: number; pagar: number }
interface StackedTimelineProps { data: TimelineEntry[]; width?: number; height?: number; animKey: string | number }

export function StackedTimeline({ height = 140, ...props }: StackedTimelineProps) {
    return <Responsive height={height}>{(width) => <StackedTimelineSvg {...props} width={width} height={height} />}</Responsive>
}

function StackedTimelineSvg({ data, width, height = 140, animKey }: StackedTimelineProps & { width: number }) {
    const padL = 4, padR = 4, padT = 12, padB = 22
    const innerW = width - padL - padR, innerH = height - padT - padB
    const max = Math.max(...data.flatMap(d => [d.receber, d.pagar]), 1)
    const n = data.length
    const slot = innerW / n
    const barW = Math.max(2, slot * 0.42)
    const t = useAnim([animKey])
    const midY = padT + innerH / 2
    const { tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } = useTooltip<TimelineEntry>()
    return (
        <>
            <svg width={width} height={height} style={{ overflow: 'visible' }}>
                <line x1={padL} y1={midY} x2={width - padR} y2={midY} stroke={C_BORDER} />
                {data.map((d, i) => {
                    const xc = padL + slot * (i + 0.5)
                    const hR = ((d.receber / max) * (innerH / 2)) * t
                    const hP = ((d.pagar / max) * (innerH / 2)) * t
                    return (
                        <g key={d.dia}
                           onMouseMove={() => showTooltip({ tooltipData: d, tooltipLeft: xc, tooltipTop: midY })}
                           onMouseLeave={hideTooltip}>
                            <rect x={xc - slot / 2} y={padT} width={slot} height={innerH} fill="transparent" />
                            <rect x={xc - barW - 1} y={midY - hR} width={barW} height={hR} rx="1.5" fill={COL_PRIMARY} />
                            <rect x={xc + 1} y={midY} width={barW} height={hP} rx="1.5" fill={COL_DESTRUCT} opacity="0.75" />
                        </g>
                    )
                })}
                {[1, 8, 15, 22, 30].map(d => (
                    <text key={d} x={padL + slot * (d - 0.5)} y={height - 6} textAnchor="middle" fontSize="9" fontWeight="600" fill={C_MUTED_FG} fontFamily={C_MONO}>d{d}</text>
                ))}
                <text x={padL + 2} y={padT + 8} fontSize="8" fontWeight="800" fill={COL_PRIMARY} fontFamily="Lexend">↑ A RECEBER</text>
                <text x={padL + 2} y={height - padB + 14} fontSize="8" fontWeight="800" fill={COL_DESTRUCT} fontFamily="Lexend">↓ A PAGAR</text>
            </svg>
            {tooltipData && (
                <TooltipWithBounds left={(tooltipLeft ?? 0) + 8} top={(tooltipTop ?? 0) - 24} style={tooltipStyle}>
                    <div style={{ fontWeight: 700 }}>Dia {tooltipData.dia}</div>
                    <div style={{ color: COL_PRIMARY, fontFamily: C_MONO }}>↑ {fmtBRL(tooltipData.receber)}</div>
                    <div style={{ color: COL_DESTRUCT, fontFamily: C_MONO }}>↓ {fmtBRL(tooltipData.pagar)}</div>
                </TooltipWithBounds>
            )}
        </>
    )
}

// ── StackedArea (semanal: online sobre direto) ─────────────────────────────────
export interface WeekEntry { sem: string; online: number; direto: number }
interface StackedAreaProps { weeks: WeekEntry[]; width?: number; height?: number; animKey: string | number }

export function StackedArea({ height = 150, ...props }: StackedAreaProps) {
    return <Responsive height={height}>{(width) => <StackedAreaSvg {...props} width={width} height={height} />}</Responsive>
}

function StackedAreaSvg({ weeks, width, height = 150, animKey }: StackedAreaProps & { width: number }) {
    const svgRef = useRef<SVGSVGElement>(null)
    const padL = 8, padR = 8, padT = 16, padB = 22
    const n = weeks.length
    const max = Math.max(...weeks.map(w => w.online + w.direto), 1) * 1.12
    const x = scaleLinear({ domain: [0, Math.max(1, n - 1)], range: [padL, width - padR] })
    const y = scaleLinear({ domain: [0, max], range: [height - padB, padT] })
    const t = useAnim([animKey])
    const { tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } = useTooltip<{ i: number }>()
    const gid = `sa-${animKey}`
    const diretoOf = (w: WeekEntry) => w.direto
    const totalOf = (w: WeekEntry) => w.direto + w.online

    const onMove = (e: React.MouseEvent) => {
        const rect = svgRef.current?.getBoundingClientRect()
        if (!rect) return
        const i = clamp(Math.round(x.invert(e.clientX - rect.left)), 0, n - 1)
        showTooltip({ tooltipData: { i }, tooltipLeft: x(i), tooltipTop: y(totalOf(weeks[i])) })
    }

    return (
        <>
            <svg ref={svgRef} width={width} height={height} style={{ overflow: 'visible' }}>
                <LinearGradient id={`${gid}-on`} from={COL_PRIMARY} to={COL_PRIMARY} fromOpacity={0.5} toOpacity={0.12} />
                <LinearGradient id={`${gid}-di`} from="#10b981" to="#10b981" fromOpacity={0.55} toOpacity={0.18} />
                <defs><clipPath id={`clip-${gid}`}><rect x={padL} y={padT} width={(width - padL - padR) * t} height={height - padT - padB} /></clipPath></defs>
                <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke={C_BORDER} />
                <g clipPath={`url(#clip-${gid})`}>
                    <AreaClosed data={weeks} x={(_d, i) => x(i)} y={(w) => y(totalOf(w))} yScale={y} curve={curveMonotoneX} fill={`url(#${gid}-on)`} />
                    <AreaClosed data={weeks} x={(_d, i) => x(i)} y={(w) => y(diretoOf(w))} yScale={y} curve={curveMonotoneX} fill={`url(#${gid}-di)`} />
                    <LinePath data={weeks} x={(_d, i) => x(i)} y={(w) => y(totalOf(w))} curve={curveMonotoneX} stroke={COL_PRIMARY} strokeWidth={2.2} />
                    <LinePath data={weeks} x={(_d, i) => x(i)} y={(w) => y(diretoOf(w))} curve={curveMonotoneX} stroke="#10b981" strokeWidth={1.8} />
                </g>
                {weeks.map((w, i) => (
                    <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="9"
                          fontWeight={i === (tooltipData?.i ?? n - 1) ? '800' : '600'}
                          fill={i === (tooltipData?.i ?? n - 1) ? C_FG : C_MUTED_FG} fontFamily={C_MONO}>{w.sem}</text>
                ))}
                {tooltipData && (
                    <>
                        <Line from={{ x: tooltipLeft ?? 0, y: padT }} to={{ x: tooltipLeft ?? 0, y: height - padB }} stroke={C_MUTED_FG} strokeWidth={1} strokeDasharray="3 3" />
                        <circle cx={tooltipLeft} cy={tooltipTop} r={4} fill={C_CARD} stroke={COL_PRIMARY} strokeWidth={2} />
                    </>
                )}
                <rect x={padL} y={padT} width={Math.max(0, width - padL - padR)} height={height - padT - padB}
                      fill="transparent" onMouseMove={onMove} onMouseLeave={hideTooltip} />
            </svg>
            {tooltipData && (
                <TooltipWithBounds left={(tooltipLeft ?? 0) + 8} top={(tooltipTop ?? 0) - 8} style={tooltipStyle}>
                    <div style={{ fontWeight: 700 }}>Semana {weeks[tooltipData.i].sem}</div>
                    <div style={{ color: COL_PRIMARY, fontFamily: C_MONO }}>online: {fmtNum(weeks[tooltipData.i].online)}</div>
                    <div style={{ color: '#10b981', fontFamily: C_MONO }}>direto: {fmtNum(weeks[tooltipData.i].direto)}</div>
                </TooltipWithBounds>
            )}
        </>
    )
}

// fmt helpers reexportados p/ os charts (evita import circular com RelatoriosUI)
function fmtBRL(n: number) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR') }
function fmtBRLk(n: number) { return n >= 1000 ? 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : 'R$ ' + Math.round(n) }
function fmtNum(n: number) { return Math.round(n).toLocaleString('pt-BR') }
