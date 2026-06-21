'use client'

import { useState, useMemo } from 'react'
import type { ProdutoCatalogo } from '@mont/shared'
import type { VitrineAba } from '../_data'
import { ProdutoCard } from './ProdutoCard'

interface Props {
    abas: VitrineAba[]
    produtos: ProdutoCatalogo[]
}

export function VitrineTabs({ abas, produtos }: Props) {
    const [sel, setSel] = useState<string>('todos')

    const filtrados = useMemo(
        () => (sel === 'todos' ? produtos : produtos.filter((p) => p.secao_id === sel)),
        [sel, produtos],
    )

    const pill = (active: boolean) =>
        `whitespace-nowrap rounded-full px-5 py-2 text-sm font-bold transition-colors ${
            active
                ? 'bg-foreground text-card'
                : 'bg-card text-muted-foreground ring-1 ring-border hover:bg-muted'
        }`

    return (
        <div>
            {/* py-2 dá respiro vertical (overflow-x-auto força overflow-y a recortar o topo das pills).
                Inner com w-max + mx-auto: centraliza quando cabe, rola quando não cabe (sem cortar o início). */}
            <div className="mb-6 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max mx-auto gap-2 px-1">
                    <button onClick={() => setSel('todos')} className={pill(sel === 'todos')}>
                        Todos
                    </button>
                    {abas.map((a) => (
                        <button key={a.id} onClick={() => setSel(a.id)} className={pill(sel === a.id)}>
                            {a.nome}
                        </button>
                    ))}
                </div>
            </div>

            {filtrados.length === 0 ? (
                <p className="py-16 text-center text-muted-foreground">Nenhum produto nesta seção.</p>
            ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {filtrados.map((p) => (
                        <ProdutoCard key={p.id} product={p} />
                    ))}
                </div>
            )}
        </div>
    )
}
