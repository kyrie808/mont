import { supabase } from '../lib/supabase'
import type { Contato } from '../types/database'
import { differenceInDays } from 'date-fns'

export type StatusRecompra = 'atrasado' | 'proximo' | 'ok'

export interface ContatoRecompra {
    contato: Contato
    diasSemCompra: number
    ciclo: number
    status: StatusRecompra
    ultimaCompra: Date | null
}

export const recompraService = {
    async getRecompraData(config: { b2b: number, b2c: number }): Promise<ContatoRecompra[]> {
        const { data: clientesData, error: clientesError } = await supabase
            .from('contatos')
            .select('id, nome, tipo, ultimo_contato, criado_em, status')
            .eq('status', 'cliente')

        if (clientesError) throw clientesError
        const clientes = (clientesData ?? []) as Contato[]

        const { data: vendasData, error: vendasError } = await supabase
            .from('vendas')
            .select('contato_id, data')
            .eq('status', 'entregue')
            .order('data', { ascending: false })

        if (vendasError) throw vendasError

        const ultimaVendaPorContato = new Map<string, string>()
        vendasData?.forEach((v) => {
            if (!ultimaVendaPorContato.has(v.contato_id)) {
                ultimaVendaPorContato.set(v.contato_id, v.data)
            }
        })

        const hoje = new Date()
        const contatosRecompra: ContatoRecompra[] = []

        clientes.forEach((cliente) => {
            const ciclo = cliente.tipo === 'B2B' ? config.b2b : config.b2c
            const ultimaVendaStr = ultimaVendaPorContato.get(cliente.id)
            const ultimaCompra = ultimaVendaStr ? new Date(ultimaVendaStr) : null
            const ultimoContato = cliente.ultimo_contato ? new Date(cliente.ultimo_contato) : null

            let dataReferencia: Date | null = null
            if (ultimaCompra && ultimoContato) {
                dataReferencia = ultimaCompra > ultimoContato ? ultimaCompra : ultimoContato
            } else {
                dataReferencia = ultimaCompra || ultimoContato
            }

            if (!dataReferencia) {
                dataReferencia = new Date(cliente.criado_em)
            }

            const diasSemCompra = differenceInDays(hoje, dataReferencia)
            const thresholdProximo = cliente.tipo === 'B2B' ? 2 : 3

            let status: StatusRecompra
            if (diasSemCompra > ciclo) {
                status = 'atrasado'
            } else if (diasSemCompra >= ciclo - thresholdProximo) {
                status = 'proximo'
            } else {
                status = 'ok'
            }

            contatosRecompra.push({
                contato: cliente,
                diasSemCompra,
                ciclo,
                status,
                ultimaCompra,
            })
        })

        contatosRecompra.sort((a, b) => {
            const statusOrder = { atrasado: 0, proximo: 1, ok: 2 }
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status]
            }
            return b.diasSemCompra - a.diasSemCompra
        })

        return contatosRecompra
    },

    async marcarComoContatado(contatoId: string): Promise<boolean> {
        const { error } = await supabase
            .from('contatos')
            .update({ ultimo_contato: new Date().toISOString() })
            .eq('id', contatoId)

        if (error) throw error
        return true
    }
}
