import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Interacao } from '@/services/interacaoService'

const mockInteracoes = vi.fn()
const mockCampanhas = vi.fn()

vi.mock('@/hooks/useInteracoes', () => ({
    useInteracoes: () => mockInteracoes(),
}))
vi.mock('@/hooks/useCampanhas', () => ({
    useCampanhas: () => mockCampanhas(),
}))

// Importado depois dos mocks — o componente resolve os hooks na importação.
const { InteracoesTimeline } = await import('./InteracoesTimeline')

function fazInteracao(overrides: Partial<Interacao> = {}): Interacao {
    return {
        id: 'b0e1c2d3-0000-4000-8000-000000000001',
        contato_id: '965cb284-e13d-4234-ab06-ca9435b328fe',
        data: '2026-08-13T05:00:00.000Z',
        tipo: 'ponto_contato',
        canal: 'whatsapp',
        sentido: 'entrada',
        resultado: null,
        observacao: null,
        criado_por: null,
        campanha_id: null,
        gerado_por_ia: false,
        ...overrides,
    } as Interacao
}

function renderiza(interacoes: Interacao[]) {
    mockInteracoes.mockReturnValue({ data: interacoes, isLoading: false, error: null })
    mockCampanhas.mockReturnValue({ data: [] })
    return render(
        <MemoryRouter>
            <InteracoesTimeline contatoId="965cb284-e13d-4234-ab06-ca9435b328fe" />
        </MemoryRouter>,
    )
}

/**
 * O selo existe para o Gilmar distinguir num relance o que ELE escreveu do que a IA
 * escreveu. Sem essa distinção os dois viram a mesma coisa na tela — e ele perde a
 * confiança no registro inteiro, inclusive no que é dele.
 */
describe('InteracoesTimeline — selo de origem automática', () => {
    beforeEach(() => vi.clearAllMocks())

    it('marca "Automático" no registro escrito pela IA', () => {
        renderiza([fazInteracao({ gerado_por_ia: true, observacao: 'Cliente fez o pedido.' })])
        expect(screen.getByText('Automático')).toBeInTheDocument()
    })

    it('NÃO marca o registro escrito pelo humano', () => {
        renderiza([fazInteracao({ gerado_por_ia: false, observacao: 'Liguei, sem resposta.' })])
        expect(screen.queryByText('Automático')).not.toBeInTheDocument()
    })

    it('mostra o resumo da IA por inteiro, sem truncar', () => {
        // `truncate` corta em uma linha. Para nota curta digitada à mão tudo bem; para o
        // resumo de duas frases da IA, esconderia o conteúdo que dá valor ao registro.
        const resumo = 'A cliente realizou o pedido de um pão de queijo de lata de R$ 25,00. Ficou combinado que ela fará a retirada do produto hoje.'
        const { container } = renderiza([fazInteracao({ gerado_por_ia: true, observacao: resumo })])

        const p = container.querySelector('p.whitespace-pre-wrap')
        expect(p).not.toBeNull()
        expect(p?.textContent).toBe(resumo)
        expect(screen.queryByText(resumo)?.className).not.toContain('truncate')
    })

    it('nota humana curta segue truncada — o comportamento antigo não regride', () => {
        const { container } = renderiza([
            fazInteracao({ gerado_por_ia: false, observacao: 'Liguei, sem resposta.' }),
        ])
        expect(container.querySelector('p.truncate')).not.toBeNull()
    })
})
