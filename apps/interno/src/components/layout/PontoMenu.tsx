import { useContagemPedidosLoja } from '@/hooks/usePedidosLoja'

/**
 * Ponto laranja no ícone do menu (☰, celular) quando há pedido da loja esperando confirmação.
 * Mesmo critério e mesma consulta do contador do item "Pedidos da loja" (ContadorNav).
 */
export function PontoMenu() {
    const { data: total = 0 } = useContagemPedidosLoja()
    if (total === 0) return null
    return (
        <>
            <span
                aria-hidden
                className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-warning-strong ring-2 ring-background"
            />
            <span className="sr-only">
                {total} {total === 1 ? 'pedido da loja aguardando' : 'pedidos da loja aguardando'} confirmação
            </span>
        </>
    )
}
