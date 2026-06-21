import type { ProdutoCatalogo } from '@mont/shared'

export function InformacaoDoProduto({ product }: { product: ProdutoCatalogo }) {
    const preparo = (product.instrucoes_preparo ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)

    // Sem instruções de preparo → não renderiza a seção (a descrição vai no card).
    if (preparo.length === 0) return null

    return (
        <div className="rounded-[28px] bg-card p-6 shadow-[0_12px_34px_-16px_rgba(0,0,0,0.18)] md:p-8">
            <h2 className="mb-4 text-[20px] font-extrabold text-foreground">Informação do produto</h2>

            <h3 className="mb-2 text-[14px] font-bold uppercase tracking-wide text-primary">
                Instruções de preparo
            </h3>
            <ul className="space-y-2">
                {preparo.map((p, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[15px] text-foreground">
                        <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                        {p}
                    </li>
                ))}
            </ul>
        </div>
    )
}
