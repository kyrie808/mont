import { useMemo, useState } from 'react'
import { hojeBrasilia } from '@mont/shared'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useAgendaAtrasados, useAgendaItens, useAgendaSemData } from '../hooks/useAgenda'
import {
    chipsPorDia, gradeDoMes, intervaloDaGrade, lerCamadas, mesDoDia, salvarCamadas, somarMeses,
    type Camada, type CamadasLigadas,
} from '../utils/agenda'
import { AgendaCabecalho } from '../components/features/agenda/AgendaCabecalho'
import { AgendaLateral } from '../components/features/agenda/AgendaLateral'
import { FaixaAtrasados } from '../components/features/agenda/FaixaAtrasados'
import { GradeMes } from '../components/features/agenda/GradeMes'
import { CriacaoRapida, type PrefillLembrete } from '../components/features/agenda/CriacaoRapida'
import { AgendaMobileLista } from '../components/features/agenda/AgendaMobileLista'

/** localStorage pode não existir ou estar bloqueado (aba privada): sem ele, a escolha vale só na visita. */
function armazenamento(): Storage | null {
    try {
        return window.localStorage
    } catch {
        return null
    }
}

/** Agenda de Retornos — visão do Mês (desktop). No celular, por enquanto, uma lista simples. */
export function Agenda() {
    const isDesktop = useIsDesktop()
    const { openDrawer } = useNavigationStore()
    const hoje = hojeBrasilia()

    if (!isDesktop) {
        return (
            <>
                <Header title="Agenda" showMenu onMenuClick={openDrawer} centerTitle />
                <PageContainer>
                    <AgendaMobileLista hoje={hoje} />
                </PageContainer>
            </>
        )
    }
    return <AgendaMes hoje={hoje} />
}

function AgendaMes({ hoje }: { hoje: string }) {
    const [mes, setMes] = useState(mesDoDia(hoje))
    const [busca, setBusca] = useState('')
    const [camadas, setCamadas] = useState<CamadasLigadas>(() => lerCamadas(armazenamento()))
    const [criacao, setCriacao] = useState<{ aberto: boolean; prefill: PrefillLembrete }>({ aberto: false, prefill: { data: hoje } })

    const semanas = useMemo(() => gradeDoMes(mes), [mes])
    const { inicio, fim } = intervaloDaGrade(mes)
    const { data: itens = [], isFetching } = useAgendaItens(inicio, fim)
    const { data: atrasados = [] } = useAgendaAtrasados()
    const { data: semData = [] } = useAgendaSemData()

    const chips = useMemo(() => chipsPorDia(itens, camadas, busca), [itens, camadas, busca])

    const alternarCamada = (c: Camada) => {
        const novas = { ...camadas, [c]: !camadas[c] }
        setCamadas(novas)
        salvarCamadas(armazenamento(), novas)
    }
    const abrirCriacao = (prefill: PrefillLembrete) => setCriacao({ aberto: true, prefill })

    return (
        <div className="flex h-dvh gap-5 px-6 pb-4">
            <div className="pt-4">
                <AgendaLateral
                    mes={mes}
                    hoje={hoje}
                    camadas={camadas}
                    onAlternarCamada={alternarCamada}
                    onIrPara={(dia) => setMes(mesDoDia(dia))}
                    onCriar={() => abrirCriacao({ data: hoje })}
                />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
                <AgendaCabecalho
                    mes={mes}
                    busca={busca}
                    onBusca={setBusca}
                    onHoje={() => setMes(mesDoDia(hoje))}
                    onAnterior={() => setMes(somarMeses(mes, -1))}
                    onProximo={() => setMes(somarMeses(mes, 1))}
                    carregando={isFetching}
                />
                <FaixaAtrasados atrasados={atrasados} semData={semData} onCriarRetorno={abrirCriacao} />
                <GradeMes semanas={semanas} chips={chips} hoje={hoje} onCriar={abrirCriacao} />
            </div>
            <CriacaoRapida aberto={criacao.aberto} prefill={criacao.prefill} onFechar={() => setCriacao((c) => ({ ...c, aberto: false }))} />
        </div>
    )
}
