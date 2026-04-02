import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Bell,
    AlertCircle,
    Clock,
    CheckCircle,
    MessageCircle,
    ChevronRight,
    Filter,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, Badge, EmptyState, LoadingScreen, Button, Modal, ModalActions } from '../components/ui'
import { useRecompra, type ContatoRecompra, type StatusRecompra } from '../hooks/useRecompra'
import { useConfiguracoes } from '../hooks/useConfiguracoes'
import { useToast } from '../components/ui/Toast'
import { formatDate, getWhatsAppLink } from '@mont/shared'
import { CONTATO_TIPO_LABELS } from '../constants'

type FilterStatus = 'todos' | StatusRecompra

export function Recompra() {
    const navigate = useNavigate()
    const toast = useToast()
    const { contatos, loading, error, atrasados, proximos, emDia, marcarComoContatado } = useRecompra()
    const { config } = useConfiguracoes()

    const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos')
    const [showFilterModal, setShowFilterModal] = useState(false)
    const [contactingId, setContactingId] = useState<string | null>(null)

    // Filter contatos
    const contatosFiltrados = filterStatus === 'todos'
        ? contatos
        : contatos.filter((c) => c.status === filterStatus)

    // Send WhatsApp with template message
    const handleWhatsApp = (item: ContatoRecompra) => {
        // Replace variables in template
        const mensagem = config.mensagemRecompra
            .replace(/\{\{nome\}\}/g, item.contato.nome)
            .replace(/\{\{dias\}\}/g, item.diasSemCompra.toString())

        window.open(getWhatsAppLink(item.contato.telefone, mensagem), '_blank')
    }

    // Mark as contacted
    const handleMarcarContatado = async (contatoId: string) => {
        setContactingId(contatoId)
        const success = await marcarComoContatado(contatoId)
        setContactingId(null)

        if (success) {
            toast.success('Contato atualizado!')
        } else {
            toast.error('Erro ao atualizar')
        }
    }

    // Status config
    const getStatusConfig = (status: StatusRecompra) => {
        switch (status) {
            case 'atrasado':
                return {
                    icon: AlertCircle,
                    color: 'text-danger-500',
                    bg: 'bg-danger-50',
                    badge: 'danger' as const,
                    label: 'Atrasado',
                }
            case 'proximo':
                return {
                    icon: Clock,
                    color: 'text-warning-500',
                    bg: 'bg-warning-50',
                    badge: 'warning' as const,
                    label: 'Próximo',
                }
            default:
                return {
                    icon: CheckCircle,
                    color: 'text-success-500',
                    bg: 'bg-success-50',
                    badge: 'success' as const,
                    label: 'Em dia',
                }
        }
    }

    return (
        <>
            <Header
                    title="Recompra"
                    showBack
                    centerTitle
                    rightAction={
                        <button
                            onClick={() => setShowFilterModal(true)}
                            className={`p-2 rounded-lg transition-colors ${filterStatus !== 'todos' ? 'bg-white/20' : 'hover:bg-white/10'
                                }`}
                        >
                            <Filter className="h-5 w-5" />
                        </button>
                    }
                />
                <PageContainer className="pt-0 pb-24 bg-transparent px-4">
                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <button
                            onClick={() => setFilterStatus(filterStatus === 'atrasado' ? 'todos' : 'atrasado')}
                            className={`p-3 rounded-xl text-center transition-colors active:scale-95 bg-red-100 dark:bg-red-900/30 ${filterStatus === 'atrasado' ? 'ring-2 ring-danger-500' : ''
                                }`}
                        >
                            <AlertCircle className="h-5 w-5 mx-auto mb-1 text-danger-500" />
                            <p className="text-2xl font-bold text-danger-600">{atrasados}</p>
                            <p className="text-xs text-danger-600">Atrasados</p>
                        </button>
                        <button
                            onClick={() => setFilterStatus(filterStatus === 'proximo' ? 'todos' : 'proximo')}
                            className={`p-3 rounded-xl text-center transition-colors active:scale-95 bg-yellow-100 dark:bg-yellow-900/30 ${filterStatus === 'proximo' ? 'ring-2 ring-warning-500' : ''
                                }`}
                        >
                            <Clock className="h-5 w-5 mx-auto mb-1 text-warning-500" />
                            <p className="text-2xl font-bold text-warning-600">{proximos}</p>
                            <p className="text-xs text-warning-600">Próximos</p>
                        </button>
                        <button
                            onClick={() => setFilterStatus(filterStatus === 'ok' ? 'todos' : 'ok')}
                            className={`p-3 rounded-xl text-center transition-colors active:scale-95 bg-emerald-100 dark:bg-emerald-900/30 ${filterStatus === 'ok' ? 'ring-2 ring-success-500' : ''
                                }`}
                        >
                            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-success-500" />
                            <p className="text-2xl font-bold text-success-600">{emDia}</p>
                            <p className="text-xs text-success-600">Em dia</p>
                        </button>
                    </div>

                    {/* Active filter indicator */}
                    {filterStatus !== 'todos' && (
                        <div className="flex items-center justify-between bg-gray-100 rounded-lg px-3 py-2 mb-4">
                            <span className="text-sm text-gray-600">
                                Filtrado por: <strong>{getStatusConfig(filterStatus).label}</strong>
                            </span>
                            <button
                                onClick={() => setFilterStatus('todos')}
                                className="text-sm text-primary-500 font-medium"
                            >
                                Limpar
                            </button>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && <LoadingScreen message="Carregando alertas..." />}

                    {/* Error */}
                    {error && (
                        <div className="bg-danger-50 text-danger-600 p-4 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !error && contatosFiltrados.length === 0 && (
                        <EmptyState
                            icon={<Bell className="h-12 w-12" />}
                            title={filterStatus !== 'todos' ? 'Nenhum contato nesse status' : 'Sem alertas de recompra'}
                            description={
                                filterStatus !== 'todos'
                                    ? 'Tente remover o filtro'
                                    : 'Quando clientes passarem do ciclo de recompra, aparecerão aqui'
                            }
                        />
                    )}

                    {/* Contacts List */}
                    {!loading && !error && contatosFiltrados.length > 0 && (
                        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                            {contatosFiltrados.map((item) => {
                                const statusConfig = getStatusConfig(item.status)
                                const StatusIcon = statusConfig.icon
                                const isContacting = contactingId === item.contato.id

                                return (
                                    <Card key={item.contato.id} className="overflow-hidden">
                                        <div className="flex items-start gap-3">
                                            {/* Status Icon */}
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusConfig.bg}`}>
                                                <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-medium text-gray-900 truncate">
                                                        {item.contato.nome}
                                                    </h4>
                                                    <Badge variant={statusConfig.badge} className="text-xs">
                                                        {item.diasSemCompra}d
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-gray-500">
                                                    {CONTATO_TIPO_LABELS[item.contato.tipo]} • Ciclo: {item.ciclo} dias
                                                </p>
                                                {item.ultimaCompra && (
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        Última compra: {formatDate(item.ultimaCompra.toISOString())}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                className="flex-1"
                                                leftIcon={<MessageCircle className="h-4 w-4" />}
                                                onClick={() => handleWhatsApp(item)}
                                            >
                                                WhatsApp
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="flex-1"
                                                leftIcon={<CheckCircle className="h-4 w-4" />}
                                                onClick={() => handleMarcarContatado(item.contato.id)}
                                                isLoading={isContacting}
                                            >
                                                Contatado
                                            </Button>
                                            <button
                                                onClick={() => navigate(`/contatos/${item.contato.id}`)}
                                                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600"
                                            >
                                                <ChevronRight className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    )}

                    {/* Filter Modal */}
                    <Modal
                        isOpen={showFilterModal}
                        onClose={() => setShowFilterModal(false)}
                        title="Filtrar por Status"
                        size="sm"
                    >
                        <div className="space-y-2">
                            {(['todos', 'atrasado', 'proximo', 'ok'] as FilterStatus[]).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => {
                                        setFilterStatus(status)
                                        setShowFilterModal(false)
                                    }}
                                    className={`w-full p-3 rounded-lg text-left flex items-center gap-3 transition-colors ${filterStatus === status
                                        ? 'bg-primary-50 border-2 border-primary-500'
                                        : 'bg-gray-50 hover:bg-gray-100'
                                        }`}
                                >
                                    {status === 'todos' ? (
                                        <Bell className="h-5 w-5 text-gray-500" />
                                    ) : (
                                        (() => {
                                            const cfg = getStatusConfig(status)
                                            const Icon = cfg.icon
                                            return <Icon className={`h-5 w-5 ${cfg.color}`} />
                                        })()
                                    )}
                                    <span className="font-medium">
                                        {status === 'todos' ? 'Todos' : getStatusConfig(status).label}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <ModalActions>
                            <Button variant="secondary" onClick={() => setShowFilterModal(false)}>
                                Fechar
                            </Button>
                        </ModalActions>
                    </Modal>
                </PageContainer>
        </>
    )
}
