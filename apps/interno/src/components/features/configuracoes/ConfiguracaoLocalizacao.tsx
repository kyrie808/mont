import { MapPin, Trash2, Plus } from 'lucide-react'
import { Card, Button, Input } from '../../ui'

import type { LocalPartida } from '../../../types/domain'

interface ConfiguracaoLocalizacaoProps {
    locais: LocalPartida[]
    handleRemoveLocal: (id: string) => void
    novoLocalNome: string
    setNovoLocalNome: (val: string) => void
    novoLocalEndereco: string
    handleEnderecoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    handleAddLocal: () => void
    addingLocal: boolean
}

export function ConfiguracaoLocalizacao({
    locais,
    handleRemoveLocal,
    novoLocalNome,
    setNovoLocalNome,
    novoLocalEndereco,
    handleEnderecoChange,
    handleAddLocal,
    addingLocal
}: ConfiguracaoLocalizacaoProps) {
    return (
        <Card className="lg:col-span-2">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Locais de Partida</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pontos iniciais para rotas</p>
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
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100">{local.nome}</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{local.endereco}</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            {local.lat.toFixed(4)}, {local.lng.toFixed(4)}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveLocal(local.id)}
                                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 -mr-2 -mt-1"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </Card>
                    ))}

                    <div className="grid gap-2 border-t pt-4">
                        <h4 className="text-sm font-medium">Novo Local</h4>
                        <Input
                            label="Nome"
                            placeholder="Nome (Ex: Sede)"
                            value={novoLocalNome}
                            onChange={e => setNovoLocalNome(e.target.value)}
                            required
                        />
                        <div className="flex gap-2">
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
