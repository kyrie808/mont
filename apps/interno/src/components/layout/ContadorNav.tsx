import { useContagemPedidosLoja } from '@/hooks/usePedidosLoja'
import type { NavItem } from './navConfig'

interface ContadorNavProps {
    tipo: NonNullable<NavItem['contador']>
}

/** Número ao lado do item do menu (celular e desktop). Zero não aparece. */
export function ContadorNav({ tipo }: ContadorNavProps) {
    const { data: total = 0 } = useContagemPedidosLoja()
    if (tipo !== 'pedidos-loja' || total === 0) return null
    return (
        <span
            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-warning-strong px-1.5 text-[11px] font-bold tabular-nums text-warning-strong-foreground"
            aria-label={`${total} ${total === 1 ? 'pedido aguardando' : 'pedidos aguardando'} confirmação`}
        >
            {total > 99 ? '99+' : total}
        </span>
    )
}
