import { Badge } from '../ui'
import { useKanbanRowContato } from '../../hooks/usePerfilSideSheet'
import type { RelacionamentoStatus } from '../../hooks/useRelacionamento'

// Badge de status do relacionamento — AO VIVO. Deriva de coluna_efetiva do contato
// (mesma fonte do card no board), então acompanha registro de contato/drag sem F5.
// `fallback` evita flash no 1º paint / enquanto a query carrega.
// Fonte única dos rótulos+variantes (antes duplicados nos 4 side-sheets).

const RESULTADO_LABEL: Record<string, string> = {
    a_contatar: 'A Contatar',
    contatado: 'Aguardando Resposta',
    follow_up: 'Follow-up',
    em_negociacao: 'Em Conversa',
    resolvido: 'Resolvido',
    sem_retorno: 'Sem Retorno',
}

const STATUS_BADGE: Record<RelacionamentoStatus, 'warning' | 'secondary' | 'default' | 'success'> = {
    a_contatar: 'warning',
    contatado: 'secondary',
    follow_up: 'warning',
    em_negociacao: 'default',
    resolvido: 'success',
    sem_retorno: 'secondary',
}

interface StatusRelacionamentoBadgeProps {
    contatoId: string
    fallback: RelacionamentoStatus
    className?: string
}

export function StatusRelacionamentoBadge({ contatoId, fallback, className }: StatusRelacionamentoBadgeProps) {
    const { data: row } = useKanbanRowContato(contatoId)
    const status = row?.coluna_efetiva ?? row?.status_relacionamento ?? fallback

    return (
        <Badge variant={STATUS_BADGE[status]} className={className}>
            {RESULTADO_LABEL[status] ?? status}
        </Badge>
    )
}
