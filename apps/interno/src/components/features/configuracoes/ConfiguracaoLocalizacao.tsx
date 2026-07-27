import { useEffect, useState } from 'react'
import { MapPin, Trash2, Plus } from 'lucide-react'
import { Card, Button, Input } from '../../ui'
import { useToast } from '../../ui/Toast'
import { useCep } from '../../../hooks/useCep'
import { getCoordinates } from '../../../utils/geocoding'
import { configuracoesService } from '../../../services/configuracoesService'
import type { LocalPartida } from '../../../types/domain'

// Bloco self-contained: dono do próprio estado + persistência (add/remove salvam na hora
// via configuracoesService — auto-save por ação é o modelo certo pra uma lista).
export function ConfiguracaoLocalizacao() {
    const toast = useToast()
    const { fetchCep } = useCep()
    const [locais, setLocais] = useState<LocalPartida[]>([])
    const [novoLocalNome, setNovoLocalNome] = useState('')
    const [novoLocalEndereco, setNovoLocalEndereco] = useState('')
    const [addingLocal, setAddingLocal] = useState(false)

    useEffect(() => {
        configuracoesService.getLocais().then(setLocais).catch(() => { /* silencioso */ })
    }, [])

    const handleEnderecoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setNovoLocalEndereco(value)
        const cleanValue = value.replace(/\D/g, '')
        if (cleanValue.length === 8) {
            const addressData = await fetchCep(cleanValue)
            if (addressData) {
                setNovoLocalEndereco(`${addressData.street}, , ${addressData.neighborhood}, ${addressData.city} - ${addressData.state}`)
                toast.success('Endereço completado pelo CEP!')
            }
        }
    }

    const handleAddLocal = async () => {
        if (!novoLocalNome || !novoLocalEndereco) {
            toast.error('Preencha nome e endereço')
            return
        }
        setAddingLocal(true)
        try {
            const coords = await getCoordinates(novoLocalEndereco)
            if (!coords) {
                toast.error('Endereço não encontrado')
                return
            }
            const novo: LocalPartida = {
                id: crypto.randomUUID(),
                nome: novoLocalNome,
                endereco: novoLocalEndereco,
                lat: coords.lat,
                lng: coords.lng,
            }
            const updated = [...locais, novo]
            setLocais(updated)
            await configuracoesService.salvarLocais(updated)
            setNovoLocalNome('')
            setNovoLocalEndereco('')
            toast.success('Local adicionado e salvo!')
        } catch {
            toast.error('Erro ao adicionar local. Tente novamente.')
        } finally {
            setAddingLocal(false)
        }
    }

    const handleRemoveLocal = async (id: string) => {
        const updated = locais.filter(l => l.id !== id)
        setLocais(updated)
        try {
            await configuracoesService.salvarLocais(updated)
            toast.success('Local removido!')
        } catch {
            toast.error('Erro ao remover local. Tente novamente.')
        }
    }

    return (
        <Card className="lg:col-span-2">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Locais de Partida</h3>
                        <p className="text-sm text-muted-foreground">Pontos iniciais para rotas · salvam automaticamente</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {locais.map(local => (
                        <Card key={local.id} className="hover:shadow-md transition-all">
                            <div className="p-4 flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                                        <MapPin className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-foreground">{local.nome}</h4>
                                        <p className="text-sm text-muted-foreground mt-0.5">{local.endereco}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {local.lat.toFixed(4)}, {local.lng.toFixed(4)}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveLocal(local.id)}
                                    className="text-destructive hover:text-destructive/80 -mr-2 -mt-1"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </Card>
                    ))}

                    <div className="grid gap-2 border-t border-border pt-4">
                        <h4 className="text-sm font-medium text-foreground">Novo Local</h4>
                        <Input
                            label="Nome"
                            placeholder="Nome (Ex: Sede)"
                            value={novoLocalNome}
                            onChange={e => setNovoLocalNome(e.target.value)}
                            required
                        />
                        <div className="flex gap-2 items-end">
                            <Input
                                label="Endereço"
                                placeholder="Endereço completo ou CEP"
                                value={novoLocalEndereco}
                                onChange={handleEnderecoChange}
                                className="flex-1"
                                required
                            />
                            <Button
                                onClick={handleAddLocal}
                                disabled={addingLocal}
                                isLoading={addingLocal}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    )
}
