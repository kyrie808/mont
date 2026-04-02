import { useState, useEffect } from 'react'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Spinner } from '../../ui/Spinner'
import { Save, Search } from 'lucide-react'
import { useProdutos } from '../../../hooks/useProdutos'
import { supabase } from '../../../lib/supabase'

interface ProductNicknamesModalProps {
    isOpen: boolean
    onClose: () => void
}

export function ProductNicknamesModal({ isOpen, onClose }: ProductNicknamesModalProps) {
    const { produtos, loading: loadingProdutos, refetch } = useProdutos()
    const [searchTerm, setSearchTerm] = useState('')
    const [nicknames, setNicknames] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)

    // Initialize nicknames state when products load
    useEffect(() => {
        if (produtos.length > 0) {
            const initial: Record<string, string> = {}
            produtos.forEach(p => {
                initial[p.id] = p.apelido || ''
            })
            setNicknames(initial)
        }
    }, [produtos])

    const handleNicknameChange = (id: string, value: string) => {
        setNicknames(prev => ({ ...prev, [id]: value }))
    }

    const filteredProducts = produtos.filter(p =>
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.codigo && p.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const handleSave = async () => {
        setSaving(true)
        try {
            // Bulk update seems tricky with single query in standard Supabase client without RPC
            // For now, we'll iterate. If performance is an issue, we can create an RPC.
            // Only update modified ones?

            const updates = produtos
                .filter(p => nicknames[p.id] !== (p.apelido || ''))
                .map(p => ({
                    id: p.id,
                    apelido: nicknames[p.id] || null
                }))

            if (updates.length === 0) {
                onClose()
                return
            }

            // Using Promise.all for now. Parallel updates.
            await Promise.all(updates.map(update =>
                supabase
                    .from('produtos')
                    .update({ apelido: update.apelido })
                    .eq('id', update.id)
            ))

            await refetch() // Refresh global state
            onClose()
        } catch (error) {
            console.error('Error saving nicknames:', error)
            alert('Erro ao salvar apelidos.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Configurar Apelidos de Produtos"
            size="lg"
        >
            <div className="space-y-4 max-h-[70vh] flex flex-col">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                </div>

                <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg">
                    {loadingProdutos ? (
                        <div className="flex justify-center py-8">
                            <Spinner />
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Produto</th>
                                    <th className="px-4 py-3 w-32">Apelido (Sigla)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredProducts.map(product => (
                                    <tr key={product.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2">
                                            <div className="font-medium text-gray-900">{product.nome}</div>
                                            <div className="text-xs text-gray-500">{product.unidade}</div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={nicknames[product.id] || ''}
                                                onChange={(e) => handleNicknameChange(product.id, e.target.value)}
                                                placeholder="Ex: B"
                                                className="h-8 text-center uppercase font-bold"
                                                maxLength={3}
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {filteredProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={2} className="text-center py-8 text-gray-500">
                                            Nenhum produto encontrado
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <Button variant="ghost" onClick={onClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={saving || loadingProdutos}>
                        {saving ? 'Salvando...' : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Salvar Configurações
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
