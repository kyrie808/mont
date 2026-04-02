
import { useNavigate } from 'react-router-dom'
import { Building2, User, BadgeCheck, MessageCircle, ShoppingCart, Target, Edit } from 'lucide-react'
import { Header } from '../../../../components/layout/Header'
import { Button } from '../../../../components/ui'
import { cn } from '@mont/shared'
import { getWhatsAppLink } from '@mont/shared'
import type { DomainContato } from '../../../../types/domain'

interface ContatoHeroProps {
    contato: DomainContato
    nivel: string
    onEdit: () => void
}

export function ContatoHero({ contato, nivel, onEdit }: ContatoHeroProps) {
    const navigate = useNavigate()
    const AvatarIcon = contato.tipo === 'B2B' ? Building2 : User
    const isGold = nivel === 'ouro'
    const isSilver = nivel === 'prata'

    const handleWhatsApp = () => {
        window.open(getWhatsAppLink(contato.telefone), '_blank')
    }

    return (
        <>
            <Header
                title="Perfil do Cliente"
                showBack
                className="sticky top-0 z-30"
                rightAction={
                    <button aria-label="Editar contato" onClick={onEdit} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-foreground transition-colors">
                        <Edit className="h-5 w-5" />
                    </button>
                }
            />

            <div className="flex flex-col items-center animate-fade-in pt-4">
                <div className="relative mb-4 group cursor-pointer">
                    <div className={cn(
                        "flex items-center justify-center w-28 h-28 rounded-full border-4 shadow-xl transition-transform group-hover:scale-105",
                        isGold ? "bg-gradient-to-br from-yellow-400 to-amber-600 border-yellow-300/50" :
                            isSilver ? "bg-gradient-to-br from-slate-300 to-slate-500 border-slate-300/50" :
                                "bg-gradient-to-br from-violet-600 to-indigo-600 border-violet-400/30"
                    )}>
                        <AvatarIcon className="h-12 w-12 text-white drop-shadow-md" />
                    </div>
                    {/* Verified Badge - Only for active 'Cliente' */}
                    {contato.status === 'cliente' && (
                        <div className="absolute bottom-0 right-0 bg-violet-600 p-1.5 rounded-full border-[3px] border-background shadow-md z-10" title="Cliente Verificado">
                            <BadgeCheck className="h-4 w-4 text-white" />
                        </div>
                    )}
                </div>

                <h1 className="text-2xl font-bold text-center text-foreground tracking-tight mb-1">
                    {contato.nome} {contato.apelido && <span className="text-muted-foreground font-medium text-lg ml-2">● ({contato.apelido})</span>}
                </h1>

                {contato.indicador && (
                    <div className="flex items-center gap-1.5 text-xs text-orange-500 font-bold uppercase tracking-wider mb-2">
                        <Target className="w-3 h-3" />
                        Indicado por: {contato.indicador.nome}
                    </div>
                )}

                <div className="flex items-center gap-2 mb-6">
                    <span className={cn(
                        "text-sm font-medium tracking-wide uppercase",
                        isGold ? "text-yellow-500" : isSilver ? "text-gray-400" : "text-violet-400"
                    )}>
                        MEMBRO {nivel.toUpperCase()}
                    </span>
                    <span className="w-1 h-1 bg-gray-600 rounded-full" />
                    <span className="text-sm text-gray-500">Desde {new Date(contato.criadoEm).getFullYear()}</span>
                </div>

                {/* Primary Actions */}
                <div className="flex w-full gap-3 max-w-sm px-4">
                    <Button
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold border-0 shadow-lg shadow-primary/25 transition-all hover:scale-[1.02]"
                        leftIcon={<MessageCircle className="h-4 w-4" />}
                        onClick={handleWhatsApp}
                    >
                        WhatsApp
                    </Button>
                    <Button
                        className="flex-1 bg-white hover:bg-gray-50 text-gray-900 font-bold border-0 shadow-lg shadow-black/5 transition-all hover:scale-[1.02]"
                        leftIcon={<ShoppingCart className="h-4 w-4" />}
                        onClick={() => navigate('/nova-venda', { state: { contatoId: contato.id } })}
                    >
                        Nova Venda
                    </Button>
                </div>
            </div>
        </>
    )
}
