import { useState, type ReactNode } from 'react'
import { RefreshCw, DollarSign, MessageSquare, Truck, MapPin, ExternalLink, type LucideIcon } from 'lucide-react'
import { cn } from '@mont/shared'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { PageSkeleton } from '../components/ui'
import { useConfiguracoes } from '../hooks/useConfiguracoes'

// Sub-components (cada bloco se auto-salva; persistência via configuracoesService)
import { ConfiguracaoRelacionamento } from '../components/features/configuracoes/ConfiguracaoRelacionamento'
import { ConfiguracaoRecompensas } from '../components/features/configuracoes/ConfiguracaoRecompensas'
import { ConfiguracaoMensagens } from '../components/features/configuracoes/ConfiguracaoMensagens'
import { ConfiguracaoLocalizacao } from '../components/features/configuracoes/ConfiguracaoLocalizacao'
import { ConfiguracaoLinks } from '../components/features/configuracoes/ConfiguracaoLinks'
import { ConfiguracaoFrete } from '../components/features/configuracoes/ConfiguracaoFrete'

type SecaoId = 'relacionamento' | 'recompensas' | 'mensagens' | 'frete' | 'locais' | 'atalhos'

const SECOES: { id: SecaoId; label: string; icon: LucideIcon }[] = [
    { id: 'relacionamento', label: 'Relacionamento', icon: RefreshCw },
    { id: 'recompensas', label: 'Recompensas', icon: DollarSign },
    { id: 'mensagens', label: 'Mensagem de recompra', icon: MessageSquare },
    { id: 'frete', label: 'Frete por distância', icon: Truck },
    { id: 'locais', label: 'Locais de partida', icon: MapPin },
    { id: 'atalhos', label: 'Atalhos', icon: ExternalLink },
]

function SectionHeader({ children }: { children: ReactNode }) {
    return (
        <h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground pt-2">
            {children}
        </h2>
    )
}

export function Configuracoes() {
    const { config, loading, refetch } = useConfiguracoes()
    const [ativa, setAtiva] = useState<SecaoId>('relacionamento')

    // Reusado nos dois ramos (mobile empilha tudo; desktop mostra a seção ativa).
    const renderSecao = (id: SecaoId): ReactNode => {
        switch (id) {
            case 'relacionamento': return <ConfiguracaoRelacionamento initial={config.relacionamento} onSaved={refetch} />
            case 'recompensas': return <ConfiguracaoRecompensas initial={config.recompensaIndicacao.valor} onSaved={refetch} />
            case 'mensagens': return <ConfiguracaoMensagens initial={config.mensagemRecompra} onSaved={refetch} />
            case 'frete': return <ConfiguracaoFrete />
            case 'locais': return <ConfiguracaoLocalizacao />
            case 'atalhos': return <ConfiguracaoLinks />
        }
    }

    return (
        <>
            <Header title="Configurações" showBack centerTitle />
            <PageContainer className="pt-0 pb-24 bg-transparent px-4">
                {loading && <PageSkeleton rows={5} showHeader showCards />}

                {!loading && (
                    <>
                        {/* MOBILE (<lg): pilha de cards com grupos — intocado */}
                        <div className="space-y-4 text-foreground lg:hidden">
                            <SectionHeader>Relacionamento &amp; recompensas</SectionHeader>
                            <div className="space-y-6">
                                {renderSecao('relacionamento')}
                                {renderSecao('recompensas')}
                            </div>
                            <SectionHeader>Entregas &amp; frete</SectionHeader>
                            <div className="space-y-6">
                                {renderSecao('frete')}
                                {renderSecao('locais')}
                            </div>
                            <SectionHeader>Mensagens</SectionHeader>
                            {renderSecao('mensagens')}
                            <SectionHeader>Atalhos</SectionHeader>
                            {renderSecao('atalhos')}
                        </div>

                        {/* DESKTOP (≥lg): 2 painéis (nav + conteúdo contido) */}
                        <div className="hidden lg:flex lg:gap-8 text-foreground pt-2">
                            <nav className="w-60 shrink-0 space-y-1">
                                {SECOES.map((s) => {
                                    const Icon = s.icon
                                    const selected = ativa === s.id
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => setAtiva(s.id)}
                                            className={cn(
                                                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                                selected
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            )}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" />
                                            <span className="truncate">{s.label}</span>
                                        </button>
                                    )
                                })}
                            </nav>

                            <div className="min-w-0 max-w-2xl flex-1">
                                {renderSecao(ativa)}
                            </div>
                        </div>
                    </>
                )}
            </PageContainer>
        </>
    )
}
