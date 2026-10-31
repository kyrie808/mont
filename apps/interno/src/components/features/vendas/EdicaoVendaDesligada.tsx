import { Navigate, useParams } from 'react-router-dom'

/**
 * `/vendas/:id/editar` desligado (31/10/2026). A Nova Venda em modo de edição nunca alterou a
 * venda: ao salvar, criava OUTRA, e a original ficava — venda, estoque e recebimento em dobro.
 * Até existir a edição de verdade (uma RPC que altera a mesma venda, depois da Black), o link
 * leva ao detalhe com o aviso. Atalho salvo e link antigo continuam funcionando.
 */
export function EdicaoVendaDesligada() {
    const { id } = useParams<{ id: string }>()
    return <Navigate to={id ? `/vendas/${id}` : '/vendas'} replace state={{ edicaoDesligada: true }} />
}
