import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Award, Trash2, UserPlus, Tag, MessageSquarePlus } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Button, PageSkeleton } from '../components/ui'
import { ContatoFormModal } from '../components/contatos'
import { IndicadosDetalhe } from '../components/dashboard/IndicadosDetalhe'
import { useContato, useContatos } from '../hooks/useContatos'
import { useToast } from '../components/ui/Toast'
import { useVendas } from '../hooks/useVendas'
import { useIndicacoes } from '../hooks/useIndicacoes'
import { useIndicadosDoIndicador } from '../hooks/useIndicadosDoIndicador'
import { useContatosResumo } from '../hooks/useContatosResumo'
import { calcularNivelCliente } from '../utils/calculations'
import { classificarContato } from '../utils/segmentoCliente'

// Refactored Sub-components
import { ContatoHero } from '../components/features/contatos/detalhe/ContatoHero'
import { ContatoIntel } from '../components/features/contatos/detalhe/ContatoIntel'
import { AquisicaoCard } from '../components/features/contatos/detalhe/AquisicaoCard'
import { ContatoInteracoes } from '../components/features/contatos/detalhe/ContatoInteracoes'
import { PerfilClienteRico } from '../components/relacionamento/PerfilClienteRico'
import { TagsSideSheet } from '../components/relacionamento/TagsSideSheet'
import { FeedbackSideSheet } from '../components/relacionamento/FeedbackSideSheet'
import { useKanbanRowContato } from '../hooks/usePerfilSideSheet'
import type { RelacionamentoStatus } from '../hooks/useRelacionamento'
import { LoyaltyJourney } from '../components/features/contatos/detalhe/LoyaltyJourney'
import { VendasHistory } from '../components/features/contatos/detalhe/VendasHistory'
import { CatalogOrdersHistory } from '../components/features/contatos/detalhe/CatalogOrdersHistory'
import { ContatoDeleteModal } from '../components/features/contatos/detalhe/ContatoDeleteModal'

export function ContatoDetalhe() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const toast = useToast()
    const { contato, loading, error, refetch } = useContato(id)
    const { deleteContato } = useContatos()
    const { vendas: vendasRaw } = useVendas({ excludeCatalogo: true, contatoId: id })
    const { getIndicadorById } = useIndicacoes()
    // Quem esta pessoa trouxe (drill-down por compra real; só renderiza se houver).
    const { indicados: indicadosDoContato } = useIndicadosDoIndicador(id ?? null)
    const resumoMap = useContatosResumo()
    const { data: kanbanRow } = useKanbanRowContato(id ?? null)
    const statusRel: RelacionamentoStatus = (kanbanRow?.status_relacionamento as RelacionamentoStatus) ?? 'a_contatar'

    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [tagsOpen, setTagsOpen] = useState(false)
    const [feedbackOpen, setFeedbackOpen] = useState(false)

    if (loading) return <PageSkeleton rows={4} showHeader showCards={false} />
    if (error || !contato) return <> <Header title="Erro" showBack /><PageContainer><div className="text-destructive">Contato não encontrado</div></PageContainer> </>

    // Cálculo de nível para passar pro Hero
    const vendasValidas = vendasRaw.filter(v => v.status !== 'cancelada')
    const indicadorInfo = getIndicadorById(id || '')
    const indicacoesConvertidas = indicadorInfo?.indicacoesConvertidas || 0
    const nivelCliente = calcularNivelCliente(vendasValidas.length, indicacoesConvertidas)
    const segmento = classificarContato(contato, resumoMap.get(contato.id))

    const handleDelete = async () => {
        setIsDeleting(true)
        const result = await deleteContato(contato.id)
        setIsDeleting(false)
        if (result.success) {
            toast.success('Contato excluído!')
            navigate('/contatos')
        } else {
            toast.error(result.error || 'Erro ao excluir contato')
        }
    }

    return (
        <>
            <ContatoHero
                    contato={contato}
                    nivel={nivelCliente.nivel}
                    segmento={segmento}
                    onEdit={() => setIsEditModalOpen(true)}
                />

                <PageContainer className="relative z-10 pt-4 px-4 lg:px-6 space-y-6 bg-transparent pb-4 mx-auto w-full lg:max-w-5xl">
                    
                    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                        <ContatoIntel contato={contato} />

                        {/* Notes Section */}
                        {contato.observacoes && (
                            <div className="flex items-start gap-4 p-5 bg-card border border-border rounded-xl shadow-card">
                                <Award className="h-6 w-6 text-semantic-yellow shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                                        Observações
                                    </p>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                        {contato.observacoes}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <AquisicaoCard contato={contato} />

                    {/* Painel rico do relacionamento (mesma fonte do kanban): tags, ritmo,
                        financeiro, fiado, última compra, produtos. Timeline fica no card abaixo. */}
                    <div className="p-5 bg-card border border-border rounded-xl shadow-card space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Relacionamento</h3>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTagsOpen(true)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                                >
                                    <Tag className="h-3.5 w-3.5" /> Tags
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFeedbackOpen(true)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                                >
                                    <MessageSquarePlus className="h-3.5 w-3.5" /> Feedback
                                </button>
                            </div>
                        </div>
                        <PerfilClienteRico contatoId={contato.id} showInteracoes={false} />
                    </div>

                    <ContatoInteracoes contatoId={contato.id} />

                    <LoyaltyJourney
                        contatoId={contato.id}
                        isB2B={contato.tipo === 'B2B'}
                    />

                    {/* Clientes que esta pessoa indicou (só aparece se trouxe alguém) */}
                    {indicadosDoContato.length > 0 && (
                        <div className="p-5 bg-card border border-border rounded-xl shadow-card">
                            <div className="flex items-center gap-2 mb-3">
                                <UserPlus className="h-5 w-5 text-primary shrink-0" />
                                <h3 className="text-sm font-bold text-foreground">
                                    Clientes que indicou ({indicadosDoContato.length})
                                </h3>
                            </div>
                            <IndicadosDetalhe indicadorId={contato.id} />
                        </div>
                    )}

                    <CatalogOrdersHistory contatoId={contato.id} />

                    <VendasHistory contatoId={contato.id} />

                    {/* DANGER ZONE */}
                    <div className="pt-4 pb-0">
                        <Button
                            variant="ghost"
                            className="w-full text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                            onClick={() => setIsDeleteModalOpen(true)}
                        >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir Contato
                        </Button>
                    </div>

                    {/* MODALS */}
                    <ContatoFormModal
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        contato={contato}
                        onSuccess={() => refetch()}
                    />

                    <ContatoDeleteModal
                        isOpen={isDeleteModalOpen}
                        onClose={() => setIsDeleteModalOpen(false)}
                        onConfirm={handleDelete}
                        isDeleting={isDeleting}
                        contato={contato}
                    />

                    <TagsSideSheet
                        isOpen={tagsOpen}
                        onClose={() => setTagsOpen(false)}
                        contatoId={contato.id}
                        nomeContato={contato.nome}
                        statusAtual={statusRel}
                    />

                    <FeedbackSideSheet
                        isOpen={feedbackOpen}
                        onClose={() => setFeedbackOpen(false)}
                        contatoId={contato.id}
                        nomeContato={contato.nome}
                        statusAtual={statusRel}
                    />

                </PageContainer>
        </>
    )
}
