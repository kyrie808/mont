import { User, Store, Calendar, MessageCircle, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatRelativeDate } from '@mont/shared'
import type { DomainContato } from '../../types/domain'
import { cn } from '@mont/shared'

interface ContatoCardProps {
    contato: DomainContato
    onClick?: () => void
    nomeIndicador?: string | null
    nivelEmoji?: string
}

export function ContatoCard({ contato, onClick }: ContatoCardProps) {
    const navigate = useNavigate()

    const handleClick = () => {
        if (onClick) {
            onClick()
        } else {
            navigate(`/contatos/${contato.id}`)
        }
    }

    const handleWhatsappClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        const phone = contato.telefone.replace(/\D/g, '')
        window.open(`https://wa.me/55${phone}`, '_blank')
    }



    // Status Colors/Styles
    const statusConfig = {
        cliente: {
            badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
            dot: "bg-emerald-500",
            label: "Cliente"
        },
        lead: {
            badge: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20",
            dot: "bg-orange-500",
            label: "Lead"
        },
        inativo: {
            badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/10 dark:text-zinc-400 border-zinc-200 dark:border-zinc-500/20",
            dot: "bg-zinc-500",
            label: "Inativo"
        }
    }

    const currentStatus = statusConfig[contato.status as keyof typeof statusConfig] || statusConfig.cliente
    const relativeDate = formatRelativeDate(contato.criadoEm)
    const TipoIcon = contato.tipo === 'B2B' ? Store : User

    return (
        <div
            onClick={handleClick}
            className="group relative flex flex-col gap-4 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-gray-50 dark:hover:bg-zinc-800/80 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
        >
            {/* Left Accent Border (Status Color) */}
            <div className={cn("absolute left-0 top-4 bottom-4 w-1 rounded-r-full opacity-80", currentStatus.dot)} />

            {/* Header: Name & Status Badge */}
            <div className="flex items-start justify-between pl-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                            {contato.nome}
                            {contato.apelido && <span className="text-muted-foreground font-medium text-sm ml-2">● ({contato.apelido})</span>}
                        </h3>
                    </div>

                    {/* Phone Number */}
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                        <Phone className="size-3.5" />
                        <span className="text-sm font-medium">{contato.telefone}</span>
                    </div>
                </div>

                {/* Status Pill Badge */}
                <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize tracking-wide",
                    currentStatus.badge
                )}>
                    {currentStatus.label}
                </span>
            </div>

            {/* Main Details Badges (Human/Date/Type) */}
            <div className="flex items-center gap-2 pl-3 flex-wrap">
                {/* Person Type Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                    <TipoIcon className="size-3.5 text-slate-600 dark:text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                        {contato.tipo}
                    </span>
                </div>

                {/* Date Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                    <Calendar className="size-3.5 text-slate-600 dark:text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                        {relativeDate.toUpperCase()}
                    </span>
                </div>
            </div>

            {/* Action Footer */}
            <div className="flex items-center gap-3 pl-3 mt-1 pt-3 border-t border-gray-100 dark:border-zinc-800">
                <button
                    className="flex-1 h-9 rounded-lg bg-gray-900 dark:bg-zinc-700 hover:bg-gray-800 dark:hover:bg-zinc-600 text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                    Ver Detalhes
                </button>

                <button
                    onClick={handleWhatsappClick}
                    className="size-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center transition-colors"
                >
                    <MessageCircle className="size-4" />
                </button>
            </div>
        </div>
    )
}
