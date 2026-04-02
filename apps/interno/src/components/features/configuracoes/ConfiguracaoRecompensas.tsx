import { DollarSign, Info } from 'lucide-react'
import { Card, Button, Input } from '../../ui'

interface ConfiguracaoRecompensasProps {
    recompensaValor: number
    setRecompensaValor: (val: number) => void
}

export function ConfiguracaoRecompensas({
    recompensaValor,
    setRecompensaValor
}: ConfiguracaoRecompensasProps) {
    return (
        <Card>
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-success" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recompensa por Indicação</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Valor por indicação convertida</p>
                    </div>
                </div>

                <div className="flex items-stretch gap-1">
                    <span className="text-gray-500 dark:text-gray-400 self-center">R$</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRecompensaValor(Math.max(0, recompensaValor - 0.5))}
                        className="px-2"
                    >
                        −
                    </Button>
                    <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={recompensaValor}
                        onChange={(e) => setRecompensaValor(Number(e.target.value))}
                        className="w-20 text-center"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRecompensaValor(recompensaValor + 0.5)}
                        className="px-2"
                    >
                        +
                    </Button>
                    <span className="text-sm text-gray-500 dark:text-gray-400 self-center ml-1">por cliente</span>
                </div>

                <div className="mt-3 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-muted p-2 rounded-lg">
                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <p>
                        Indicação só conta como convertida quando o indicado faz sua primeira compra.
                    </p>
                </div>
            </div>
        </Card>
    )
}
