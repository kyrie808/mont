import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Award, Trash2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Button, PageSkeleton } from '../components/ui'
import { ContatoFormModal } from '../components/contatos'
import { useContato, useContatos } from '../hooks/useContatos'
import { useToast } from '../components/ui/Toast'
import { useVendas } from '../hooks/useVendas'
import { useIndicacoes } from '../hooks/useIndicacoes'
import { calcularNivelCliente } from '../utils/calculations'

// Refactored Sub-components
import { ContatoHero } from '../components/features/contatos/detalhe/ContatoHero'
import { ContatoIntel } from '../components/features/contatos/detalhe/ContatoIntel'
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
    const { vendas: vendasRaw } = useVendas({ excludeCatalogo: true })
    const { getIndicadorById } = useIndicacoes()

    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    if (loading) return <PageSkeleton rows={4} showHeader showCards={false} />
    if (error || !contato) return <> <Header title="Erro" showBack /><PageContainer><div className="text-red-500">Contato não encontrado</div></PageContainer> </>

    // Cálculo de nível para passar pro Hero
    const todasVendas = vendasRaw.filter(v => v.contatoId === id)
    const vendasValidas = todasVendas.filter(v => v.status !== 'cancelada')
    const indicadorInfo = getIndicadorById(id || '')
    const indicacoesConvertidas = indicadorInfo?.indicacoesConvertidas || 0
    const nivelCliente = calcularNivelCliente(vendasValidas.length, indicacoesConvertidas)

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
                    onEdit={() => setIsEditModalOpen(true)}
                />

                <PageContainer className="relative z-10 pt-4 px-4 space-y-6 bg-transparent pb-4">
                    
                    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                        <ContatoIntel contato={contato} />

                        {/* Notes Section */}
                        {contato.observacoes && (
                            <div className="flex items-start gap-4 p-5 bg-card border border-border rounded-xl shadow-sm">
                                <Award className="h-6 w-6 text-semantic-yellow shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                                        Observações
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                        {contato.observacoes}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <LoyaltyJourney 
                        contatoId={contato.id} 
                        isB2B={contato.tipo === 'B2B'} 
                    />

                    <CatalogOrdersHistory contatoId={contato.id} />

                    <VendasHistory contatoId={contato.id} />

                    {/* DANGER ZONE */}
                    <div className="pt-4 pb-0">
                        <Button
                            variant="ghost"
                            className="w-full text-red-500 hover:text-red-400 hover:bg-red-500/10"
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

                </PageContainer>
        </>
    )
}
