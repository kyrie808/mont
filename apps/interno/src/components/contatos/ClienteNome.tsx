import { Link } from 'react-router-dom'
import { Link as LinkIcon } from 'lucide-react'

interface ClienteNomeProps {
    contato: {
        nome: string
        origem: string
        indicado_por_id?: string | null
        indicador?: {
            id: string
            nome: string
        } | null
    }
    className?: string
}

export function ClienteNome({ contato, className = '' }: ClienteNomeProps) {
    const hasIndicador = contato.origem === 'indicacao' && contato.indicador

    return (
        <div className={className}>
            <span className="font-semibold text-foreground">{contato.nome}</span>
            {hasIndicador && (
                <div onClick={(e) => e.stopPropagation()}>
                    <Link
                        to={`/contatos/${contato.indicador?.id}`}
                        className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors mt-0.5"
                    >
                        <LinkIcon className="h-3 w-3" />
                        Indicado por: {contato.indicador?.nome}
                    </Link>
                </div>
            )}
        </div>
    )
}
