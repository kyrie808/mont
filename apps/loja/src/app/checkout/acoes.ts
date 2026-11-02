'use server'

import { ambiente } from '@/lib/ambiente'
import { linkWhatsApp } from '@/lib/formato'
import { esquemaEnvioPedido, TEXTO_OFERTAS, type ResultadoEnvio } from '@/lib/pedido/esquema'
import { mensagemDoPedido } from '@/lib/pedido/mensagem'
import { criarClienteServico } from '@/lib/supabase/servico'
import { carregarVitrine } from '@/lib/vitrine/carregar'

const ERRO_GERAL = 'Não conseguimos registrar o pedido agora. Tente de novo ou fale com a gente no WhatsApp.'

/**
 * Tela 05 → grava o pedido (RPC loja_criar_pedido, que valida e precifica tudo no banco) e
 * devolve o link do WhatsApp da Mont com a mensagem pronta. O pedido só vira venda quando a
 * Mont confirma no sistema interno.
 */
export async function enviarPedido(entrada: unknown): Promise<ResultadoEnvio> {
    const lido = esquemaEnvioPedido.safeParse(entrada)
    if (!lido.success) {
        return { ok: false, erro: lido.error.issues[0]?.message ?? 'Confira seus dados.' }
    }
    const d = lido.data

    const itens = d.itens.map((i) =>
        i.tipo === 'produto'
            ? { produto_id: i.produtoId, quantidade: i.quantidade }
            : {
                  combo_id: i.comboId,
                  escolhas: i.escolhas.map((e) => ({ grupo_id: e.grupoId, produto_id: e.produtoId, quantidade: e.quantidade })),
              },
    )

    const banco = criarClienteServico()
    const { data, error } = await banco
        .rpc('loja_criar_pedido', {
            p_chave: d.chave,
            p_nome: d.nome,
            p_telefone: d.telefone,
            p_cep: d.cep,
            p_logradouro: d.logradouro,
            p_numero: d.numero,
            p_complemento: d.complemento,
            p_bairro: d.bairro,
            p_cidade: d.cidade,
            p_uf: d.uf,
            p_itens: itens,
            p_ofertas: d.ofertas,
            p_ofertas_texto: TEXTO_OFERTAS,
        })
        .single()

    if (error || !data) {
        // 22023 = recusa da regra (estoque, combo fora da campanha, endereço…): a mensagem do banco é para o cliente.
        if (error?.code === '22023') return { ok: false, erro: error.message }
        console.error('[loja] falha ao gravar pedido', error)
        return { ok: false, erro: ERRO_GERAL }
    }

    const { data: pedido, error: erroPedido } = await banco
        .from('cat_pedidos')
        .select('endereco_entrega')
        .eq('id', data.pedido_id)
        .single()
    if (erroPedido) {
        console.error('[loja] pedido gravado, falha ao ler o endereço', erroPedido)
    }

    const vitrine = await carregarVitrine()
    const mensagem = mensagemDoPedido({
        numero: data.numero_pedido,
        total: Number(data.total),
        nome: d.nome,
        endereco: pedido?.endereco_entrega ?? `${d.logradouro}, ${d.numero} - ${d.cidade}/${d.uf.toUpperCase()}`,
        itens: d.itens,
        vitrine,
    })

    return { ok: true, numero: data.numero_pedido, link: linkWhatsApp(ambiente().NEXT_PUBLIC_WHATSAPP_NUMBER, mensagem) }
}
