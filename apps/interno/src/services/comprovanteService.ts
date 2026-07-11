import { supabase } from '../lib/supabase'

/** Comprovante do repasse (bucket PRIVADO `comprovantes`; arquivos em {entregadorId}/…).
 *  Admin escreve/lê via storage RLS; o entregador lê só a própria pasta. */
export const comprovanteService = {
    async upload(file: File, entregadorId: string): Promise<string> {
        const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
        const path = `${entregadorId}/${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('comprovantes').upload(path, file, { upsert: false })
        if (error) throw error
        return path
    },

    async signedUrl(path: string, ttlSeconds = 3600): Promise<string> {
        const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(path, ttlSeconds)
        if (error) throw error
        return data.signedUrl
    },
}
