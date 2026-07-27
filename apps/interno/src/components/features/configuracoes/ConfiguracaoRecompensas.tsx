import { useEffect, useState } from 'react'
import { DollarSign, Info, Save } from 'lucide-react'
import { Card, Button, Input } from '../../ui'
import { useToast } from '../../ui/Toast'
import { configuracoesService } from '../../../services/configuracoesService'

interface Props {
    initial: number
    onSaved?: () => void
}

export function ConfiguracaoRecompensas({ initial, onSaved }: Props) {
    const toast = useToast()
    const [recompensaValor, setRecompensaValor] = useState(initial)
    const [saving, setSaving] = useState(false)

    useEffect(() => { setRecompensaValor(initial) }, [initial])

    const dirty = recompensaValor !== initial

    const salvar = async () => {
        setSaving(true)
        try {
            await configuracoesService.salvarRecompensa(recompensaValor)
            toast.success('Recompensa salva!')
            onSaved?.()
        } catch {
            toast.error('Erro ao salvar recompensa')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card>
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-success" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Recompensa por Indicação</h3>
                        <p className="text-sm text-muted-foreground">Valor por indicação convertida</p>
                    </div>
                </div>

                <div className="flex items-stretch gap-1">
                    <span className="text-muted-foreground self-center">R$</span>
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
                    <span className="text-sm text-muted-foreground self-center ml-1">por cliente</span>
                </div>

                <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted p-2 rounded-lg">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                        Indicação só conta como convertida quando o indicado faz sua primeira compra.
                    </p>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button variant="primary" leftIcon={<Save className="h-4 w-4" />} onClick={salvar} isLoading={saving} disabled={!dirty}>
                        Salvar
                    </Button>
                </div>
            </div>
        </Card>
    )
}
