import { cn } from '@mont/shared'
import { reais } from '@/lib/formato'
import { economiaDoCombo, mostraSeloEconomia } from '@/lib/vitrine/economia'
import type { ComboLoja } from '@/lib/vitrine/tipos'

interface PrecoComboProps {
    combo: Pick<ComboLoja, 'preco' | 'ancora'>
    /** "card" (lista de combos), "grande" (tela 03) ou "banner" (fundo marrom do topo). */
    variante: 'card' | 'grande' | 'banner'
}

/** Preço do combo, "separado" riscado embaixo e o selo "Economize R$ X" (só quando há âncora maior que o preço). */
export function PrecoCombo({ combo, variante }: PrecoComboProps) {
    const economia = economiaDoCombo(combo)
    const noBanner = variante === 'banner'
    return (
        <div className="flex flex-col items-start gap-1">
            <span
                className={cn(
                    'font-titulo leading-none',
                    variante === 'card' && 'text-[26px]',
                    variante === 'grande' && 'text-[30px]',
                    noBanner && 'text-4xl text-laranja',
                )}
            >
                {reais(combo.preco)}
            </span>
            {economia !== null && combo.ancora !== null && (
                <>
                    <span className={cn('text-[13px] whitespace-nowrap', noBanner ? 'text-linha' : 'text-texto-suave')}>
                        separado <s>{reais(combo.ancora)}</s>
                    </span>
                    {mostraSeloEconomia(economia) && (
                        <span
                            className={cn(
                                'rounded-full px-2.5 py-1 text-xs leading-none font-bold whitespace-nowrap',
                                noBanner ? 'bg-laranja text-marrom' : 'bg-verde text-white',
                            )}
                        >
                            Economize {reais(economia)}
                        </span>
                    )}
                </>
            )}
        </div>
    )
}
