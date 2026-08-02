import { User, Store, Calendar, MessageCircle, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatRelativeDate, formatPhone } from '@mont/shared'
import type { DomainContato } from '../../types/domain'
import type { SegmentoCliente } from '../../utils/segmentoCliente'
import { origemBadge } from '../../utils/origemContato'
import { temperaturaCliente, TEMPERATURA_BADGE, type RitmoCliente } from '../../utils/temperaturaCliente'
import { cn } from '@mont/shared'

interface ContatoCardProps {
    contato: DomainContato
    onClick?: () => void
    nomeIndicador?: string | null
    nivelEmoji?: string
    /** Segmento derivado do comportamento (funil). Se ausente, cai em 'cliente'. */
    segmento?: SegmentoCliente
    /** Ritmo (kanban row) p/ o termômetro. Ausente/sem ritmo → não mostra o chip. */
    ritmo?: RitmoCliente
}

export function ContatoCard({ contato, onClick, segmento, ritmo }: ContatoCardProps) {
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

    // Cores/estilos por segmento (via tokens semânticos)
    const statusConfig = {
        vip: {
            badge: "bg-primary/10 text-primary border-primary/20",
            dot: "bg-primary",
            label: "VIP"
        },
        cliente: {
            badge: "bg-success/10 text-success border-success/20",
            dot: "bg-success",
            label: "Cliente"
        },
        lead: {
            badge: "bg-warning/10 text-warning-strong border-warning/20",
            dot: "bg-warning-strong",
            label: "Lead"
        },
        inativo: {
            badge: "bg-muted text-muted-foreground border-border",
            dot: "bg-muted-foreground",
            label: "Inativo"
        },
        fornecedor: {
            badge: "bg-foreground/5 text-foreground/80 border-foreground/20",
            dot: "bg-muted-foreground",
            label: "Fornecedor"
        }
    }

    const currentStatus = statusConfig[segmento ?? 'cliente'] || statusConfig.cliente
    const relativeDate = formatRelativeDate(contato.criadoEm)
    const TipoIcon = contato.tipo === 'B2B' ? Store : User

    return (
        <div
            onClick={handleClick}
            className="group relative flex flex-col gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted transition-all duration-200 cursor-pointer shadow-card hover:shadow-elevated"
        >
            {/* Left Accent Border (Status Color) */}
            <div className={cn("absolute left-0 top-4 bottom-4 w-1 rounded-r-full opacity-80", currentStatus.dot)} />

            {/* Header: Name & Status Badge */}
            <div className="flex items-start justify-between pl-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground line-clamp-1">
                            {contato.nome}
                            {contato.apelido && <span className="text-muted-foreground font-medium text-sm ml-2">● ({contato.apelido})</span>}
                        </h3>
                    </div>

                    {/* Phone Number */}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-3.5" />
                        <span className="text-sm font-medium">{formatPhone(contato.telefone)}</span>
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
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border">
                    <TipoIcon className="size-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        {contato.tipo}
                    </span>
                </div>

                {/* Date Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        {relativeDate.toUpperCase()}
                    </span>
                </div>

                {/* Origem Badge (de onde o cliente veio) */}
                {(() => {
                    const o = origemBadge(contato.origem, contato.fonte)
                    return (
                        <span className={cn('px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide', o.cls)}>
                            {o.label}
                        </span>
                    )
                })()}

                {/* Termômetro (só quando há ritmo medível — ≥2 compras) */}
                {(() => {
                    const { estado } = temperaturaCliente(ritmo)
                    if (estado === 'novo') return null
                    const t = TEMPERATURA_BADGE[estado]
                    return (
                        <span className={cn('px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide', t.cls)}>
                            {t.label}
                        </span>
                    )
                })()}
            </div>

            {/* Action Footer */}
            <div className="flex items-center gap-3 pl-3 mt-1 pt-3 border-t border-border">
                <button
                    className="flex-1 h-9 rounded-lg bg-foreground hover:bg-foreground/90 text-background text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-card focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    Ver Detalhes
                </button>

                <button
                    aria-label="Abrir WhatsApp"
                    onClick={handleWhatsappClick}
                    className="size-9 rounded-lg bg-success/10 hover:bg-success/20 text-success border border-success/20 flex items-center justify-center transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    <MessageCircle className="size-4" />
                </button>
            </div>
        </div>
    )
}
