import { supabase } from '../lib/supabase'
import type { Json } from '@mont/shared'
import type { LocalPartida } from '../types/domain'

// Fonte ÚNICA de escrita da tabela `configuracoes` (uma linha por `chave`, valor JSON).
// A LEITURA app-wide continua no hook `useConfiguracoes`; aqui centralizamos os UPSERTs
// tipados por chave — mata o supabase cru espalhado e o footgun de montar o JSON na mão
// (qualquer knob não-editável é preservado por merge, ex.: relacionamento.multiplicador_sumido).

/** Frete por distância (mesmo shape usado no catálogo). */
export interface FreteFaixa { ateKm: number; valorPorKm?: number; valorFixo?: number }
export interface FreteConfig {
    modo: 'progressivo' | 'taxa_faixa' | 'valor_fixo'
    origem: { lat: number; lng: number; label?: string; cep?: string }
    faixas: FreteFaixa[]
    foraDoAlcance: 'a_combinar'
}

export const FRETE_CONFIG_DEFAULT: FreteConfig = {
    modo: 'valor_fixo',
    origem: { lat: -23.7205964, lng: -46.524444, label: 'Cozinha — Montanhão/SBC', cep: '09784-410' },
    faixas: [{ ateKm: 30, valorFixo: 5 }],
    foraDoAlcance: 'a_combinar',
}

async function upsert(chave: string, valor: Json): Promise<void> {
    const { error } = await supabase
        .from('configuracoes')
        .upsert({ chave, valor }, { onConflict: 'chave' })
    if (error) throw error
}

async function ler<T>(chave: string): Promise<T | null> {
    const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', chave)
        .maybeSingle()
    if (error) throw error
    return (data?.valor as unknown as T) ?? null
}

export interface RelacionamentoPatch {
    limiarReativacao?: number
    janelaRespostaHoras?: number
    cooldownRecusaDias?: number
}

export const configuracoesService = {
    /** Faz MERGE sobre a linha atual (preserva multiplicador_sumido e knobs futuros). */
    async salvarRelacionamento(patch: RelacionamentoPatch): Promise<void> {
        const atual = (await ler<Record<string, unknown>>('relacionamento')) ?? {}
        const valor: Record<string, unknown> = { ...atual }
        if (patch.limiarReativacao !== undefined) valor.limiar_reativacao = patch.limiarReativacao
        if (patch.janelaRespostaHoras !== undefined) valor.janela_resposta_horas = patch.janelaRespostaHoras
        if (patch.cooldownRecusaDias !== undefined) valor.cooldown_recusa_dias = patch.cooldownRecusaDias
        await upsert('relacionamento', valor as Json)
    },

    async salvarRecompensa(valor: number): Promise<void> {
        // Merge: preserva tipo/min_indicacoes e outros campos, só troca o valor.
        const atual = (await ler<Record<string, unknown>>('recompensa_indicacao')) ?? {}
        await upsert('recompensa_indicacao', { ...atual, tipo: 'desconto', valor } as Json)
    },

    async salvarMensagem(texto: string): Promise<void> {
        await upsert('mensagem_recompra', { texto } as Json)
    },

    async getLocais(): Promise<LocalPartida[]> {
        const v = await ler<LocalPartida[]>('locais_partida')
        return Array.isArray(v) ? v : []
    },
    async salvarLocais(locais: LocalPartida[]): Promise<void> {
        await upsert('locais_partida', locais as unknown as Json)
    },

    async getFrete(): Promise<FreteConfig> {
        return (await ler<FreteConfig>('frete_config')) ?? FRETE_CONFIG_DEFAULT
    },
    async salvarFrete(config: FreteConfig): Promise<void> {
        await upsert('frete_config', config as unknown as Json)
    },
}
