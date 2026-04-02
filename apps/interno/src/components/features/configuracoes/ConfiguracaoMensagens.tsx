import { MessageSquare } from 'lucide-react'
import { Card } from '../../ui'

interface ConfiguracaoMensagensProps {
    mensagemRecompra: string
    setMensagemRecompra: (val: string) => void
}

export function ConfiguracaoMensagens({
    mensagemRecompra,
    setMensagemRecompra
}: ConfiguracaoMensagensProps) {
    return (
        <Card>
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Mensagem de Recompra</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Template para WhatsApp</p>
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
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    placeholder="Olá {{nome}}! Faz {{dias}} dias..."
                />

                <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Variáveis:</span>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{'{{nome}}'}</code>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{'{{dias}}'}</code>
                </div>

                {/* Preview Live */}
                {mensagemRecompra && (
                    <div className="mt-4 p-4 bg-muted/50 dark:bg-muted/20 rounded-lg border-l-4 border-l-primary">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Preview:</p>
                        <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                            {mensagemRecompra
                                .replace(/\{\{nome\}\}/g, 'João Silva')
                                .replace(/\{\{dias\}\}/g, '15')}
                        </p>
                    </div>
                )}
            </div>
        </Card>
    )
}
