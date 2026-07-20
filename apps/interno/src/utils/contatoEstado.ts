// Estado do ponto de contato — DERIVADO na leitura (sem cron).
//
// resultado NULL (ou 'sem_resposta' legado): "Aguardando" dentro da janela;
// "Sem resposta" depois dela. respondeu/aceitou/recusou = retorno explícito.

export type EstadoContato = 'aguardando' | 'sem_resposta' | 'respondeu' | 'aceitou' | 'recusou'

const HORA_MS = 3_600_000

export function estadoPontoContato(
    resultado: string | null,
    data: string,
    janelaHoras: number,
): EstadoContato {
    if (resultado === 'respondeu' || resultado === 'aceitou' || resultado === 'recusou') {
        return resultado
    }
    // null ou 'sem_resposta' (legado) → depende do tempo desde o contato
    const passouJanela = Date.now() - new Date(data).getTime() > janelaHoras * HORA_MS
    return passouJanela ? 'sem_resposta' : 'aguardando'
}

export const ESTADO_CONTATO_LABEL: Record<EstadoContato, string> = {
    aguardando: 'Aguardando resposta',
    sem_resposta: 'Sem resposta',
    respondeu: 'Respondeu',
    aceitou: 'Aceitou',
    recusou: 'Recusou',
}
