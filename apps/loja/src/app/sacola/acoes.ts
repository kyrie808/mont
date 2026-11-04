'use server'

import { z } from 'zod'
import { somarIndicacoes } from '@/lib/sacola/levaJunto'
import { criarClienteServidor } from '@/lib/supabase/servidor'

/** Até quantos produtos da sacola entram na conta (uma consulta por produto). */
const LIMITE_PRODUTOS = 10
const INDICACOES_POR_PRODUTO = 8

const esquemaIds = z.array(z.guid()).min(1).max(30)

/**
 * Sacola → produtos mais comprados junto com o que está nela, pelas vendas reais, do mais indicado
 * para o menos. Quem escolhe o que mostrar é a tela (tira o que já está na sacola e o esgotado).
 * Falha vira lista vazia: sem sugestão, a sacola segue normal.
 */
export async function indicacoesDaSacola(entrada: unknown): Promise<string[]> {
    const lido = esquemaIds.safeParse(entrada)
    if (!lido.success) return []
    const ids = [...new Set(lido.data)].slice(0, LIMITE_PRODUTOS)
    const cliente = await criarClienteServidor()
    const respostas = await Promise.all(
        ids.map((id) => cliente.rpc('produtos_comprados_juntos', { p_produto_id: id, p_limit: INDICACOES_POR_PRODUTO })),
    )
    const listas = respostas.flatMap((r) => {
        if (r.error) {
            console.error('[loja] falha ao buscar o "leva junto?"', r.error.message)
            return []
        }
        return [r.data ?? []]
    })
    return somarIndicacoes(listas)
}
