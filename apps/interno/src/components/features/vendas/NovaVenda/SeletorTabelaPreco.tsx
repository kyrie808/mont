import { Tag } from 'lucide-react'
import { cn } from '@mont/shared'
import { ROTULO_TABELA, type TabelaPreco } from '../../../../utils/tabelaPreco'

interface SeletorTabelaPrecoProps {
    tabela: TabelaPreco
    onChange: (tabela: TabelaPreco) => void
    /** Campanha valendo agora. Fora de campanha o seletor não aparece (as três tabelas são iguais). */
    campanha: { nome: string; fim: string } | null
    /** Quando a forma de pagamento já decide a tabela: o motivo, e os botões travam. */
    travadaPor?: string | null
    className?: string
}

const OPCOES: TabelaPreco[] = ['pix', 'cartao', 'normal']

function diaMes(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

/**
 * Qual preço está valendo na venda (Black): Pix/dinheiro, cartão ou normal (fiado).
 * Sempre à vista enquanto a campanha vale — quem vende sabe, sem abrir nada, por que o
 * balde está R$ 65 e não R$ 75.
 */
export function SeletorTabelaPreco({ tabela, onChange, campanha, travadaPor, className }: SeletorTabelaPrecoProps) {
    if (!campanha) return null

    return (
        <div className={cn('space-y-1.5', className)}>
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Tag className="size-3.5 text-primary" />
                    Preço · {campanha.nome} até {diaMes(campanha.fim)}
                </span>
            </div>
            <div role="radiogroup" aria-label="Tabela de preço" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {OPCOES.map((opcao) => {
                    const ativa = tabela === opcao
                    return (
                        <button
                            key={opcao}
                            type="button"
                            role="radio"
                            aria-checked={ativa}
                            disabled={!!travadaPor && !ativa}
                            onClick={() => onChange(opcao)}
                            className={cn(
                                'rounded-lg px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                                ativa
                                    ? 'bg-background text-foreground shadow-card'
                                    : 'text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40',
                            )}
                        >
                            {opcao === 'normal' ? 'Normal (fiado)' : ROTULO_TABELA[opcao]}
                        </button>
                    )
                })}
            </div>
            {travadaPor && <p className="text-[11px] text-muted-foreground">{travadaPor}</p>}
        </div>
    )
}
