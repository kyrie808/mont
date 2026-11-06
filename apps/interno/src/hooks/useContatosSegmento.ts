import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
    contatosSegmentoService,
    type ContagemContatos,
    type ParametrosListaContatos,
} from '../services/contatosSegmentoService'

/**
 * Raiz das chaves de tudo que sai da `view_contatos_segmento` (lista, contadores, segmento do
 * perfil, conversões de indicação). Venda criada/editada/entregue/cancelada/excluída e contato
 * criado/editado/excluído invalidam esta raiz — senão selo e contadores ficariam velhos por
 * 15 min (staleTime) até um F5.
 */
export const CHAVE_CONTATOS_SEGMENTO = 'contatos-segmento'

const QUINZE_MIN = 1000 * 60 * 15

const CONTAGEM_VAZIA: ContagemContatos = { all: 0, clientes: 0, leads: 0, vips: 0, inativos: 0, novosIa: 0 }

/** Uma página da Gestão de Clientes. Mantém a página anterior na tela enquanto a próxima chega. */
export function useListaContatos(parametros: ParametrosListaContatos) {
    return useQuery({
        queryKey: [CHAVE_CONTATOS_SEGMENTO, 'lista', parametros],
        queryFn: () => contatosSegmentoService.listar(parametros),
        placeholderData: keepPreviousData,
        staleTime: QUINZE_MIN,
    })
}

/** Contadores dos filtros (Todos, Clientes, Leads, VIPs, Inativos, Novos da IA) para a busca. */
export function useContagemContatos(busca: string): ContagemContatos {
    const { data } = useQuery({
        queryKey: [CHAVE_CONTATOS_SEGMENTO, 'contagem', busca],
        queryFn: () => contatosSegmentoService.contar(busca),
        placeholderData: keepPreviousData,
        staleTime: QUINZE_MIN,
    })
    return data ?? CONTAGEM_VAZIA
}

/** Segmento de um contato (perfil do cliente). `undefined` enquanto carrega. */
export function useSegmentoContato(contatoId: string | undefined) {
    const { data } = useQuery({
        queryKey: [CHAVE_CONTATOS_SEGMENTO, 'contato', contatoId],
        queryFn: () => contatosSegmentoService.segmentoDoContato(contatoId ?? ''),
        enabled: Boolean(contatoId),
        staleTime: QUINZE_MIN,
    })
    return data ?? undefined
}

/** Indicações convertidas deste contato como indicador (0 enquanto carrega ou se não indicou ninguém). */
export function useConversoesIndicador(contatoId: string | undefined): number {
    const { data } = useQuery({
        queryKey: [CHAVE_CONTATOS_SEGMENTO, 'conversoes', contatoId],
        queryFn: () => contatosSegmentoService.conversoesDoIndicador(contatoId ?? ''),
        enabled: Boolean(contatoId),
        staleTime: QUINZE_MIN,
    })
    return data ?? 0
}

/** Total de indicações convertidas (KPI do Ranking de indicações). */
export function useTotalConversoes(): number {
    const { data } = useQuery({
        queryKey: [CHAVE_CONTATOS_SEGMENTO, 'conversoes', 'total'],
        queryFn: () => contatosSegmentoService.totalConversoes(),
        staleTime: QUINZE_MIN,
    })
    return data ?? 0
}
