import { Package, LayoutList, Wallet, ChevronRight, type LucideIcon } from 'lucide-react'
import { Card } from '../../ui'
import { useNavigate } from 'react-router-dom'

// Configurações que moram noutras telas (fragmentação): um hub honesto de atalhos.
const ATALHOS: { icon: LucideIcon; titulo: string; descricao: string; path: string }[] = [
    { icon: Package, titulo: 'Produtos', descricao: 'Cadastro: preço, custo, catálogo, combos', path: '/produtos' },
    { icon: LayoutList, titulo: 'Catálogo (seções da vitrine)', descricao: 'Abas da vitrine e ordem dos produtos', path: '/catalogo' },
    { icon: Wallet, titulo: 'Contas & Categorias', descricao: 'Em Fluxo de Caixa › aba "Contas & Categorias"', path: '/fluxo-caixa' },
]

export function ConfiguracaoLinks() {
    const navigate = useNavigate()

    return (
        <Card className="lg:col-span-2">
            <div className="p-6">
                <h3 className="font-semibold text-foreground mb-1">Atalhos de configuração</h3>
                <p className="text-sm text-muted-foreground mb-4">Ajustes que vivem em outras telas do sistema</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {ATALHOS.map((a) => {
                        const Icon = a.icon
                        return (
                            <button
                                key={a.path}
                                onClick={() => navigate(a.path)}
                                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-foreground/30 hover:bg-muted"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
                                        <Icon className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-foreground text-sm truncate">{a.titulo}</p>
                                        <p className="text-xs text-muted-foreground truncate">{a.descricao}</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </button>
                        )
                    })}
                </div>
            </div>
        </Card>
    )
}
