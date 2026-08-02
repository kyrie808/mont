import { Search, User, Plus, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button, Modal, Input, ModalActions } from '../../../ui'
import { useContatos } from '../../../../hooks/useContatos'
import { useClientesSugeridos } from '../../../../hooks/useClientesSugeridos'
import { useToast } from '../../../../components/ui/Toast'
import { formatPhone } from '@mont/shared'
import { normalizarTelefone } from '../../../../utils/telefone'
import type { DomainContato } from '../../../../types/domain'

interface ClientSelectorProps {
    selectedContato: DomainContato | null
    onSelect: (contato: DomainContato | null) => void
}

const rowClass =
    'w-full px-4 py-3 bg-muted/50 rounded-lg text-left hover:bg-primary/10 transition-colors flex items-center justify-between gap-3 group'

export function ClientSelector({ selectedContato, onSelect }: ClientSelectorProps) {
    const [search, setSearch] = useState('')
    const [results, setResults] = useState<DomainContato[]>([])
    const [selecting, setSelecting] = useState(false)
    const { searchContatos, createContato, getContatoById } = useContatos()
    const { data: sugeridos = [] } = useClientesSugeridos(20)
    const toast = useToast()

    // Quick add state
    const [showQuickAdd, setShowQuickAdd] = useState(false)
    const [quickName, setQuickName] = useState('')
    const [quickPhone, setQuickPhone] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    // Search effect
    useEffect(() => {
        const doSearch = async () => {
            if (search.length >= 2) {
                const res = await searchContatos(search)
                setResults(res)
            } else {
                setResults([])
            }
        }
        const debounce = setTimeout(doSearch, 300)
        return () => clearTimeout(debounce)
    }, [search, searchContatos])

    // Sugestão só traz id+nome+stats → busca o contato completo antes de selecionar.
    const handleSelectSugerido = async (contatoId: string) => {
        setSelecting(true)
        const contato = await getContatoById(contatoId)
        setSelecting(false)
        if (contato) onSelect(contato)
    }

    const handleQuickAdd = async () => {
        if (!quickName || !quickPhone) {
            toast.error('Preencha nome e telefone')
            return
        }

        setIsCreating(true)
        const newContato = await createContato({
            nome: quickName,
            telefone: normalizarTelefone(quickPhone),
            tipo: 'B2C',
            status: 'lead',
            origem: 'direto',
        })
        setIsCreating(false)

        if (newContato) {
            onSelect(newContato)
            setShowQuickAdd(false)
            setQuickName('')
            setQuickPhone('')
            toast.success('Cliente cadastrado!')
        }
    }

    if (selectedContato) {
        return (
            <div className="bg-card p-4 rounded-xl border border-border shadow-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-foreground">{selectedContato.nome}</p>
                        <p className="text-sm text-muted-foreground">{formatPhone(selectedContato.telefone)}</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
                    Trocar
                </Button>
            </div>
        )
    }

    return (
        <>
            <div className="space-y-3">
                {/* Busca inline (sem modal) */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, apelido ou telefone…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-input rounded-lg focus:outline-hidden focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground/60"
                    />
                </div>

                {/* Cadastrar Novo (abre o modalzinho) */}
                <button
                    onClick={() => setShowQuickAdd(true)}
                    className="w-full py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                >
                    <Plus className="h-5 w-5" />
                    <span>Cadastrar Novo</span>
                </button>

                {/* Resultados da busca OU sugestões (rola pra revelar mais) */}
                <div className="max-h-[420px] overflow-y-auto no-scrollbar">
                {search.length >= 2 ? (
                    <div className="space-y-2">
                        {results.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente encontrado.</p>
                        ) : (
                            results.map((contato) => (
                                <button
                                    key={contato.id}
                                    onClick={() => onSelect(contato)}
                                    className={rowClass}
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium text-foreground group-hover:text-primary truncate">{contato.nome}</p>
                                        <p className="text-sm text-muted-foreground">{formatPhone(contato.telefone)}</p>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                                </button>
                            ))
                        )}
                    </div>
                ) : (
                    sugeridos.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                                Sugeridos · quem mais compra
                            </p>
                            {sugeridos.map((s) => (
                                <button
                                    key={s.contatoId}
                                    onClick={() => handleSelectSugerido(s.contatoId)}
                                    disabled={selecting}
                                    className={rowClass}
                                >
                                    <span className="font-medium text-foreground group-hover:text-primary truncate">{s.nome}</span>
                                    <span className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground tabular-nums">
                                        {s.totalCompras} {s.totalCompras === 1 ? 'compra' : 'compras'}
                                        <ChevronRight className="h-5 w-5" />
                                    </span>
                                </button>
                            ))}
                        </div>
                    )
                )}
                </div>
            </div>

            {/* Quick Add Modal */}
            <Modal
                isOpen={showQuickAdd}
                onClose={() => setShowQuickAdd(false)}
                title="Novo Cliente"
                size="sm"
            >
                <div className="space-y-4">
                    <Input
                        label="Nome"
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        placeholder="Nome do cliente"
                    />
                    <Input
                        label="Telefone"
                        value={quickPhone}
                        onChange={(e) => setQuickPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                    />
                </div>
                <ModalActions>
                    <Button variant="secondary" onClick={() => setShowQuickAdd(false)}>Cancelar</Button>
                    <Button onClick={handleQuickAdd} isLoading={isCreating}>Salvar</Button>
                </ModalActions>
            </Modal>
        </>
    )
}
