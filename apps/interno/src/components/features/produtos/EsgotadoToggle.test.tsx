import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EsgotadoToggle } from './EsgotadoToggle'

describe('EsgotadoToggle', () => {
    it('um toque alterna o esgotado sem abrir a edição do card', () => {
        const onToggle = vi.fn()
        const abrirEdicao = vi.fn()
        render(
            <div onClick={abrirEdicao}>
                <EsgotadoToggle nome="Chipa 1kg" esgotado={false} onToggle={onToggle} />
            </div>,
        )

        const botao = screen.getByRole('button', { name: 'Marcar Chipa 1kg como esgotado' })
        expect(botao.getAttribute('aria-pressed')).toBe('false')
        fireEvent.click(botao)

        expect(onToggle).toHaveBeenCalledTimes(1)
        expect(abrirEdicao).not.toHaveBeenCalled()
    })

    it('ligado, diz que está esgotado e como voltar a vender', () => {
        render(<EsgotadoToggle nome="Chipa 1kg" esgotado onToggle={() => {}} />)
        const botao = screen.getByRole('button', { name: 'Chipa 1kg está esgotado. Tocar para voltar a vender' })
        expect(botao.getAttribute('aria-pressed')).toBe('true')
    })
})
