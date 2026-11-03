import type { LojaProdutoForm } from '../../../schemas/lojaProduto'

// Aba "Loja" do formulário de produto (mobile e desktop): tipos e textos compartilhados.

/** Complemento da vitrine da loja (loja_vitrine). Só no modo edit. */
export interface AbaLojaProps {
    valores: LojaProdutoForm
    alterar: (patch: Partial<LojaProdutoForm>) => void
    carregando: boolean
}

export type AbaProduto = 'sistema' | 'catalogo' | 'loja'

export const AVISO_ANCORAGEM =
    'Só ligue se esse preço já foi cobrado de verdade. Mostrar "de R$ X" com um preço que nunca foi praticado é propaganda enganosa.'

export const SIM_NAO = [
    { label: 'Não', value: 'false' },
    { label: 'Sim', value: 'true' },
]
