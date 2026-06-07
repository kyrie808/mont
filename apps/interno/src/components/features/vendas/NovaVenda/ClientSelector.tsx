import { Search, User, Plus } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button, Badge, Modal, Input, ModalActions } from '../../../ui'
import { useContatos } from '../../../../hooks/useContatos'
import { useToast } from '../../../../components/ui/Toast'
import { formatPhone } from '@mont/shared'
import type { DomainContato } from '../../../../types/domain'

interface ClientSelectorProps {
    selectedContato: DomainContato | null
    onSelect: (contato: DomainContato | null) => void
}

export function ClientSelector({ selectedContato, onSelect }: ClientSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [results, setResults] = useState<DomainContato[]>([])
    const { contatos, searchContatos, createContato } = useContatos()
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

    const handleQuickAdd = async () => {
        if (!quickName || !quickPhone) {
            toast.error('Preencha nome e telefone')
            return
        }

        setIsCreating(true)
        const newContato = await createContato({
            nome: quickName,
            telefone: quickPhone.replace(/\D/g, ''),
            tipo: 'B2C',
            status: 'lead',
            origem: 'direto',
        })
        setIsCreating(false)

        if (newContato) {
            onSelect(newContato)
            setShowQuickAdd(false)
            setIsOpen(false)
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
            <div
                onClick={() => setIsOpen(true)}
                className="bg-card p-4 rounded-xl border-2 border-dashed border-border hover:border-primary cursor-pointer transition-colors flex items-center justify-center gap-2 text-muted-foreground group"
            >
                <User className="h-5 w-5 group-hover:text-primary" />
                <span className="group-hover:text-primary font-medium">Selecionar Cliente</span>
            </div>

            {/* Selection Modal */}
            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Selecionar Cliente"
                size="md"
            >
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, apelido ou telefone…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-input rounded-lg focus:outline-hidden focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground/60"
                            autoFocus
                        />
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {/* Quick Add Button in List */}
                        <button
                            onClick={() => setShowQuickAdd(true)}
                            className="w-full py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="h-5 w-5" />
                            <span>Cadastrar Novo</span>
                        </button>

                        {(search ? results : contatos.slice(0, 50)).map((contato) => (
                            <button
                                key={contato.id}
                                onClick={() => {
                                    onSelect(contato)
                                    setIsOpen(false)
                                }}
                                className="w-full px-4 py-3 bg-muted/50 rounded-lg text-left hover:bg-primary/10 transition-colors flex items-center justify-between group"
                            >
                                <div>
                                    <p className="font-medium text-foreground group-hover:text-primary">{contato.nome}</p>
                                    <p className="text-sm text-muted-foreground">{formatPhone(contato.telefone)}</p>
                                </div>
                                <Badge variant={contato.status === 'cliente' ? 'success' : 'warning'}>
                                    {contato.status === 'cliente' ? 'Cliente' : 'Lead'}
                                </Badge>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>

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
