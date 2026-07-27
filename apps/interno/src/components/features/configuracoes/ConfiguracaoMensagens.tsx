import { useEffect, useState } from 'react'
import { MessageSquare, Save } from 'lucide-react'
import { Card, Button } from '../../ui'
import { useToast } from '../../ui/Toast'
import { configuracoesService } from '../../../services/configuracoesService'

interface Props {
    initial: string
    onSaved?: () => void
}

export function ConfiguracaoMensagens({ initial, onSaved }: Props) {
    const toast = useToast()
    const [mensagemRecompra, setMensagemRecompra] = useState(initial)
    const [saving, setSaving] = useState(false)

    useEffect(() => { setMensagemRecompra(initial) }, [initial])

    const dirty = mensagemRecompra !== initial

    const salvar = async () => {
        setSaving(true)
        try {
            await configuracoesService.salvarMensagem(mensagemRecompra)
            toast.success('Mensagem salva!')
            onSaved?.()
        } catch {
            toast.error('Erro ao salvar mensagem')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card>
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Mensagem de Recompra</h3>
                        <p className="text-sm text-muted-foreground">Template para WhatsApp</p>
                    </div>
                </div>

                <label htmlFor="mensagem-recompra" className="sr-only">
                    Mensagem de Recompra
                </label>
                <textarea
                    id="mensagem-recompra"
                    value={mensagemRecompra}
                    onChange={(e) => setMensagemRecompra(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    placeholder="Olá {{nome}}! Faz {{dias}} dias..."
                />

                <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">Variáveis:</span>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{nome}}'}</code>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{dias}}'}</code>
                </div>

                {/* Preview Live */}
                {mensagemRecompra && (
                    <div className="mt-4 p-4 bg-muted/50 dark:bg-muted/20 rounded-lg border-l-4 border-l-primary">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Preview:</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                            {mensagemRecompra
                                .replace(/\{\{nome\}\}/g, 'João Silva')
                                .replace(/\{\{dias\}\}/g, '15')}
                        </p>
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <Button variant="primary" leftIcon={<Save className="h-4 w-4" />} onClick={salvar} isLoading={saving} disabled={!dirty}>
                        Salvar
                    </Button>
                </div>
            </div>
        </Card>
    )
}
