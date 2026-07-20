import type { KanbanRow } from '../../services/relacionamentoService'

export interface MotivoInfo {
    texto: string
    tooltip: string
    corClass: string
    glyph: 'cheio' | 'vazio' | null
}

/**
 * Deriva texto + tooltip + cor + glyph a partir dos dados já expostos pela view.
 * Número exibido = chave de ordenação da coluna (atraso em recompra ≥2; dias_sem_compra em reativação).
 * Retorna null para aba_atual null (tier 0 — fora do kanban).
 */
export function motivoCard(card: KanbanRow): MotivoInfo | null {
    const aba = card.aba_atual
    if (!aba) return null

    if (aba === 'leads') {
        return {
            texto: 'nunca comprou · lead',
            tooltip: 'Ainda não fez a 1ª compra. Trabalhe a conversão.',
            corClass: 'text-warning-strong',
            glyph: null,
        }
    }

    if (aba === 'cobranca') {
        return {
            texto: 'fiado em aberto',
            tooltip: 'Fiado em aberto. Prioridade.',
            corClass: 'text-warning-strong',
            glyph: null,
        }
    }

    if (aba === 'reativacao') {
        // 1-compra balde vazio (dias >= limiar_reativacao)
        const dias = card.dias_sem_compra ?? 0
        return {
            texto: `1ª compra · sumiu há ${dias}d`,
            tooltip: `Comprou 1× e não voltou há ${dias} dias. Aba de resgate.`,
            corClass: 'text-primary/75',
            glyph: 'vazio',
        }
    }

    // aba === 'recompra'
    if (card.balde_cheio) {
        // 1-compra balde cheio (dias < limiar_reativacao): vai pro fundo (atraso null)
        const dias = card.dias_sem_compra ?? 0
        return {
            texto: `1ª compra há ${dias}d · balde cheio`,
            tooltip: `Comprou 1× há ${dias} dias — provavelmente ainda tem produto. Aguardar.`,
            corClass: 'text-muted-foreground/40',
            glyph: 'cheio',
        }
    }

    // ≥2 compras: ritmo derivado
    const ciclo = card.intervalo_medio != null
        ? Math.max(1, Math.round(card.intervalo_medio))
        : null

    if (ciclo == null) return null

    const atr = card.atraso ?? 0
    const diasSem = card.dias_sem_compra ?? 0

    if (card.sumido) {
        return {
            texto: `compra a cada ~${ciclo}d · sumiu (${atr}d atrasado)`,
            tooltip: `Comprava a cada ~${ciclo} dias. Está há ${diasSem} sem voltar. Esfriou — vale chamar.`,
            corClass: 'text-destructive',
            glyph: null,
        }
    }

    if (atr > 0) {
        return {
            texto: `compra a cada ~${ciclo}d · atrasou ${atr}d`,
            tooltip: `Comprava a cada ~${ciclo} dias. Passou ${atr} do esperado. Bom momento pra oferecer.`,
            corClass: 'text-warning',
            glyph: null,
        }
    }

    return {
        texto: `compra a cada ~${ciclo}d · no ritmo`,
        tooltip: `Dentro do ciclo (~${ciclo} dias). Sem urgência.`,
        corClass: 'text-muted-foreground/60',
        glyph: null,
    }
}
