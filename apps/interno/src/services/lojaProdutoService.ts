import { supabase } from '../lib/supabase'
import { LOJA_PRODUTO_PADRAO, lojaProdutoSchema, type LojaProdutoForm } from '../schemas/lojaProduto'

// Aba "Loja" do produto: lê e grava o complemento da vitrine da loja (loja_vitrine).
// Sem linha (ou com a linha desligada), vale o cadastro: o formulário abre com os padrões.

export const lojaProdutoService = {
    async obter(produtoId: string): Promise<LojaProdutoForm> {
        const { data, error } = await supabase
            .from('loja_vitrine')
            .select(
                'visivel, nome_loja, frase_card, resumo, secao_id, ordem_loja, destaque_hero, leva_junto, disponivel, usa_estoque, usar_ancoragem',
            )
            .eq('produto_id', produtoId)
            .maybeSingle()
        if (error) throw error
        if (!data || !data.visivel) return { ...LOJA_PRODUTO_PADRAO }
        return {
            nomeLoja: data.nome_loja ?? '',
            fraseCard: data.frase_card ?? '',
            resumo: data.resumo ?? '',
            secaoId: data.secao_id ?? '',
            ordemLoja: data.ordem_loja === null ? '' : String(data.ordem_loja),
            destaqueHero: data.destaque_hero,
            levaJunto: data.leva_junto,
            esgotado: !data.disponivel,
            usaEstoque: data.usa_estoque,
            usarAncoragem: data.usar_ancoragem,
        }
    },

    /** Valida e grava numa chamada (o banco garante um "leva junto?" e um destaque por vez). */
    async salvar(produtoId: string, form: LojaProdutoForm): Promise<void> {
        const lido = lojaProdutoSchema.safeParse(form)
        if (!lido.success) throw new Error(lido.error.issues[0]?.message ?? 'Confira a aba Loja')
        const f = lido.data
        const { error } = await supabase.rpc('loja_salvar_vitrine', {
            p_produto_id: produtoId,
            p_nome_loja: f.nomeLoja,
            p_frase_card: f.fraseCard,
            p_resumo: f.resumo,
            p_destaque_hero: f.destaqueHero,
            p_leva_junto: f.levaJunto,
            p_disponivel: !f.esgotado,
            p_usa_estoque: f.usaEstoque,
            p_usar_ancoragem: f.usarAncoragem,
            // Omitidos = NULL no banco = "igual ao cadastro".
            ...(f.secaoId === '' ? {} : { p_secao_id: f.secaoId }),
            ...(f.ordemLoja === '' ? {} : { p_ordem_loja: Number(f.ordemLoja) }),
        })
        if (error) throw error
    },
}
