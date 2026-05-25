import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui/Toast'
import { TabFinanceiro } from '../components/relatorios/TabFinanceiro'
import { TabClientes } from '../components/relatorios/TabClientes'
import { TabProdutos } from '../components/relatorios/TabProdutos'
import { TabMarketing } from '../components/relatorios/TabMarketing'
import { C_BG, C_FG, C_MUTED_FG, C_BORDER, C_MUTED } from '../components/relatorios/Charts'

type TabId     = 'financeiro' | 'clientes' | 'produtos' | 'marketing'
type PeriodId  = '30d' | '90d' | '6m' | '1a'

const TABS: { id: TabId; label: string }[] = [
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'clientes',   label: 'Clientes'   },
    { id: 'produtos',   label: 'Produtos'   },
    { id: 'marketing',  label: 'Marketing'  },
]

const PERIODS: { id: PeriodId; label: string }[] = [
    { id: '30d', label: '30d' },
    { id: '90d', label: '90d' },
    { id: '6m',  label: '6m'  },
    { id: '1a',  label: '1a'  },
]

export function Relatorios() {
    const navigate   = useNavigate()
    const toast      = useToast()
    const [tab,     setTab]     = useState<TabId>('financeiro')
    const [period,  setPeriod]  = useState<PeriodId>('30d')
    const [animKey, setAnimKey] = useState(0)

    function handleTab(t: TabId) {
        if (t === tab) return
        setTab(t)
        setAnimKey(k => k + 1)
    }

    function handlePeriod(p: PeriodId) {
        if (p === period) return
        if (p !== '30d') {
            toast.info('Disponível em breve')
            return
        }
        setPeriod(p)
        setAnimKey(k => k + 1)
    }

    const tabIdx = TABS.findIndex(t => t.id === tab)

    return (
        <div style={{ minHeight: '100dvh', background: C_BG }}>

            {/* ── STICKY COMPOUND HEADER ────────────────────────────────── */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 40,
                background: 'hsl(var(--background) / 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderBottom: `1px solid ${C_BORDER}`,
            }}>

                {/* Row 1: back + title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 16px 8px' }}>
                    <button
                        aria-label="Voltar"
                        onClick={() => navigate(-1)}
                        style={{
                            width: 36, height: 36, borderRadius: '50%',
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: C_FG, flexShrink: 0, marginLeft: -4,
                        }}
                    >
                        <ArrowLeft size={22} strokeWidth={2.4} />
                    </button>
                    <span style={{
                        fontSize: 18, fontWeight: 800, color: C_FG,
                        letterSpacing: '-0.02em', flex: 1,
                    }}>Relatórios</span>
                </div>

                {/* Row 2: period selector — only for tabs with temporal data */}
                {(tab === 'financeiro' || tab === 'marketing') && (
                    <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px' }}>
                        {PERIODS.map(p => {
                            const active = period === p.id
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => handlePeriod(p.id)}
                                    style={{
                                        padding: '5px 12px', borderRadius: 999, border: 'none',
                                        fontFamily: 'Lexend', fontSize: 11, fontWeight: 700,
                                        letterSpacing: '0.04em', cursor: 'pointer',
                                        background: active ? C_FG : C_MUTED,
                                        color:      active ? 'hsl(var(--background))' : C_MUTED_FG,
                                        opacity:    p.id !== '30d' ? 0.5 : 1,
                                        transition: 'background 0.15s, color 0.15s',
                                    }}
                                >
                                    {p.label}
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Row 3: tab bar */}
                <div style={{ position: 'relative', display: 'flex', padding: '0 16px' }}>
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => handleTab(t.id)}
                            style={{
                                flex: 1, padding: '8px 4px 10px',
                                border: 'none', background: 'transparent', cursor: 'pointer',
                                fontFamily: 'Lexend', fontSize: 12,
                                fontWeight: tab === t.id ? 800 : 600,
                                color: tab === t.id ? C_FG : C_MUTED_FG,
                                letterSpacing: '-0.01em',
                                transition: 'color 0.15s',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                    <div style={{
                        position: 'absolute', bottom: 0,
                        left:  `calc(16px + ${tabIdx} * (100% - 32px) / ${TABS.length})`,
                        width: `calc((100% - 32px) / ${TABS.length})`,
                        height: 2, borderRadius: 999, background: C_FG,
                        transition: 'left 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
                    }} />
                </div>
            </div>

            {/* ── SCROLLABLE BODY ───────────────────────────────────────── */}
            <div style={{ padding: '16px 16px 100px' }}>
                {tab === 'financeiro' && <TabFinanceiro animKey={`${period}-${animKey}`} />}
                {tab === 'clientes'   && <TabClientes   animKey={`${period}-${animKey}`} />}
                {tab === 'produtos'   && <TabProdutos   animKey={`${period}-${animKey}`} />}
                {tab === 'marketing'  && <TabMarketing  animKey={`${period}-${animKey}`} />}
            </div>

        </div>
    )
}
