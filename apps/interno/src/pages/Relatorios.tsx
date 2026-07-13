import { useState } from 'react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { TabFinanceiro } from '../components/relatorios/TabFinanceiro'
import { TabClientes } from '../components/relatorios/TabClientes'
import { TabProdutos } from '../components/relatorios/TabProdutos'
import { TabMarketing } from '../components/relatorios/TabMarketing'
import { C_FG, C_MUTED_FG, C_MUTED } from '../components/relatorios/Charts'

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
    const [tab,     setTab]     = useState<TabId>('financeiro')
    const [period,  setPeriod]  = useState<PeriodId>('30d')
    const [animKey, setAnimKey] = useState(0)

    function handleTab(t: TabId) {
        if (t === tab) return
        setTab(t)
        setAnimKey(k => k + 1)
    }

    function handlePeriod(p: PeriodId) {
        if (p === period || p !== '30d') return
        setPeriod(p)
        setAnimKey(k => k + 1)
    }

    const tabIdx = TABS.findIndex(t => t.id === tab)

    return (
        <>
            <Header title="Relatórios" showBack />
            <PageContainer className="pt-0 pb-24 bg-transparent">

                {/* Seletor de período — só pras abas com dado temporal */}
                {(tab === 'financeiro' || tab === 'marketing') && (
                    <div style={{ display: 'flex', gap: 6, padding: '10px 0' }}>
                        {PERIODS.map(p => {
                            const active = period === p.id
                            return (
                                <button
                                    key={p.id}
                                    disabled={p.id !== '30d'}
                                    onClick={() => handlePeriod(p.id)}
                                    style={{
                                        padding: '5px 12px', borderRadius: 999, border: 'none',
                                        fontFamily: 'Lexend', fontSize: 11, fontWeight: 700,
                                        letterSpacing: '0.04em',
                                        cursor: p.id !== '30d' ? 'not-allowed' : 'pointer',
                                        background: active ? C_FG : C_MUTED,
                                        color:      active ? 'hsl(var(--background))' : C_MUTED_FG,
                                        opacity:    p.id !== '30d' ? 0.4 : 1,
                                        transition: 'background 0.15s, color 0.15s',
                                    }}
                                >
                                    {p.label}
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Abas */}
                <div style={{ position: 'relative', display: 'flex', borderBottom: '1px solid hsl(var(--border))' }}>
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
                        left:  `calc(${tabIdx} * 100% / ${TABS.length})`,
                        width: `calc(100% / ${TABS.length})`,
                        height: 2, borderRadius: 999, background: C_FG,
                        transition: 'left 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
                    }} />
                </div>

                {/* Conteúdo */}
                <div style={{ paddingTop: 16 }}>
                    {tab === 'financeiro' && <TabFinanceiro animKey={`${period}-${animKey}`} />}
                    {tab === 'clientes'   && <TabClientes   animKey={`${period}-${animKey}`} />}
                    {tab === 'produtos'   && <TabProdutos   animKey={`${period}-${animKey}`} />}
                    {tab === 'marketing'  && <TabMarketing  animKey={`${period}-${animKey}`} />}
                </div>
            </PageContainer>
        </>
    )
}
