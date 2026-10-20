import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agendaService } from '../services/agendaService'
import type { NovoLembrete } from '../schemas/agenda'

// Agenda: uma chamada a agenda_itens por intervalo visível (o mês da grade), mais a
// faixa de atrasados e o "sem data". refetchOnWindowFocus ligado SÓ aqui (o global é
// false): pagar a venda em outra aba e voltar tira o lembrete dos pendentes.

const RAIZ = ['agenda'] as const

export function useAgendaItens(inicio: string, fim: string) {
    return useQuery({
        queryKey: [...RAIZ, 'itens', inicio, fim],
        queryFn: () => agendaService.itens(inicio, fim),
        refetchOnWindowFocus: true,
        staleTime: 30_000,
        placeholderData: (anterior) => anterior,
    })
}

export function useAgendaAtrasados() {
    return useQuery({
        queryKey: [...RAIZ, 'atrasados'],
        queryFn: () => agendaService.atrasados(),
        refetchOnWindowFocus: true,
        staleTime: 30_000,
    })
}

export function useAgendaSemData() {
    return useQuery({
        queryKey: [...RAIZ, 'sem-data'],
        queryFn: () => agendaService.semData(),
        refetchOnWindowFocus: true,
        staleTime: 30_000,
    })
}

export function useBuscaClientesAgenda(termo: string) {
    const t = termo.trim()
    return useQuery({
        queryKey: [...RAIZ, 'clientes', t],
        queryFn: () => agendaService.buscarClientes(t),
        enabled: t.length >= 2,
        staleTime: 60_000,
    })
}

export function useClienteAgenda(id: string | null) {
    return useQuery({
        queryKey: [...RAIZ, 'cliente', id],
        queryFn: () => (id ? agendaService.cliente(id) : Promise.resolve(null)),
        enabled: id !== null,
        staleTime: 30_000,
    })
}

export function useVendasEmAberto(contatoId: string | null) {
    return useQuery({
        queryKey: [...RAIZ, 'vendas-em-aberto', contatoId],
        queryFn: () => (contatoId ? agendaService.vendasEmAberto(contatoId) : Promise.resolve([])),
        enabled: contatoId !== null,
        staleTime: 30_000,
    })
}

/** Escritas em lembretes; toda escrita recarrega a agenda inteira (itens, atrasados, sem data). */
export function useLembreteMutations() {
    const queryClient = useQueryClient()
    const recarregar = () => queryClient.invalidateQueries({ queryKey: RAIZ })

    const criar = useMutation({ mutationFn: (novo: NovoLembrete) => agendaService.criarLembrete(novo), onSuccess: recarregar })
    const concluir = useMutation({ mutationFn: (id: string) => agendaService.concluir(id), onSuccess: recarregar })
    const reabrir = useMutation({ mutationFn: (id: string) => agendaService.reabrir(id), onSuccess: recarregar })
    const reagendar = useMutation({
        mutationFn: (p: { id: string; data: string }) => agendaService.reagendar(p.id, p.data),
        onSuccess: recarregar,
    })
    const excluir = useMutation({ mutationFn: (id: string) => agendaService.excluir(id), onSuccess: recarregar })

    return { criar, concluir, reabrir, reagendar, excluir }
}
