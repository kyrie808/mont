import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createTestClient, cleanTestData } from '@mont/shared/test-utils'

/**
 * Integração (PRODUÇÃO, conta-teste) da recorrência VARIÁVEL de despesas.
 *
 * Garante o workflow de despesa fixa de valor variável (ex: luz R$300/R$210):
 *  1. Uma ocorrência gerada a partir de um template `variavel` carrega o valor-estimativa.
 *  2. Ajustar o valor real da ocorrência funciona (regressão do bug saldo_devedor —
 *     coluna GENERATED ALWAYS; ver contasAPagarService.spec.ts) e o saldo_devedor deriva.
 *  3. O UNIQUE (recorrente_id, competencia) — espinha da idempotência do gerador, que usa
 *     ON CONFLICT DO NOTHING — impede que uma nova geração sobrescreva o valor ajustado.
 *
 * NÃO chama a RPC global gerar_despesas_recorrentes (ela percorre TODOS os templates
 * ativos, inclusive os reais): tudo é exercitado sobre um template próprio da conta-teste.
 *
 * despesas_recorrentes não é coberto pelo cleanTestData → limpamos o template pelo id.
 * Janela: manual, nunca com o Gilmar usando (ver skill tdd-mont-pragmatico).
 */

type Client = Awaited<ReturnType<typeof createTestClient>>

let supabase: Client
let categoriaDespesaId: string
const templateIds: string[] = []

const competenciaAtual = () => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`
}
const venc = (dia: number) => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

async function criarTemplateVariavel(valorEstimado: number) {
    const { data, error } = await supabase
        .from('despesas_recorrentes')
        .insert({
            descricao: `Luz Teste ${Date.now()}`,
            credor: 'Companhia Teste',
            valor: valorEstimado,
            plano_conta_id: categoriaDespesaId,
            dia_vencimento: 10,
            variavel: true,
            ativa: true,
        })
        .select('id, variavel')
        .single()
    if (error) throw error
    templateIds.push(data.id as string)
    return data
}

/** Mimetiza o que gerar_despesas_recorrentes faz: insere a ocorrência do mês com o valor do template. */
async function materializarOcorrencia(templateId: string, valorEstimado: number) {
    const { data, error } = await supabase
        .from('contas_a_pagar')
        .insert({
            descricao: 'Luz Teste',
            credor: 'Companhia Teste',
            valor_total: valorEstimado,
            data_vencimento: venc(10),
            plano_conta_id: categoriaDespesaId,
            parcela_atual: 1,
            total_parcelas: 1,
            recorrente_id: templateId,
            competencia: competenciaAtual(),
        })
        .select('id, valor_total, saldo_devedor')
        .single()
    if (error) throw error
    return data
}

beforeAll(async () => {
    supabase = await createTestClient()
    const { data, error } = await supabase
        .from('plano_de_contas')
        .select('id')
        .eq('tipo', 'despesa')
        .eq('ativo', true)
        .limit(1)
        .single()
    if (error) throw error
    categoriaDespesaId = data.id as string
})

afterEach(async () => {
    if (templateIds.length) {
        // Ocorrências (contas_a_pagar) saem no cleanTestData por created_by; o template não é coberto.
        await supabase.from('despesas_recorrentes').delete().in('id', templateIds)
        templateIds.length = 0
    }
    await cleanTestData(supabase)
})

describe('despesas recorrentes variáveis (integração)', () => {
    it('template variável carrega o valor-estimativa na ocorrência do mês', async () => {
        const template = await criarTemplateVariavel(300)
        expect(template.variavel).toBe(true)

        const ocorrencia = await materializarOcorrencia(template.id as string, 300)
        expect(Number(ocorrencia.valor_total)).toBe(300)
        // saldo_devedor é derivado: valor_total - valor_pago (0) = 300
        expect(Number(ocorrencia.saldo_devedor)).toBe(300)
    })

    it('ajustar o valor real da ocorrência funciona e o saldo_devedor deriva (regressão saldo_devedor)', async () => {
        const template = await criarTemplateVariavel(300)
        const ocorrencia = await materializarOcorrencia(template.id as string, 300)

        // A conta chegou R$210 — ajusta o valor real. NÃO enviamos saldo_devedor (coluna gerada).
        const { data: atualizada, error } = await supabase
            .from('contas_a_pagar')
            .update({ valor_total: 210 })
            .eq('id', ocorrencia.id as string)
            .select('valor_total, saldo_devedor')
            .single()

        expect(error).toBeNull()
        expect(Number(atualizada!.valor_total)).toBe(210)
        expect(Number(atualizada!.saldo_devedor)).toBe(210)
    })

    it('UNIQUE (recorrente_id, competencia) impede sobrescrever o valor ajustado numa nova geração', async () => {
        const template = await criarTemplateVariavel(300)
        const ocorrencia = await materializarOcorrencia(template.id as string, 300)

        // valor real ajustado
        await supabase.from('contas_a_pagar').update({ valor_total: 210 }).eq('id', ocorrencia.id as string)

        // Nova "geração" do mesmo (recorrente_id, competencia): o gerador usa ON CONFLICT DO NOTHING;
        // um INSERT direto bate no UNIQUE → prova que a ocorrência ajustada nunca é recriada/sobrescrita.
        const { error: dupErr } = await supabase
            .from('contas_a_pagar')
            .insert({
                descricao: 'Luz Teste',
                credor: 'Companhia Teste',
                valor_total: 300,
                data_vencimento: venc(10),
                plano_conta_id: categoriaDespesaId,
                parcela_atual: 1,
                total_parcelas: 1,
                recorrente_id: template.id as string,
                competencia: competenciaAtual(),
            })
        expect(dupErr).not.toBeNull()
        expect(dupErr!.code).toBe('23505') // unique_violation

        // o valor ajustado permanece
        const { data: final } = await supabase
            .from('contas_a_pagar')
            .select('valor_total')
            .eq('id', ocorrencia.id as string)
            .single()
        expect(Number(final!.valor_total)).toBe(210)
    })
})
