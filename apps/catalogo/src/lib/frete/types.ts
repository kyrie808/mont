// Frete por distância — tipos compartilhados (catálogo).
// A config vive em configuracoes.chave='frete_config' e é editável na aba Frete do interno.

export interface FreteFaixa {
    /** Limite superior da faixa, em km (inclusive). */
    ateKm: number
    /** Valor cobrado por km dentro desta faixa (reais). */
    valorPorKm: number
}

export interface FreteConfig {
    /** progressivo = cada trecho cobra a taxa da sua faixa; taxa_faixa = distância × taxa da faixa final. */
    modo: 'progressivo' | 'taxa_faixa'
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
