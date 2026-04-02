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
    const glassPanel = "bg-white/80 dark:bg-white/5 backdrop-blur-md border border-gray-100 dark:border-border"

    const handleWA = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!contato) return
        window.open(`https://wa.me/55${contato.telefone.replace(/\D/g, '')}`, '_blank')
    }

    return (
        <div
            onClick={() => contato && navigate(`/contatos/${contato.id}`)}
            className={`${glassPanel} rounded-xl p-5 flex items-center justify-between shadow-sm mb-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/10 transition-colors`}
        >
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center border border-gray-200 dark:border-border overflow-hidden">
                    <User className="h-6 w-6 text-gray-600 dark:text-white dark:opacity-80" />
                </div>
                <div className="flex flex-col">
                    <h3 className="text-gray-900 dark:text-white font-medium text-base">{contato?.nome || 'Cliente não identificado'}</h3>
                    <p className="text-xs text-gray-500 truncate max-w-[140px]">{contato?.telefone}</p>
                </div>
            </div>
            <Button
                onClick={handleWA}
                className="relative group flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-primary/20 border border-green-200 dark:border-primary/50 text-green-600 dark:text-primary hover:bg-green-500 dark:hover:bg-primary hover:text-white dark:hover:text-black transition-all duration-300 p-0"
            >
                <MessageCircle className="h-5 w-5 relative z-10" />
            </Button>
        </div>
    )
}
