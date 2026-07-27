import type { ReactNode } from 'react'
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

function SectionHeader({ children }: { children: ReactNode }) {
    return (
        <h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground pt-2">
            {children}
        </h2>
    )
}

export function Configuracoes() {
    const { config, loading, refetch } = useConfiguracoes()

    return (
        <>
            <Header title="Configurações" showBack centerTitle />
            <PageContainer className="pt-0 pb-24 bg-transparent px-4">
                {loading && <PageSkeleton rows={5} showHeader showCards />}

                {!loading && (
                    <div className="space-y-4 text-foreground">
                        <SectionHeader>Relacionamento &amp; recompensas</SectionHeader>
                        <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
                            <ConfiguracaoRelacionamento initial={config.relacionamento} onSaved={refetch} />
                            <ConfiguracaoRecompensas initial={config.recompensaIndicacao.valor} onSaved={refetch} />
                        </div>

                        <SectionHeader>Entregas &amp; frete</SectionHeader>
                        <div className="space-y-6">
                            <ConfiguracaoFrete />
                            <ConfiguracaoLocalizacao />
                        </div>

                        <SectionHeader>Mensagens</SectionHeader>
                        <ConfiguracaoMensagens initial={config.mensagemRecompra} onSaved={refetch} />

                        <SectionHeader>Atalhos</SectionHeader>
                        <ConfiguracaoLinks />
                    </div>
                )}
            </PageContainer>
        </>
    )
}
