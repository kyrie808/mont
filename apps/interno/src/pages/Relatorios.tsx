import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { TabFinanceiro } from '../components/relatorios/TabFinanceiro'
import { TabClientes } from '../components/relatorios/TabClientes'
import { TabProdutos } from '../components/relatorios/TabProdutos'
import { TabMarketing } from '../components/relatorios/TabMarketing'
import { C_FG, C_MUTED_FG, C_MUTED } from '../components/relatorios/Charts'
import { MES_ABBREV } from '../components/relatorios/RelatoriosUI'
import type { PeriodoRel } from '../services/relatorioService'

type TabId = 'financeiro' | 'clientes' | 'produtos' | 'marketing'

const TABS: { id: TabId; label: string }[] = [
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'clientes',   label: 'Clientes'   },
    { id: 'produtos',   label: 'Produtos'   },
    { id: 'marketing',  label: 'Marketing'  },
]

const HOJE = new Date()
const ANO_ATUAL = HOJE.getFullYear()
const MES_ATUAL = HOJE.getMonth() + 1

export function Relatorios() {
    const [tab,     setTab]     = useState<TabId>('financeiro')
    const [periodo, setPeriodo] = useState<PeriodoRel>({ tipo: 'mes', ano: ANO_ATUAL, mes: MES_ATUAL })
    const [animKey, setAnimKey] = useState(0)

    const bump = () => setAnimKey(k => k + 1)

    function handleTab(t: TabId) {
        if (t === tab) return
        setTab(t)
        bump()
    }

    // Não deixa navegar para o futuro (mês corrente é o último com dado).
    const noFuturo = periodo.tipo === 'mes' && periodo.ano === ANO_ATUAL && periodo.mes === MES_ATUAL

    function stepMes(delta: number) {
        if (periodo.tipo !== 'mes') return
        if (delta > 0 && noFuturo) return
        const d = new Date(periodo.ano, periodo.mes - 1 + delta, 1)
        setPeriodo({ tipo: 'mes', ano: d.getFullYear(), mes: d.getMonth() + 1 })
        bump()
    }

    function setModoMes() {
        setPeriodo({ tipo: 'mes', ano: ANO_ATUAL, mes: MES_ATUAL })
        bump()
    }

    function setModoGeral() {
        setPeriodo({ tipo: 'geral' })
        bump()
    }

    const tabIdx = TABS.findIndex(t => t.id === tab)
    const periodoKey = periodo.tipo === 'geral' ? 'geral' : `${periodo.ano}-${periodo.mes}`
    const childAnimKey = `${periodoKey}-${animKey}`

    const pillBase: React.CSSProperties = {
        padding: '5px 12px', borderRadius: 999, border: 'none',
        fontFamily: 'Lexend', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.04em', cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
    }
    const stepBtn: React.CSSProperties = {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 999, border: 'none',
        background: C_MUTED, color: C_FG, cursor: 'pointer',
    }

    return (
        <>
            <Header title="Relatórios" showBack />
            <PageContainer className="pt-0 pb-24 bg-transparent">

                {/* Período: Mês (com navegação) ou Geral — vale para as 4 abas */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', flexWrap: 'wrap' }}>
                    <button
                        onClick={setModoMes}
                        style={{ ...pillBase,
                            background: periodo.tipo === 'mes' ? C_FG : C_MUTED,
                            color: periodo.tipo === 'mes' ? 'hsl(var(--background))' : C_MUTED_FG }}
                    >Mês</button>
                    <button
                        onClick={setModoGeral}
                        style={{ ...pillBase,
                            background: periodo.tipo === 'geral' ? C_FG : C_MUTED,
                            color: periodo.tipo === 'geral' ? 'hsl(var(--background))' : C_MUTED_FG }}
                    >Geral</button>

                    {periodo.tipo === 'mes' && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 2 }}>
                            <button style={stepBtn} onClick={() => stepMes(-1)} aria-label="Mês anterior">
                                <ChevronLeft size={15} strokeWidth={2.4} />
                            </button>
                            <span style={{
                                minWidth: 78, textAlign: 'center',
                                fontFamily: 'Lexend', fontSize: 12, fontWeight: 800, color: C_FG,
                                textTransform: 'capitalize',
                            }}>{MES_ABBREV[periodo.mes - 1]}/{periodo.ano}</span>
                            <button style={{ ...stepBtn, opacity: noFuturo ? 0.4 : 1, cursor: noFuturo ? 'not-allowed' : 'pointer' }}
                                    onClick={() => stepMes(1)} aria-label="Próximo mês">
                                <ChevronRight size={15} strokeWidth={2.4} />
                            </button>
                        </div>
                    )}
                </div>

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
                    {tab === 'financeiro' && <TabFinanceiro periodo={periodo} animKey={childAnimKey} />}
                    {tab === 'clientes'   && <TabClientes   periodo={periodo} animKey={childAnimKey} />}
                    {tab === 'produtos'   && <TabProdutos   periodo={periodo} animKey={childAnimKey} />}
                    {tab === 'marketing'  && <TabMarketing  periodo={periodo} animKey={childAnimKey} />}
                </div>
            </PageContainer>
        </>
    )
}
