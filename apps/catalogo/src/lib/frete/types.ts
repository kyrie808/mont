// Frete por distância — tipos compartilhados (catálogo).
// A config vive em configuracoes.chave='frete_config' e é editável na aba Frete do interno.

export interface FreteFaixa {
    /** Limite superior da faixa, em km (inclusive). */
    ateKm: number
    /** Valor por km dentro da faixa (reais) — modos 'progressivo'/'taxa_faixa'. */
    valorPorKm?: number
    /** Valor fixo/fechado da faixa (reais) — modo 'valor_fixo'. */
    valorFixo?: number
}

export interface FreteConfig {
    /** progressivo = soma trecho×R$/km; taxa_faixa = dist×R$/km da faixa; valor_fixo = R$ fechado por faixa. */
    modo: 'progressivo' | 'taxa_faixa' | 'valor_fixo'
    origem: { lat: number; lng: number; label?: string; cep?: string }
    faixas: FreteFaixa[]
    /** Comportamento além da última faixa. */
    foraDoAlcance: 'a_combinar'
}

export interface FreteResultado {
    /** true = frete calculado; false = "a combinar" (sem config/coordenada ou fora do alcance). */
    disponivel: boolean
    /** Valor do frete em reais (0 quando indisponível). */
    frete: number
    /** Distância origem→destino em km (null quando não foi possível geocodificar). */
    distanciaKm: number | null
    motivo: 'ok' | 'sem_config' | 'sem_coordenada' | 'sem_rota' | 'fora_alcance'
}
