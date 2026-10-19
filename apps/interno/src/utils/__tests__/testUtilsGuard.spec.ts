import { describe, it, expect } from 'vitest'
import { createTestClient } from '@mont/shared/test-utils'

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env

// Trava da integração: sem RUN_INTEGRATION=1 o harness recusa ANTES de logar na produção.
// Roda no `pnpm test` padrão (onde a flag é vazia) — se isto falhar, a trava caiu.
describe('createTestClient sem RUN_INTEGRATION', () => {
    it('recusa e não toca a produção', async () => {
        expect(env.RUN_INTEGRATION).not.toBe('1')
        await expect(createTestClient()).rejects.toThrow(/RUN_INTEGRATION=1/)
    })
})
