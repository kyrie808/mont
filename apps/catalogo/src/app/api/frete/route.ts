import { NextResponse } from 'next/server'
import { z } from 'zod'
import { calcularFreteParaCep } from '@/lib/frete'

const schema = z.object({ cep: z.string() })

// Preview de frete pro checkout. O valor autoritativo é recalculado no /api/pedidos.
export async function POST(request: Request) {
    try {
        const { cep } = schema.parse(await request.json())
        const resultado = await calcularFreteParaCep(cep)
        return NextResponse.json(resultado)
    } catch {
        // Falha → trata como "a combinar" (não quebra o checkout).
        return NextResponse.json(
            { disponivel: false, frete: 0, distanciaKm: null, motivo: 'sem_config' },
            { status: 200 },
        )
    }
}
