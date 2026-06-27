import { useState } from 'react'
import { MessageSquare, Plus } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { InteracoesTimeline } from '@/components/relacionamento/InteracoesTimeline'
import { RegistrarContatoForm } from '@/components/relacionamento/RegistrarContatoForm'

/**
 * Card de interações no perfil do cliente: histórico (timeline) + "Registrar
 * contato". Reutiliza os componentes do kanban; funciona para qualquer contato
 * (inclusive leads, que não aparecem no kanban de relacionamento).
 */
export function ContatoInteracoes({ contatoId }: { contatoId: string }) {
    const [open, setOpen] = useState(false)

    return (
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-5 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="h-5 w-5 text-primary shrink-0" />
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
                        Interações
                    </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="shrink-0">
                    <Plus className="h-4 w-4 mr-1.5" /> Registrar contato
                </Button>
            </div>

            <div className="max-h-[360px] overflow-y-auto no-scrollbar border-t border-border">
                <InteracoesTimeline contatoId={contatoId} />
            </div>

            <Modal isOpen={open} onClose={() => setOpen(false)} title="Registrar contato" size="sm">
                <RegistrarContatoForm contatoId={contatoId} onClose={() => setOpen(false)} />
            </Modal>
        </div>
    )
}
