import { User, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { useNavigate } from 'react-router-dom'

interface VendaInfoClienteProps {
    contato?: {
        id: string
        nome: string
        telefone: string
    } | null
}

export function VendaInfoCliente({ contato }: VendaInfoClienteProps) {
    const navigate = useNavigate()
    const glassPanel = "bg-card/80 backdrop-blur-md border border-border"

    const handleWA = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!contato) return
        window.open(`https://wa.me/55${contato.telefone.replace(/\D/g, '')}`, '_blank')
    }

    return (
        <div
            onClick={() => contato && navigate(`/contatos/${contato.id}`)}
            className={`${glassPanel} rounded-xl p-5 flex items-center justify-between shadow-card mb-6 cursor-pointer hover:bg-muted transition-colors`}
        >
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border border-border overflow-hidden">
                    <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex flex-col">
                    <h3 className="text-foreground font-medium text-base">{contato?.nome || 'Cliente não identificado'}</h3>
                    <p className="text-xs text-muted-foreground truncate max-w-[140px]">{contato?.telefone}</p>
                </div>
            </div>
            <Button
                onClick={handleWA}
                aria-label="Conversar no WhatsApp"
                className="relative group flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 p-0"
            >
                <MessageCircle className="h-5 w-5 relative z-10" />
            </Button>
        </div>
    )
}
