'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import { z } from 'zod'
import { ambiente } from '@/lib/ambiente'
import { linkWhatsApp } from '@/lib/formato'
import { enviarEventoSite, type EnvioSite } from '@/lib/medicao/capi'
import { dadosDoCheckout } from '@/lib/medicao/conteudo'
import { idInicioCheckout, idLead } from '@/lib/medicao/ids'
import { esquemaAtribuicao } from '@/lib/medicao/origem'
import { esquemaEnvioPedido, TEXTO_OFERTAS, type ResultadoEnvio } from '@/lib/pedido/esquema'
import { mensagemDoPedido } from '@/lib/pedido/mensagem'
import { catalogoDa, resumirSacola } from '@/lib/sacola/calculo'
import { esquemaItemSacola } from '@/lib/sacola/esquema'
import { criarClienteServico } from '@/lib/supabase/servico'
import { carregarVitrine } from '@/lib/vitrine/carregar'

const ERRO_GERAL = 'Não conseguimos registrar o pedido agora. Tente de novo ou fale com a gente no WhatsApp.'

/** Navegador e página da tela 05, para a API de Conversões (sem query string: nada pessoal na URL). */
async function navegador(): Promise<Pick<EnvioSite, 'ip' | 'userAgent' | 'url' | 'instante'>> {
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'loja.montdistribuidora.com.br'
    const protocolo = h.get('x-forwarded-proto') ?? 'https'
    return {
        ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: h.get('user-agent') ?? '',
        url: `${protocolo}://${host}/checkout/dados`,
        instante: Math.floor(Date.now() / 1000),
    }
}

const esquemaInicioCheckout = z.object({
    chave: z.guid(),
    itens: z.array(esquemaItemSacola).min(1).max(30),
    atribuicao: esquemaAtribuicao.optional().catch(undefined),
})

/**
 * Tela 05 aberta → InitiateCheckout pelo servidor, com o mesmo event_id do `begin_checkout`
 * do navegador. Valor e itens calculados aqui, pela vitrine (não pelo que o navegador diz).
 * O envio para a Meta roda depois da resposta (`after`), sem segurar a tela.
 */
export async function registrarInicioCheckout(entrada: unknown): Promise<void> {
    const lido = esquemaInicioCheckout.safeParse(entrada)
    if (!lido.success) return
    const resumo = resumirSacola(lido.data.itens, catalogoDa(await carregarVitrine()))
    if (resumo.totalPix <= 0) return
    const base = await navegador()
    const envio: EnvioSite = {
        ...base,
        evento: 'InitiateCheckout',
        eventId: idInicioCheckout(lido.data.chave),
        atribuicao: lido.data.atribuicao ?? {},
        dados: dadosDoCheckout(resumo),
    }
    after(() => enviarEventoSite(envio))
}

/**
 * Tela 05 → grava o pedido (RPC loja_criar_pedido, que valida e precifica tudo no banco) e
 * devolve o link do WhatsApp da Mont com a mensagem pronta. O pedido só vira venda quando a
 * Mont confirma no sistema interno.
 *
 * O toque em "Enviar pedido pelo WhatsApp" também é o Lead (navegador + servidor, mesmo event_id).
 */
export async function enviarPedido(entrada: unknown): Promise<ResultadoEnvio> {
    const lido = esquemaEnvioPedido.safeParse(entrada)
    if (!lido.success) {
        return { ok: false, erro: lido.error.issues[0]?.message ?? 'Confira seus dados.' }
    }
    const d = lido.data
    const atribuicao = d.atribuicao ?? {}

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
            p_atribuicao: { ...atribuicao },
        })
        .single()

    const lead: EnvioSite = {
        ...(await navegador()),
        evento: 'Lead',
        eventId: idLead(d.chave),
        atribuicao,
        pessoa: { telefone: d.telefone, nome: d.nome },
        dados: data ? { currency: 'BRL', value: Number(data.total) } : {},
    }
    after(() => enviarEventoSite(lead))

    if (error || !data) {
        // 22023 = recusa da regra (estoque, combo fora da campanha, endereço…): a mensagem do banco é para o cliente.
        if (error?.code === '22023') return { ok: false, erro: error.message }
        console.error('[loja] falha ao gravar pedido', error)
        return { ok: false, erro: ERRO_GERAL }
    }

    const vitrine = await carregarVitrine()
    const mensagem = mensagemDoPedido({
        numero: data.numero_pedido,
        total: Number(data.total),
        nome: d.nome,
        endereco: { logradouro: d.logradouro, numero: d.numero, complemento: d.complemento, bairro: d.bairro, cidade: d.cidade },
        itens: d.itens,
        vitrine,
    })

    return { ok: true, numero: data.numero_pedido, link: linkWhatsApp(ambiente().NEXT_PUBLIC_WHATSAPP_NUMBER, mensagem) }
}
