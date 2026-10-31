import { describe, it, expect } from 'vitest'
import { lerAgoraSimulado, HOST_PRODUCAO } from './agoraSimulado'

/**
 * Data simulada para ver a Black antes de 03/11 no preview da Vercel (mesmo padrão do
 * LOJA_AGORA da loja). Em produção ela NUNCA vale — três travas independentes.
 */

const BLACK = '2026-11-03T10:00:00-03:00'

describe('lerAgoraSimulado', () => {
    it('preview com a variável: vale a data simulada', () => {
        expect(lerAgoraSimulado({ VITE_VERCEL_ENV: 'preview', VITE_AGORA_SIMULADO: BLACK }, 'mont-interno-git-x.vercel.app'))
            .toBe('2026-11-03T13:00:00.000Z')
    })

    it('desenvolvimento local também vale', () => {
        expect(lerAgoraSimulado({ VITE_AGORA_SIMULADO: BLACK }, 'localhost')).toBe('2026-11-03T13:00:00.000Z')
    })

    it('TRAVA 1: build de produção ignora, mesmo com a variável', () => {
        expect(lerAgoraSimulado({ VITE_VERCEL_ENV: 'production', VITE_AGORA_SIMULADO: BLACK }, 'mont-interno.vercel.app')).toBeNull()
    })

    it('TRAVA 2: domínio de produção ignora, mesmo sem saber o ambiente', () => {
        expect(lerAgoraSimulado({ VITE_AGORA_SIMULADO: BLACK }, HOST_PRODUCAO)).toBeNull()
        expect(lerAgoraSimulado({ VITE_VERCEL_ENV: 'preview', VITE_AGORA_SIMULADO: BLACK }, HOST_PRODUCAO)).toBeNull()
    })

    it('TRAVA 3: valor que não é data com fuso é ignorado', () => {
        expect(lerAgoraSimulado({ VITE_AGORA_SIMULADO: '03/11/2026' }, 'localhost')).toBeNull()
        expect(lerAgoraSimulado({ VITE_AGORA_SIMULADO: '2026-11-03T10:00:00' }, 'localhost')).toBeNull()
        expect(lerAgoraSimulado({ VITE_AGORA_SIMULADO: '' }, 'localhost')).toBeNull()
    })

    it('sem a variável: hora real (null)', () => {
        expect(lerAgoraSimulado({ VITE_VERCEL_ENV: 'preview' }, 'mont-interno-git-x.vercel.app')).toBeNull()
    })
})
