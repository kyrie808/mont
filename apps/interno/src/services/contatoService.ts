import { supabase } from '../lib/supabase'
import type {
    ContatoInsert,
    ContatoUpdate
} from '@mont/shared'
import type { DomainContato, CreateContato, UpdateContato } from '../types/domain'
import { getCoordinates } from '../utils/geocoding'
import { toDomainContato } from './mappers'
import { filtroBuscaContato, normalizarTelefone } from '../utils/telefone'

export class ContatoService {
    /* CRUD */
    async func(query: string = '', tipo?: string, status?: string): Promise<DomainContato[]> {
        let builder = supabase
            .from('contatos')
            .select(`
                *,
                indicador:contatos!indicado_por_id (
                    id,
                    nome,
                    telefone
                )
            `)
            .order('criado_em', { ascending: false })

        const filtroContato = filtroBuscaContato(query)
        if (filtroContato) builder = builder.or(filtroContato)
        if (tipo && tipo !== 'todos') {
            builder = builder.eq('tipo', tipo)
        }
        if (status && status !== 'todos') {
            builder = builder.eq('status', status)
        }

        const { data, error } = await builder

        if (error) {
            console.error('Erro ao buscar contatos:', error)
            throw new Error(`Erro ao buscar contatos: ${error.message}`)
        }

        return (data || []).map(toDomainContato)
    }

    async getById(id: string): Promise<DomainContato | null> {
        const { data, error } = await supabase
            .from('contatos')
            .select('*')
            .eq('id', id)
            .single()

        if (error) {
            console.error('Erro ao buscar contato por ID:', error)
            return null
        }

        // Self-referencing FK join returns wrong direction in PostgREST; lookup separately
        let indicador: { id: string; nome: string; telefone?: string | null } | null = null
        if (data.indicado_por_id) {
            const { data: ind } = await supabase
                .from('contatos')
                .select('id, nome, telefone')
                .eq('id', data.indicado_por_id)
                .single()
            indicador = ind
        }

        return toDomainContato({ ...data, indicador })
    }

    async create(data: CreateContato): Promise<DomainContato> {
        const dbInsert: ContatoInsert = {
            nome: data.nome,
            apelido: data.apelido || null,
            // Portão único de escrita: o telefone entra normalizado venha de onde vier.
            telefone: normalizarTelefone(data.telefone),
            tipo: data.tipo as NonNullable<ContatoInsert['tipo']>,
            subtipo: data.subtipo,
            status: data.status as NonNullable<ContatoInsert['status']>,
            origem: data.origem as NonNullable<ContatoInsert['origem']>,
            fonte: data.fonte ?? null,
            campanha_id: data.campanhaId ?? null,
            indicado_por_id: data.indicadoPorId,
            endereco: data.endereco,
            cep: data.cep,
            bairro: data.bairro,
            latitude: data.lat,
            longitude: data.lng,
            observacoes: data.observacoes,
            logradouro: data.logradouro,
            numero: data.numero,
            complemento: data.complemento,
            cidade: data.cidade,
            uf: data.uf
        }

        if (dbInsert.endereco && (!dbInsert.latitude || !dbInsert.longitude)) {
            try {
                const coords = await getCoordinates(dbInsert.endereco)
                if (coords) {
                    dbInsert.latitude = coords.lat
                    dbInsert.longitude = coords.lng
                }
            } catch (e) {
                console.warn('Falha no geocoding durante criação:', e)
            }
        }

        const { data: created, error } = await supabase
            .from('contatos')
            .insert(dbInsert)
            .select(`
                *,
                indicador:contatos!indicado_por_id (
                    id,
                    nome,
                    telefone
                )
            `)
            .single()

        if (error) {
            const duplicado = await this.mensagemTelefoneDuplicado(error, dbInsert.telefone)
            if (duplicado) throw new Error(duplicado)

            console.error('Erro ao criar contato:', error)
            throw new Error(`Erro ao criar contato: ${error.message}`)
        }

        return toDomainContato(created)
    }

