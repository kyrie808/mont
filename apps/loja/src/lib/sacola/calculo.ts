import type { ComboLoja, ProdutoLoja, Vitrine } from '@/lib/vitrine/tipos'
import type { Escolha, ItemSacola } from './esquema'

export interface Catalogo {
    produtos: Map<string, ProdutoLoja>
    combos: Map<string, ComboLoja>
}

export function catalogoDa(vitrine: Vitrine): Catalogo {
    const produtos = new Map<string, ProdutoLoja>()
    for (const p of [...vitrine.massa, ...vitrine.doces, ...vitrine.zero]) produtos.set(p.id, p)
    const combos = new Map<string, ComboLoja>()
    for (const c of vitrine.combos) combos.set(c.id, c)
    return { produtos, combos }
}

/** Escolhas fecham todos os grupos (N/N), só com opções existentes e disponíveis, respeitando "pode repetir". */
export function escolhasCompletas(combo: ComboLoja, escolhas: Escolha[]): boolean {
    if (!combo.montavel) return false
    return combo.grupos.every((g) => {
        const doGrupo = escolhas.filter((e) => e.grupoId === g.id)
        const total = doGrupo.reduce((s, e) => s + e.quantidade, 0)
        const validas = doGrupo.every((e) => {
            const opcao = g.opcoes.find((o) => o.produtoId === e.produtoId)
            return opcao !== undefined && opcao.disponivel && (g.permiteRepetir || e.quantidade === 1)
        })
        return total === g.quantidade && validas
    })
}

export type LinhaSacola =
    | { tipo: 'produto'; produto: ProdutoLoja; quantidade: number; subtotal: number; vendavel: boolean }
    | { tipo: 'combo'; chave: string; combo: ComboLoja; escolhas: Escolha[]; subtotal: number; vendavel: boolean }

export interface ResumoSacola {
    linhas: LinhaSacola[]
    /** Combo conta 1; avulso conta a quantidade. */
    quantidadeItens: number
    /** Soma no Pix só do que está à venda. */
    totalPix: number
    temPendencia: boolean
}

export function resumirSacola(itens: ItemSacola[], catalogo: Catalogo): ResumoSacola {
    const linhas: LinhaSacola[] = []
    for (const item of itens) {
        if (item.tipo === 'produto') {
            const produto = catalogo.produtos.get(item.produtoId)
            if (!produto) continue
            linhas.push({
                tipo: 'produto',
                produto,
                quantidade: item.quantidade,
                subtotal: produto.preco * item.quantidade,
                vendavel: produto.disponivel,
            })
        } else {
            const combo = catalogo.combos.get(item.comboId)
            if (!combo) continue
            linhas.push({
                tipo: 'combo',
                chave: item.chave,
                combo,
                escolhas: item.escolhas,
                subtotal: combo.preco,
                vendavel: combo.disponivel && escolhasCompletas(combo, item.escolhas),
            })
        }
    }
    const vendaveis = linhas.filter((l) => l.vendavel)
    return {
        linhas,
        quantidadeItens: vendaveis.reduce((s, l) => s + (l.tipo === 'produto' ? l.quantidade : 1), 0),
        totalPix: vendaveis.reduce((s, l) => s + l.subtotal, 0),
        temPendencia: vendaveis.length !== linhas.length,
    }
}

/** "Balde 4 kg · 2 baldinhos 1 kg · Doce de leite ×2 …": fixos primeiro, depois cada sabor escolhido. */
export function descreverCombo(combo: ComboLoja, escolhas: Escolha[]): string {
    const partes = combo.fixos.map((f) => `${f.quantidade} ${f.nome}`)
    for (const g of combo.grupos) {
        for (const e of escolhas.filter((x) => x.grupoId === g.id)) {
            const opcao = g.opcoes.find((o) => o.produtoId === e.produtoId)
            if (opcao) partes.push(`${opcao.nome} ×${e.quantidade}`)
        }
    }
    return partes.join(' · ')
}
