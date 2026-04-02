
import { TrendingUp, Crown, Target, Building2 } from 'lucide-react'
import { cn } from '@mont/shared'
import { useVendas } from '../../../../hooks/useVendas'
import { useIndicacoes } from '../../../../hooks/useIndicacoes'
import { calcularNivelCliente } from '../../../../utils/calculations'

function GamificationBadge({ icon: Icon, label, colorClass }: { icon: React.ComponentType<{ className?: string }>, label: string, colorClass: string }) {
    return (
        <div className={cn(
            "flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full border px-3 transition-colors",
            colorClass
        )}>
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{label}</span>
        </div>
    )
}

export function LoyaltyJourney({ contatoId, isB2B }: { contatoId: string, isB2B: boolean }) {
    const { vendas: todasVendas } = useVendas({ excludeCatalogo: true })
    const { getIndicadorById } = useIndicacoes()

    const contatoVendas = todasVendas.filter(v => v.contatoId === contatoId)
    const vendasValidas = contatoVendas.filter(v => v.status !== 'cancelada')
    const indicadorInfo = getIndicadorById(contatoId)
    const indicacoesConvertidas = indicadorInfo?.indicacoesConvertidas || 0
    const nivelCliente = calcularNivelCliente(vendasValidas.length, indicacoesConvertidas)

    const isGold = nivelCliente.nivel === 'ouro'
    const nextLevel = nivelCliente.proximoNivel
    const progressPercent = nextLevel === 'Ouro'
        ? Math.min(100, (vendasValidas.length / 10) * 100)
        : Math.min(100, (vendasValidas.length / 3) * 100)

    return (
        <div className="space-y-6">
            {/* BADGES ROW */}
            <div className="flex flex-wrap justify-center gap-3 py-2">
                {isGold && <GamificationBadge icon={Crown} label="Status VIP" colorClass="bg-yellow-500/10 text-yellow-500 border-yellow-500/20" />}
                {isB2B && <GamificationBadge icon={Building2} label="Empresa" colorClass="bg-blue-500/10 text-blue-400 border-blue-500/20" />}
            </div>

            {nextLevel && (
                <div className="mt-6 px-2">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-foreground">
                        <TrendingUp className="h-5 w-5 text-primary-500" />
                        Jornada de Fidelidade
                    </h3>

                    <div className="grid grid-cols-[40px_1fr] gap-x-2 relative">
                        {/* Timeline Line (Tactical) */}
                        <div className="absolute left-[19px] top-8 bottom-0 w-[2px] bg-gradient-to-b from-primary/50 via-gray-800 to-transparent pointer-events-none" />

                        {/* Current Node */}
                        <div className="flex flex-col items-center z-10">
                            <div className="flex items-center justify-center size-8 rounded-full bg-accent/10 border border-accent text-accent shadow-[0_0_15px_theme(colors.accent.DEFAULT)] animate-pulse-slow">
                                <Crown className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="pb-8">
                            {/* Progress Header */}
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Status Atual</p>
                                    <p className="text-lg font-bold text-foreground flex items-center gap-2">
                                        Próximo Nível: <span className="text-primary">{nextLevel}</span>
                                    </p>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-2xl font-bold text-primary drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">{Math.round(progressPercent)}%</span>
                                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Concluído</span>
                                </div>
                            </div>

                            {/* Progress Bar (Glow) */}
                            <div className="relative w-full h-3 bg-card rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div
                                    className="bg-gradient-to-r from-green-600 via-primary to-green-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_theme(colors.primary.DEFAULT)] relative overflow-hidden"
                                    style={{ width: `${progressPercent}%` }}
                                >
                                    {/* Shimmer Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 animate-shimmer" />
                                </div>
                            </div>

                            {/* Mission/Goal Intel */}
                            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-card to-card/50 border border-white/5 relative group overflow-hidden">
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="flex items-start gap-4 relative z-10">
                                    <div className="p-2 bg-white/5 rounded-lg border border-white/10 text-gray-400">
                                        <Target className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                                            Objetivo da Missão
                                        </p>
                                        <p className="text-sm text-gray-300">
                                            Realize mais <span className="font-bold text-white">{nivelCliente.comprasFaltando}</span> compras para desbloquear o status <span className="text-primary font-bold">{nextLevel}</span>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

