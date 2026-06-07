import { RefreshCw } from 'lucide-react'
import { Card, Button, Input } from '../../ui'

interface ConfiguracaoRelacionamentoProps {
    limiarReativacao: number
    setLimiarReativacao: (val: number) => void
}

export function ConfiguracaoRelacionamento({
    limiarReativacao,
    setLimiarReativacao,
}: ConfiguracaoRelacionamentoProps) {
    return (
        <Card>
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <RefreshCw className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Relacionamento</h3>
                        <p className="text-sm text-muted-foreground">Regras do kanban pós-venda</p>
                    </div>
                </div>

                <div>
                    <label htmlFor="limiar-reativacao" className="block text-sm font-medium text-foreground mb-1">
                        Prazo para reativar cliente novo (dias sem 2ª compra)
                    </label>
                    <div className="flex items-stretch gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLimiarReativacao(Math.max(7, limiarReativacao - 1))}
                            className="px-2"
                        >
                            −
                        </Button>
                        <Input
                            id="limiar-reativacao"
                            type="number"
                            min={7}
                            max={180}
                            value={limiarReativacao}
                            onChange={(e) => setLimiarReativacao(Number(e.target.value))}
                            className="w-16 text-center"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLimiarReativacao(Math.min(180, limiarReativacao + 1))}
                            className="px-2"
                        >
                            +
                        </Button>
                        <span className="text-sm text-muted-foreground self-center ml-1">dias</span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                        Dentro do prazo: cliente com 1 compra fica em Recompra (balde cheio, ainda consumindo). Após o prazo sem 2ª compra: migra para Reativação.
                    </p>
                </div>
            </div>
        </Card>
    )
}
