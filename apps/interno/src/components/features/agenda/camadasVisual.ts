import { CalendarRange, ClipboardList, HandCoins, PhoneCall, Receipt, RotateCcw, StickyNote, Truck, Wallet, type LucideIcon } from 'lucide-react'
import { TIPOS_LEMBRETE, type TipoLembrete } from '../../../schemas/agenda'
import type { Camada } from '../../../utils/agenda'

// Cor de cada camada da Agenda — só tokens do design system (DESIGN_SYSTEM.md §3/§5):
// lembrete = marca, vencimento = a receber (warning-strong), conta a pagar = saída
// (destructive), retomada = atenção leve (warning), entrega = neutro (foreground).
export const VISUAL_CAMADA: Record<Camada, { ponto: string; chip: string; caixa: string; icone: string }> = {
    lembretes: {
        ponto: 'bg-primary',
        chip: 'bg-primary/15 hover:bg-primary/25 border-l-primary',
        caixa: 'accent-[hsl(var(--primary))]',
        icone: 'text-primary',
    },
    vencimentos: {
        ponto: 'bg-warning-strong',
        chip: 'bg-warning-strong/15 hover:bg-warning-strong/25 border-l-warning-strong',
        caixa: 'accent-[hsl(var(--warning-strong))]',
        icone: 'text-warning-strong',
    },
    entregas: {
        ponto: 'bg-foreground/60',
        chip: 'bg-foreground/[0.07] hover:bg-foreground/[0.12] border-l-foreground/60',
        caixa: 'accent-[hsl(var(--foreground))]',
        icone: 'text-foreground/60',
    },
    contas: {
        ponto: 'bg-destructive',
        chip: 'bg-destructive/15 hover:bg-destructive/25 border-l-destructive',
        caixa: 'accent-[hsl(var(--destructive))]',
        icone: 'text-destructive',
    },
    retomadas: {
        ponto: 'bg-warning',
        chip: 'bg-warning/15 hover:bg-warning/25 border-l-warning',
        caixa: 'accent-[hsl(var(--warning))]',
        icone: 'text-warning',
    },
}

/** Ícone da camada (chip agregado de vencimentos e afins). */
export const ICONE_CAMADA: Record<Camada, LucideIcon> = {
    lembretes: StickyNote,
    vencimentos: Wallet,
    entregas: Truck,
    contas: Receipt,
    retomadas: RotateCcw,
}

/** Ícone do tipo de lembrete no chip — no lugar do texto "cobrança"/"parcela"… */
export const ICONE_TIPO: Record<TipoLembrete, LucideIcon> = {
    cobranca: HandCoins,
    parcela: CalendarRange,
    pendencia_interna: ClipboardList,
    retorno_comercial: PhoneCall,
    outro: StickyNote,
}

/** O tipo vem do banco como texto; fora do vocabulário, conta como 'outro' (ícone genérico). */
export function tipoDoLembrete(tipo: string | null): TipoLembrete {
    return TIPOS_LEMBRETE.find((x) => x === tipo) ?? 'outro'
}
