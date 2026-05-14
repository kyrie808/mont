import { MapPin } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

interface OriginSelectorProps {
    locais: Array<{ endereco: string; tipo: string }>
    origin: string
    onOriginChange: (val: string) => void
    onAddressInput: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function OriginSelector({ locais, origin, onOriginChange, onAddressInput }: OriginSelectorProps) {
    const isCustomAddress = origin === '' || !locais.some(l => l.endereco === origin)

    return (
        <Card className="p-5 bg-card shadow-sm border border-border rounded-xl">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-semantic-green/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-semantic-green" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Ponto de Partida</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Sede, depósito ou localização atual</p>
                </div>
            </div>

            <select
                value={origin}
                onChange={(e) => onOriginChange(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            >
                {locais.map((loc, i) => (
                    <option key={i} value={loc.endereco}>
                        {loc.tipo === 'sede' ? '🏢' : loc.tipo === 'deposito' ? '📦' : '📍'} {loc.endereco}
                    </option>
                ))}
                <option value="">📍 Outro endereço...</option>
            </select>

            {isCustomAddress && (
                <div className="mt-3 space-y-2">
                    <Input
                        placeholder="Digite o endereço de partida ou CEP..."
                        value={origin}
                        onChange={onAddressInput}
                        className="w-full"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        💡 Digite um CEP de 8 dígitos para preenchimento automático
                    </p>
                </div>
            )}
        </Card>
    )
}
