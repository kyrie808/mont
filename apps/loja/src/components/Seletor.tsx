import { cn } from '@mont/shared'

type Variante = 'loja' | 'painel' | 'combo' | 'sacola'

// Medidas de cada tela do wireframe (.step, .step do painel, .st do combo, .st da sacola).
const estilos: Record<Variante, { caixa: string; botao: string; numero: string }> = {
    loja: {
        caixa: 'h-11 rounded-[22px] bg-marrom text-creme',
        botao: 'h-11 w-11 text-[18px] text-creme',
        numero: 'min-w-4 text-center font-bold',
    },
    painel: {
        caixa: 'h-[52px] rounded-[26px] border-[1.5px] border-marrom',
        botao: 'h-[50px] w-12 text-[20px] text-marrom disabled:text-tracejado',
        numero: 'min-w-5 text-center text-base font-bold',
    },
    combo: {
        caixa: 'h-11 rounded-[22px] border-[1.5px] border-marrom',
        botao: 'h-[42px] w-11 text-[18px] text-marrom disabled:text-tracejado',
        numero: 'min-w-4 text-center font-bold',
    },
    sacola: {
        caixa: 'h-11 rounded-[22px] border-[1.5px] border-marrom',
        botao: 'h-[42px] w-10 text-[17px] text-marrom',
        numero: 'min-w-3.5 text-center font-bold',
    },
}

interface SeletorProps {
    variante: Variante
    /** Nome do produto, para o leitor de tela ("Mais um: Balde de massa 4 kg"). */
    nome: string
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
    nome,
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
                aria-label={`Tirar um: ${nome}`}
                onClick={onMenos}
                disabled={menosDesabilitado}
                className={cn('cursor-pointer border-0 bg-transparent font-bold disabled:cursor-default', e.botao)}
            >
                −
            </button>
            <span className={e.numero}>{quantidade}</span>
            <button
                type="button"
                aria-label={`Mais um: ${nome}`}
                onClick={onMais}
                disabled={maisDesabilitado}
                className={cn('cursor-pointer border-0 bg-transparent font-bold disabled:cursor-default', e.botao)}
            >
                +
            </button>
        </div>
    )
}
