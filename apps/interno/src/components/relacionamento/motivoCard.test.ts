import { describe, expect, it } from 'vitest'
import { motivoCard } from './motivoCard'
import type { KanbanRow } from '../../services/relacionamentoService'

function row(overrides: Partial<KanbanRow>): KanbanRow {
    return {
        aba_atual: null,
        atraso: null,
        arquivado_em: null,
        balde_cheio: false,
        coluna_efetiva: 'a_contatar',
        tentativas: 0,
        recusa_dias_restantes: null,
        contato_id: 'test-id',
        dias_sem_compra: null,
        intervalo_medio: null,
        nome: 'Test',
        primeira_compra: null,
        proxima_esperada: null,
        status_relacionamento: 'a_contatar',
        sumido: false,
        telefone: null,
        total_pedidos: null,
        ultima_compra: null,
        ...overrides,
    }
}

describe('motivoCard', () => {
    it('aba_atual null → null (tier 0, fora do kanban)', () => {
        expect(motivoCard(row({ aba_atual: null }))).toBeNull()
    })

    it('cobranca → texto fiado + cor warning-strong + sem glyph', () => {
        const m = motivoCard(row({ aba_atual: 'cobranca' }))
        expect(m).not.toBeNull()
        expect(m!.texto).toBe('fiado em aberto')
        expect(m!.tooltip).toContain('Fiado em aberto')
        expect(m!.corClass).toContain('warning-strong')
        expect(m!.glyph).toBeNull()
    })

    it('reativacao → dias_sem_compra no texto + glyph vazio + cor primary', () => {
        const m = motivoCard(row({ aba_atual: 'reativacao', dias_sem_compra: 38 }))
        expect(m).not.toBeNull()
        expect(m!.texto).toBe('1ª compra · sumiu há 38d')
        expect(m!.tooltip).toContain('38 dias')
        expect(m!.glyph).toBe('vazio')
        expect(m!.corClass).toContain('primary')
    })

    it('recompra + balde_cheio → glyph cheio + cor apagada', () => {
        const m = motivoCard(row({ aba_atual: 'recompra', balde_cheio: true, dias_sem_compra: 12 }))
        expect(m).not.toBeNull()
        expect(m!.texto).toBe('1ª compra há 12d · balde cheio')
        expect(m!.tooltip).toContain('12 dias')
        expect(m!.glyph).toBe('cheio')
        expect(m!.corClass).toContain('muted-foreground')
    })

    it('recompra ≥2 sumido → texto com atraso + cor destructive + sem glyph', () => {
        const m = motivoCard(row({
            aba_atual: 'recompra',
            sumido: true,
            intervalo_medio: 15,
            atraso: 23,
            dias_sem_compra: 38,
        }))
        expect(m).not.toBeNull()
        expect(m!.texto).toBe('compra a cada ~15d · sumiu (23d atrasado)')
        expect(m!.tooltip).toContain('38 sem voltar')
        expect(m!.corClass).toBe('text-destructive')
        expect(m!.glyph).toBeNull()
    })

    it('recompra ≥2 atraso>0 (não sumido) → cor warning', () => {
        const m = motivoCard(row({
            aba_atual: 'recompra',
            sumido: false,
            intervalo_medio: 15,
            atraso: 5,
        }))
        expect(m).not.toBeNull()
        expect(m!.texto).toBe('compra a cada ~15d · atrasou 5d')
        expect(m!.tooltip).toContain('Passou 5')
        expect(m!.corClass).toBe('text-warning')
    })

    it('recompra ≥2 atraso≤0 (no ritmo) → cor muted', () => {
        const m = motivoCard(row({
            aba_atual: 'recompra',
            sumido: false,
            intervalo_medio: 15,
            atraso: -3,
        }))
        expect(m).not.toBeNull()
        expect(m!.texto).toBe('compra a cada ~15d · no ritmo')
        expect(m!.tooltip).toContain('Sem urgência')
        expect(m!.corClass).toContain('muted-foreground')
    })

    it('intervalo_medio quase zero → ciclo nunca é 0 (guard Math.max 1)', () => {
        const m = motivoCard(row({
            aba_atual: 'recompra',
            sumido: false,
            intervalo_medio: 0.3,
            atraso: 0,
        }))
        expect(m).not.toBeNull()
        expect(m!.texto).toContain('~1d')
    })

    it('recompra ≥2 sem intervalo_medio → null (sem ritmo calculável)', () => {
        const m = motivoCard(row({
            aba_atual: 'recompra',
            balde_cheio: false,
            intervalo_medio: null,
        }))
        expect(m).toBeNull()
    })
})
