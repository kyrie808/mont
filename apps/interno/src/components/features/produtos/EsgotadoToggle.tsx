import type { MouseEvent } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@mont/shared'

interface EsgotadoToggleProps {
    nome: string
    esgotado: boolean
    onToggle: () => void
    disabled?: boolean
    /** Desktop (linha da tabela) usa a altura compacta; o celular mantém o alvo de toque de 44 px. */
    compacto?: boolean
}

/**
 * "Esgotado" de um toque na lista de Produtos (celular e desktop). Ligado, a loja tira o produto
 * da venda e dos sabores dos combos. Fica dentro de um card/linha clicável (que abre a edição),
 * então o clique não sobe.
 */
export function EsgotadoToggle({ nome, esgotado, onToggle, disabled, compacto }: EsgotadoToggleProps) {
    const alternar = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        onToggle()
    }
    return (
        <button
            type="button"
            aria-pressed={esgotado}
            aria-label={esgotado ? `${nome} está esgotado. Tocar para voltar a vender` : `Marcar ${nome} como esgotado`}
            onClick={alternar}
            onKeyDown={(e) => e.stopPropagation()}
            disabled={disabled}
            className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-bold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'disabled:cursor-wait disabled:opacity-50',
                compacto ? 'h-7' : 'min-h-11',
                esgotado
                    ? 'border-destructive bg-destructive text-destructive-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
        >
            {esgotado && <Check className="h-3.5 w-3.5" aria-hidden />}
            Esgotado
        </button>
    )
}