    /**
     * O índice único `contatos_telefone_norm_key` garante um contato por telefone.
     * Quando ele barra uma gravação, o operador precisa saber QUEM já tem aquele
     * número — não ver um erro cru do Postgres.
     */
    private async mensagemTelefoneDuplicado(
        error: { code?: string; message?: string },
        telefone: string | null | undefined,
    ): Promise<string | null> {
        const violouUnicidade =
            error.code === '23505' && (error.message ?? '').includes('telefone')
        if (!violouUnicidade) return null

        const { data: existente } = await supabase
            .from('contatos')
            .select('nome')
            .eq('telefone_norm', normalizarTelefone(telefone))
            .maybeSingle()

        return existente
            ? `Este WhatsApp já está cadastrado para "${existente.nome}".`
            : 'Este WhatsApp já está cadastrado para outro contato.'
    }

    async update(id: string, data: UpdateContato): Promise<DomainContato> {
        const dbUpdate: ContatoUpdate = {}
        if (data.nome !== undefined) dbUpdate.nome = data.nome
        if (data.apelido !== undefined) dbUpdate.apelido = data.apelido
        if (data.telefone !== undefined) dbUpdate.telefone = normalizarTelefone(data.telefone)
        if (data.tipo !== undefined) dbUpdate.tipo = data.tipo as NonNullable<ContatoUpdate['tipo']>
        if (data.subtipo !== undefined) dbUpdate.subtipo = data.subtipo
        if (data.status !== undefined) dbUpdate.status = data.status as NonNullable<ContatoUpdate['status']>
        if (data.origem !== undefined) dbUpdate.origem = data.origem as NonNullable<ContatoUpdate['origem']>
        if (data.fonte !== undefined) dbUpdate.fonte = data.fonte
        if (data.campanhaId !== undefined) dbUpdate.campanha_id = data.campanhaId
        if (data.indicadoPorId !== undefined) dbUpdate.indicado_por_id = data.indicadoPorId
        if (data.endereco !== undefined) dbUpdate.endereco = data.endereco
        if (data.cep !== undefined) dbUpdate.cep = data.cep
        if (data.bairro !== undefined) dbUpdate.bairro = data.bairro
        if (data.lat !== undefined) dbUpdate.latitude = data.lat
        if (data.lng !== undefined) dbUpdate.longitude = data.lng
        if (data.observacoes !== undefined) dbUpdate.observacoes = data.observacoes
        if (data.logradouro !== undefined) dbUpdate.logradouro = data.logradouro
        if (data.numero !== undefined) dbUpdate.numero = data.numero
        if (data.complemento !== undefined) dbUpdate.complemento = data.complemento
        if (data.cidade !== undefined) dbUpdate.cidade = data.cidade
        if (data.uf !== undefined) dbUpdate.uf = data.uf

        if (dbUpdate.endereco && dbUpdate.latitude === undefined) {
            try {
                const coords = await getCoordinates(dbUpdate.endereco)
                if (coords) {
                    dbUpdate.latitude = coords.lat
                    dbUpdate.longitude = coords.lng
                }
            } catch (e) {
                console.warn('Falha no geocoding durante atualização:', e)
            }
        }

        const { data: updated, error } = await supabase
            .from('contatos')
            .update(dbUpdate)
            .eq('id', id)
            .select(`
                *,
                indicador:contatos!indicado_por_id (
                    id,
                    nome,
                    telefone
                )
            `)
            .single()

        if (error) {
            const duplicado = await this.mensagemTelefoneDuplicado(error, dbUpdate.telefone)
            if (duplicado) throw new Error(duplicado)

            console.error('Erro ao atualizar contato:', error)
            throw new Error(`Erro ao atualizar contato: ${error.message}`)
        }

        return toDomainContato(updated)
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('contatos')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Erro ao deletar contato:', error)
            throw new Error(`Erro ao deletar contato: ${error.message}`)
        }
    }
}

export const contatoService = new ContatoService()
