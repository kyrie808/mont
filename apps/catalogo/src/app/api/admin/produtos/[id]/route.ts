import { NextResponse } from 'next/server'

// Fronteira arquitetural: o INTERNO é a fonte única da verdade do produto.
// O catálogo não escreve mais dados de produto — a edição (incl. preço, custo,
// apresentação, visibilidade e kits/combos) é feita no Sistema Interno Mont.
// Esta rota foi aposentada; mantida só para responder com orientação clara.
const MOVED = {
    error: 'Edição de produtos foi movida para o Sistema Interno Mont. O catálogo é somente leitura.',
} as const

export async function PATCH() {
    return NextResponse.json(MOVED, { status: 403 })
}

export async function PUT() {
    return NextResponse.json(MOVED, { status: 403 })
}

export async function POST() {
    return NextResponse.json(MOVED, { status: 403 })
}
