import { useQuery } from '@tanstack/react-query'
import { contatoService } from '../services/contatoService'
import { isCelularValido, normalizarTelefone } from '../utils/telefone'
import { useDebounce } from './useDebounce'

/**
 * Descobre, enquanto o operador digita, se o WhatsApp já pertence a alguém.
 *
 * Existe por causa de um caso real (19/08/2026): o Gilmar preencheu o cadastro inteiro
 * da "Najla", clicou em Criar e só então levou o erro — o número já era do contato
 * "♡ Cadonhoto ♡", que a secretária de WhatsApp havia criado com o push name do
 * aparelho. Descobrir a colisão ANTES do envio transforma um trabalho perdido num
 * "ah, ela já está aqui".
 *
 * Só consulta quando o telefone está completo (11 dígitos): com número pela metade a
 * resposta seria sempre "ninguém", e piscaria um aviso falso a cada tecla.
 *
 * `ignorarId` é o próprio contato em edição — encontrar a si mesmo não é colisão.
 */
export function useDonoDoTelefone(telefone: string | null | undefined, ignorarId?: string) {
    const debounced = useDebounce(telefone ?? '', 400)
    const completo = isCelularValido(debounced)
    const chave = normalizarTelefone(debounced)

    const { data, isFetching } = useQuery({
        queryKey: ['contato-por-telefone', chave],
        queryFn: () => contatoService.donoDoTelefone(chave),
        enabled: completo,
        staleTime: 1000 * 30,
    })

    const dono = completo && data && data.id !== ignorarId ? data : null

    return { dono, verificando: completo && isFetching }
}
