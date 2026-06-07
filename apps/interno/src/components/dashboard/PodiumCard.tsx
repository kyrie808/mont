import { Medal, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@mont/shared'

interface PodiumCardProps {
    /** Posição 0-based no ranking (0 = 1º lugar). */
    index: number
    nome: string
    /** Linha 1: descrição (ex.: "3 clientes indicados"). */
    primaryText: string
    /** Linha 2: valor formatado (ex.: "R$ 1.234,00 em vendas"). */
    secondaryText: string
    /** Classe do valor da linha 2 quando NÃO está no top-3. Default: text-primary. */
    secondaryAccent?: string
    /** Exibe o badge ⭐ "Embaixador" nos top-3 (usado pelo Ranking de Compras). */
    showAmbassadorBadge?: boolean
}

// Gradientes intencionais: ouro/prata/bronze têm semântica visual universal
// (um pódio É ouro/prata/bronze) — decorativos, NÃO substituir por tokens semânticos.
function getGradient(ranking: number): string {
    switch (ranking) {
        case 1: return "bg-gradient-to-r from-yellow-300 to-yellow-500 text-yellow-900 border-yellow-400"
        case 2: return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900 border-gray-400"
        case 3: return "bg-gradient-to-r from-orange-300 to-orange-400 text-orange-900 border-orange-400"
        default: return "bg-card text-foreground border-border"
    }
}

export function PodiumCard({
    index,
    nome,
    primaryText,
    secondaryText,
    secondaryAccent = "text-primary",
    showAmbassadorBadge = false,
}: PodiumCardProps) {
    const isTop3 = index < 3
    const gradientClass = isTop3 ? getGradient(index + 1) : getGradient(99)

    return (
        <Card className={cn(
            "relative overflow-hidden border transition-all hover:scale-[1.01]",
            isTop3 ? "border-0 shadow-lg" : "shadow-sm"
        )}>
            <div className={cn("absolute inset-0 opacity-20", gradientClass)}></div>

            <CardContent className={cn("flex items-center justify-between p-4 relative z-10", isTop3 ? "" : "bg-card/50")}>
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "flex items-center justify-center size-10 rounded-full font-bold text-lg shadow-inner",
                        isTop3 ? "bg-white/30 backdrop-blur-sm text-black" : "bg-muted text-muted-foreground"
                    )}>
                        {index + 1}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className={cn("font-bold text-sm", isTop3 ? "text-black dark:text-white mix-blend-hard-light" : "text-foreground")}>
                                {nome}
                            </h3>
                            {isTop3 && showAmbassadorBadge && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/10 text-xs font-bold uppercase tracking-tight">
                                    <Star className="size-3" />
                                    Embaixador
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <p className={cn("text-xs font-medium opacity-80", isTop3 ? "text-black dark:text-white" : "text-muted-foreground")}>
                                {primaryText}
                            </p>
                            <p className={cn("text-[10px] font-bold", isTop3 ? "text-black/70 dark:text-white/70" : secondaryAccent)}>
                                {secondaryText}
                            </p>
                        </div>
                    </div>
                </div>

                {index === 0 && <Medal className="size-6 text-yellow-600 dark:text-yellow-400 drop-shadow-md" />}
            </CardContent>
        </Card>
    )
}
