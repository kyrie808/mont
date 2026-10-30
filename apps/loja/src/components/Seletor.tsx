import { cn } from '@mont/shared'

type Variante = 'loja' | 'painel' | 'combo' | 'sacola'

// Medidas de cada tela do wireframe (.step, .step do painel, .st do combo, .st da sacola).
const estilos: Record<Variante, { caixa: string; botao: string; numero: string }> = {
    loja: {
        caixa: 'h-10 rounded-[20px] bg-marrom text-creme',
        botao: 'h-10 w-11 text-[18px] text-creme',
        numero: 'min-w-4 text-center font-bold',
    },
    painel: {
        caixa: 'h-[52px] rounded-[26px] border-[1.5px] border-marrom',
        botao: 'h-[50px] w-12 text-[20px] text-marrom',
        numero: 'min-w-5 text-center text-base font-bold',
    },
    combo: {
        caixa: 'h-10 rounded-[20px] border-[1.5px] border-marrom',
        botao: 'h-[38px] w-11 text-[18px] text-marrom disabled:text-tracejado',
        numero: 'min-w-4 text-center font-bold',
    },
    sacola: {
        caixa: 'h-9 rounded-[18px] border-[1.5px] border-marrom',
        botao: 'h-[34px] w-10 text-[17px] text-marrom',
        numero: 'min-w-3.5 text-center font-bold',
    },
}

interface SeletorProps {
    variante: Variante
    quantidade: number
    onMenos: () => void
    onMais: () => void
    menosDesabilitado?: boolean
    maisDesabilitado?: boolean
    className?: string
}

/** Seletor "− n +". */
export function Seletor({
    variante,
    quantidade,
    onMenos,
    onMais,
    menosDesabilitado = false,
    maisDesabilitado = false,
    className,
}: SeletorProps) {
    const e = estilos[variante]
    return (
        <div className={cn('flex items-center', e.caixa, className)}>
            <button
                type="button"
                aria-label="Tirar um"
                onClick={onMenos}
                disabled={menosDesabilitado}
                className={cn('cursor-pointer border-0 bg-transparent font-bold disabled:cursor-default', e.botao)}
            >
                −
            </button>
            <span className={e.numero}>{quantidade}</span>
            <button
                type="button"
                aria-label="Pôr mais um"
                onClick={onMais}
                disabled={maisDesabilitado}
                className={cn('cursor-pointer border-0 bg-transparent font-bold disabled:cursor-default', e.botao)}
            >
                +
            </button>
        </div>
    )
}
