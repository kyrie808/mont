import { useEffect, useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { Card, Button, Input } from '../../ui'
import { useToast } from '../../ui/Toast'
import { configuracoesService } from '../../../services/configuracoesService'

interface Props {
    initial: { limiarReativacao: number; janelaRespostaHoras: number; cooldownRecusaDias: number }
    onSaved?: () => void
}

export function ConfiguracaoRelacionamento({ initial, onSaved }: Props) {
    const toast = useToast()
    const [limiarReativacao, setLimiarReativacao] = useState(initial.limiarReativacao)
    const [janelaResposta, setJanelaResposta] = useState(initial.janelaRespostaHoras)
    const [cooldownRecusa, setCooldownRecusa] = useState(initial.cooldownRecusaDias)
    const [saving, setSaving] = useState(false)

    // Re-semeia quando o config carrega/atualiza.
    useEffect(() => {
        setLimiarReativacao(initial.limiarReativacao)
        setJanelaResposta(initial.janelaRespostaHoras)
        setCooldownRecusa(initial.cooldownRecusaDias)
    }, [initial.limiarReativacao, initial.janelaRespostaHoras, initial.cooldownRecusaDias])

    const dirty =
        limiarReativacao !== initial.limiarReativacao ||
        janelaResposta !== initial.janelaRespostaHoras ||
        cooldownRecusa !== initial.cooldownRecusaDias

    const salvar = async () => {
        setSaving(true)
        try {
            await configuracoesService.salvarRelacionamento({
                limiarReativacao,
                janelaRespostaHoras: janelaResposta,
                cooldownRecusaDias: cooldownRecusa,
            })
            toast.success('Relacionamento salvo!')
            onSaved?.()
        } catch {
            toast.error('Erro ao salvar relacionamento')
        } finally {
            setSaving(false)
        }
    }

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

                <div className="mt-5">
                    <label htmlFor="janela-resposta" className="block text-sm font-medium text-foreground mb-1">
                        Janela para considerar contato "sem resposta"
                    </label>
                    <div className="flex items-stretch gap-1">
                        <Button variant="outline" size="sm" onClick={() => setJanelaResposta(Math.max(1, janelaResposta - 1))} className="px-2">−</Button>
                        <Input
                            id="janela-resposta"
                            type="number"
                            min={1}
                            max={168}
                            value={janelaResposta}
                            onChange={(e) => setJanelaResposta(Number(e.target.value))}
                            className="w-16 text-center"
                        />
                        <Button variant="outline" size="sm" onClick={() => setJanelaResposta(Math.min(168, janelaResposta + 1))} className="px-2">+</Button>
                        <span className="text-sm text-muted-foreground self-center ml-1">horas</span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                        Um contato registrado fica "Aguardando" até esse tempo. Passou sem retorno, vira "Sem resposta" (e o card volta pra fila de re-contato).
                    </p>
                </div>

                <div className="mt-5">
                    <label htmlFor="cooldown-recusa" className="block text-sm font-medium text-foreground mb-1">
                        Descanso após recusa (quarentena antes de reofertar)
                    </label>
                    <div className="flex items-stretch gap-1">
                        <Button variant="outline" size="sm" onClick={() => setCooldownRecusa(Math.max(1, cooldownRecusa - 1))} className="px-2">−</Button>
                        <Input
                            id="cooldown-recusa"
                            type="number"
                            min={1}
                            max={180}
                            value={cooldownRecusa}
                            onChange={(e) => setCooldownRecusa(Number(e.target.value))}
                            className="w-16 text-center"
                        />
                        <Button variant="outline" size="sm" onClick={() => setCooldownRecusa(Math.min(180, cooldownRecusa + 1))} className="px-2">+</Button>
                        <span className="text-sm text-muted-foreground self-center ml-1">dias</span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                        Quando o cliente recusa uma oferta, o card descansa na coluna "Recusou" por esse tempo. Depois volta para "A Contatar" (pode reofertar) — evita insistir logo após um não.
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
