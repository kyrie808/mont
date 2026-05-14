import { useState, useEffect, useMemo } from 'react'
import {
    Calendar,
    Package,
    Send,
    RefreshCw,
    ClipboardList,
    AlertTriangle,
    BarChart3,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, Button, PageSkeleton, Input } from '../components/ui'
import { KpiCard } from '../components/dashboard/KpiCard'
import { useRelatorioFabrica, getDefaultDates } from '../hooks/useRelatorioFabrica'
import { useToast } from '../components/ui/Toast'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../lib/supabase'

function formatDateShort(dateStr: string): string {
    try {
        return format(parseISO(dateStr), 'dd/MM', { locale: ptBR })
    } catch {
        return dateStr
    }
}

export function RelatorioFabrica() {
    const toast = useToast()
    const { relatorio, loading, error, gerarRelatorio } = useRelatorioFabrica()

    // Default dates
    const defaultDates = getDefaultDates()
    const [dataInicio, setDataInicio] = useState(defaultDates.dataInicio)
    const [dataFim, setDataFim] = useState(defaultDates.dataFim)
    const [telefoneFabrica, setTelefoneFabrica] = useState<string | null>(null)
    const [nomeFabrica, setNomeFabrica] = useState<string | null>(null)

    // Auto-generate on first load
    useEffect(() => {
        gerarRelatorio(dataInicio, dataFim)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Only on mount

    useEffect(() => {
        supabase.from('configuracoes')
            .select('valor')
            .eq('chave', 'telefone_fabrica')
            .maybeSingle()
            .then(({ data }: any) => {
                if (data?.valor && typeof data.valor === 'string') {
                    setTelefoneFabrica(data.valor)
                }
            })
        supabase.from('configuracoes')
            .select('valor')
            .eq('chave', 'nome_fabrica')
            .maybeSingle()
            .then(({ data }: any) => {
                if (data?.valor && typeof data.valor === 'string') setNomeFabrica(data.valor)
            })
    }, [])

    const handleGerar = () => {
        if (!dataInicio || !dataFim) {
            toast.error('Selecione as datas')
            return
        }
        gerarRelatorio(dataInicio, dataFim)
    }

    const handleEnviarWhatsApp = () => {
        if (!relatorio || relatorio.produtos.length === 0) {
            toast.error('Nenhum produto no relatório')
            return
        }

        // Montar mensagem formatada em português
        let mensagem = `📋 *PEDIDO ${nomeFabrica ?? 'GILMAR DISTRIBUIDOR'}*\n`
        mensagem += `Período: ${formatDateShort(relatorio.dataInicio)} - ${formatDateShort(relatorio.dataFim)}/${format(parseISO(relatorio.dataFim), 'yyyy')}\n\n`

        for (const produto of relatorio.produtos) {
            mensagem += `📦 ${produto.nome}: ${produto.quantidade} un\n`
        }

        mensagem += `─────────────────\n`
        mensagem += `Total: ${relatorio.total} unidades`

        // Abrir WhatsApp
        const cleanNumber = telefoneFabrica
            ? telefoneFabrica.replace(/\D/g, '')
            : null

        const url = cleanNumber
            ? `https://wa.me/55${cleanNumber}?text=${encodeURIComponent(mensagem)}`
            : `https://wa.me/?text=${encodeURIComponent(mensagem)}`

        if (!cleanNumber) {
            toast.warning('Configure o telefone da fábrica nas Configurações para envio direto')
        }

        window.open(url, '_blank')
    }

    // KPI calculations
    const totalSKUs = useMemo(() => relatorio?.produtos.length || 0, [relatorio])
    const totalUnidades = useMemo(() => relatorio?.total || 0, [relatorio])
    const diasPeriodo = useMemo(() => {
        if (!relatorio) return 0
        try {
            return differenceInDays(parseISO(relatorio.dataFim), parseISO(relatorio.dataInicio)) + 1
        } catch {
            return 0
        }
    }, [relatorio])

    return (
        <>
            <Header title="Relatório Fábrica" showBack centerTitle />
                <PageContainer className="pt-0 pb-24 bg-transparent px-4">
                    {/* KPI Metrics */}
                    {!loading && relatorio && relatorio.produtos.length > 0 && (
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <KpiCard
                                title="Produtos"
                                value={totalSKUs.toString()}
                                progress={100}
                                trend="SKUs"
                                trendDirection="up"
                                icon={Package}
                                progressColor="bg-violet-500"
                                trendColor="green"
                                iconColor="text-violet-600"
                                variant="compact"
                            />
                            <KpiCard
                                title="Total"
                                value={totalUnidades.toString()}
                                progress={100}
                                trend="Unid."
                                trendDirection="up"
                                icon={BarChart3}
                                progressColor="bg-emerald-500"
                                trendColor="green"
                                iconColor="text-emerald-600"
                                variant="compact"
                            />
                            <KpiCard
                                title="Período"
                                value={diasPeriodo.toString()}
                                progress={diasPeriodo > 7 ? 100 : (diasPeriodo / 7) * 100}
                                trend={diasPeriodo === 1 ? '1 dia' : `${diasPeriodo} dias`}
                                trendDirection={diasPeriodo >= 7 ? 'up' : 'down'}
                                icon={Calendar}
                                progressColor={diasPeriodo >= 7 ? 'bg-primary' : 'bg-accent'}
                                trendColor={diasPeriodo >= 7 ? 'green' : 'yellow'}
                                iconColor={diasPeriodo >= 7 ? 'text-primary' : 'text-accent'}
                                variant="compact"
                            />
                        </div>
                    )}

                    {/* Seletor de Período */}
                    <Card className="mb-6">
                        <div className="p-6">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                                    <Calendar className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Filtro de Período</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Defina o intervalo do relatório</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <Input
                                    label="Data Início"
                                    type="date"
                                    value={dataInicio}
                                    onChange={(e) => setDataInicio(e.target.value)}
                                />
                                <Input
                                    label="Data Fim"
                                    type="date"
                                    value={dataFim}
                                    onChange={(e) => setDataFim(e.target.value)}
                                />
                            </div>

                            <Button
                                variant="success"
                                className="w-full font-bold h-12 shadow-lg transition-all active:scale-[0.98]"
                                leftIcon={<RefreshCw className="h-4 w-4" />}
                                onClick={handleGerar}
                                isLoading={loading}
                            >
                                Gerar Atualização
                            </Button>
                        </div>
                    </Card>

                    {/* Loading */}
                    {loading && <PageSkeleton rows={10} showHeader showCards />}

                    {/* Error */}
                    {error && (
                        <Card className="bg-destructive/10 text-destructive mb-6 border-destructive/20">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <p className="font-medium text-sm">{error}</p>
                            </div>
                        </Card>
                    )}

                    {/* Resultado */}
                    {!loading && relatorio && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {relatorio.produtos.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Package className="h-12 w-12 text-gray-400" />
                                    </div>
                                    <h3 className="text-gray-900 dark:text-gray-100 font-semibold mb-1">Nada encontrado</h3>
                                    <p className="text-gray-500 text-sm">Nenhuma venda neste período</p>
                                </div>
                            ) : (
                                <>
                                    {/* Resumo Header */}
                                    <div className="flex items-center justify-between px-1">
                                        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Produtos Vendidos</h2>
                                        <span className="text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                                            {relatorio.produtos.length} itens
                                        </span>
                                    </div>

                                    {/* Cards por Produto */}
                                    <div className="space-y-3">
                                        {relatorio.produtos.map((produto) => (
                                            <Card key={produto.produtoId} className="transition-all hover:shadow-md border-l-4 border-l-primary hover:bg-primary/5 dark:hover:bg-primary/10">
                                                <div className="p-4 flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center shrink-0">
                                                        <Package className="h-6 w-6 text-muted-foreground" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">{produto.nome}</h3>
                                                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">#{produto.codigo}</div>
                                                    </div>
                                                    <div className="text-right shrink-0 bg-muted px-3 py-2 rounded-lg">
                                                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{produto.quantidade}</p>
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wide">unid</p>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>

                                    {/* Card de Resumo Total */}
                                    {/* Gradiente intencional: identidade visual do card de resumo — não substituir por tokens semânticos */}
                                    <div className="mt-8 relative overflow-hidden rounded-2xl shadow-xl shadow-indigo-500/20">
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-700"></div>
                                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                                        <div className="relative p-6 text-white">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 opacity-90">
                                                    <ClipboardList className="h-5 w-5" />
                                                    <span className="text-sm font-semibold tracking-wide">RESUMO TOTAL</span>
                                                </div>
                                                <div className="text-xs bg-white/20 px-2 py-1 rounded backdrop-blur-sm">
                                                    {formatDateShort(relatorio.dataInicio)} - {formatDateShort(relatorio.dataFim)}
                                                </div>
                                            </div>

                                            <div className="flex items-end justify-between mt-4">
                                                <div>
                                                    <p className="text-indigo-100 text-sm mb-1">Total de Peças</p>
                                                    <p className="text-4xl font-extrabold tracking-tight">{relatorio.total}</p>
                                                </div>
                                                <div className="mb-1">
                                                    <p className="text-xs text-indigo-200">unidades produzidas</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botão Enviar WhatsApp */}
                                    <Button
                                        variant="success"
                                        className="w-full font-bold h-12 mt-4 border-b-4 border-primary/80 active:border-b-0 active:translate-y-1 transition-all"
                                        leftIcon={<Send className="h-4 w-4" />}
                                        onClick={handleEnviarWhatsApp}
                                    >
                                        Enviar Relatório no WhatsApp
                                    </Button>

                                    <div className="h-6"></div>
                                </>
                            )}
                        </div>
                    )}
                </PageContainer>
        </>
    )
}
