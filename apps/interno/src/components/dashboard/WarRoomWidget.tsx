import { useNavigate } from 'react-router-dom'
import { AlertTriangle, MessageCircle, Banknote, Eye } from 'lucide-react'
import { formatCurrency, formatRelativeDate, formatPhone } from '@mont/shared'
import { TacticalActionCard } from './TacticalActionCard'

interface WarRoomWidgetProps {
    overdueAlert: {
        nome: string
        valorDevido: number
        diasAtraso: number
        ultimaCompra: string
        telefone: string
    } | null
    recompraAlert: {
        id: string
        nome: string
        diasSemComprar: number
    } | null
}

export function WarRoomWidget({ overdueAlert, recompraAlert }: WarRoomWidgetProps) {
    const navigate = useNavigate()

    const handleWhatsApp = (telefone: string, nome: string, valor: number) => {
        const message = `Olá ${nome}, tudo bem? Estou entrando em contato referente ao valor de ${formatCurrency(valor)} que está em aberto.`
        const url = `https://wa.me/55${formatPhone(telefone).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="size-2 rounded-full bg-semantic-red animate-pulse"></span>
                    War Room (Ação Necessária)
                </h2>
                <span
                    className="text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-primary"
                    onClick={() => navigate('/vendas?status=atrasado')}
                >
                    Ver Tudo
                </span>
            </div>

            {/* Overdue Card */}
            {overdueAlert ? (
                <TacticalActionCard
                    variant="danger"
                    title={overdueAlert.nome}
                    value={formatCurrency(overdueAlert.valorDevido)}
                    statusLabel={`${overdueAlert.diasAtraso} Dias de Atraso`}
                    statusIcon={AlertTriangle}
                    footerLabel={`Última Compra: ${formatRelativeDate(overdueAlert.ultimaCompra)}`}
                    actionLabel="Cobrar"
                    actionIcon={MessageCircle}
                    onAction={() => handleWhatsApp(overdueAlert.telefone, overdueAlert.nome, overdueAlert.valorDevido)}
                />
            ) : (
                <div className="rounded-xl bg-card p-6 text-center shadow-sm opacity-60">
                    <p className="text-sm text-gray-500">Nenhum pagamento atrasado. Ótimo trabalho!</p>
                </div>
            )}

            {/* Reorder Card */}
            {recompraAlert ? (
                <TacticalActionCard
                    variant="warning"
                    title={recompraAlert.nome}
                    value={`${recompraAlert.diasSemComprar}d`}
                    subValue="Inativo"
                    statusLabel="Recompra Disponível"
                    statusIcon={Banknote}
                    footerLabel="Verificar estoque"
                    actionLabel="Detalhes"
                    actionIcon={Eye}
                    onAction={() => navigate(`/clientes/${recompraAlert.id}`)}
                />
            ) : null}
        </div>
    )
}
