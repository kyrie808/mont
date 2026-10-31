'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { esquemaSacolaPersistida, type Escolha, type ItemSacola, type SacolaPersistida } from './esquema'

interface AcoesSacola {
    definirQuantidade: (produtoId: string, quantidade: number) => void
    adicionarProduto: (produtoId: string, quantidade: number) => void
    adicionarCombo: (comboId: string, escolhas: Escolha[]) => void
    trocarEscolhas: (chave: string, escolhas: Escolha[]) => void
    removerCombo: (chave: string) => void
    escolherBairro: (bairroId: string | null) => void
    manterSomente: (produtoIdsValidos: ReadonlySet<string>, bairroIdsValidos: ReadonlySet<string>) => void
}

export type EstadoSacola = SacolaPersistida & AcoesSacola

/** Chave local de cada combo na sacola. Não usa crypto.randomUUID: no celular via http da rede local ele não existe. */
function novaChave(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function limitar(quantidade: number): number {
    return Math.min(99, Math.max(0, Math.trunc(quantidade)))
}

export const useSacola = create<EstadoSacola>()(
    persist(
        (set) => ({
            itens: [],
            bairroId: null,

            definirQuantidade: (produtoId, quantidade) =>
                set((s) => {
                    const q = limitar(quantidade)
                    const existe = s.itens.some((i) => i.tipo === 'produto' && i.produtoId === produtoId)
                    if (q === 0) {
                        return { itens: s.itens.filter((i) => !(i.tipo === 'produto' && i.produtoId === produtoId)) }
                    }
                    if (!existe) return { itens: [...s.itens, { tipo: 'produto', produtoId, quantidade: q }] }
                    return {
                        itens: s.itens.map((i): ItemSacola =>
                            i.tipo === 'produto' && i.produtoId === produtoId ? { ...i, quantidade: q } : i,
                        ),
                    }
                }),

            adicionarProduto: (produtoId, quantidade) =>
                set((s) => {
                    const atual = s.itens.find((i) => i.tipo === 'produto' && i.produtoId === produtoId)
                    const q = limitar((atual?.tipo === 'produto' ? atual.quantidade : 0) + quantidade)
                    if (q === 0) return s
                    if (!atual) return { itens: [...s.itens, { tipo: 'produto', produtoId, quantidade: q }] }
                    return {
                        itens: s.itens.map((i): ItemSacola =>
                            i.tipo === 'produto' && i.produtoId === produtoId ? { ...i, quantidade: q } : i,
                        ),
                    }
                }),

            adicionarCombo: (comboId, escolhas) =>
                set((s) => ({ itens: [...s.itens, { tipo: 'combo', chave: novaChave(), comboId, escolhas }] })),

            trocarEscolhas: (chave, escolhas) =>
                set((s) => ({
                    itens: s.itens.map((i): ItemSacola => (i.tipo === 'combo' && i.chave === chave ? { ...i, escolhas } : i)),
                })),

            removerCombo: (chave) =>
                set((s) => ({ itens: s.itens.filter((i) => !(i.tipo === 'combo' && i.chave === chave)) })),

            escolherBairro: (bairroId) => set({ bairroId }),

            manterSomente: (produtoIdsValidos, bairroIdsValidos) =>
                set((s) => ({
                    itens: s.itens.filter((i) =>
                        i.tipo === 'produto' ? produtoIdsValidos.has(i.produtoId) : produtoIdsValidos.has(i.comboId),
                    ),
                    bairroId: s.bairroId && bairroIdsValidos.has(s.bairroId) ? s.bairroId : null,
                })),
        }),
        {
            name: 'mont-loja-sacola',
            version: 1,
            storage: createJSONStorage(() => localStorage),
            partialize: (s): SacolaPersistida => ({ itens: s.itens, bairroId: s.bairroId }),
            // Leitura protegida: o que veio do localStorage só entra se passar no esquema.
            merge: (persistido, atual) => {
                const lido = esquemaSacolaPersistida.safeParse(persistido)
                return lido.success ? { ...atual, ...lido.data } : atual
            },
            // Hidrata só no cliente, depois da montagem (ver HidratarSacola), para o HTML do servidor bater.
            skipHydration: true,
        },
    ),
)
