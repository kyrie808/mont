import { Truck, MapPin, User } from 'lucide-react'
import type { DomainVenda } from '../../../types/domain'

interface VendaInfoEntregaProps {
    venda: DomainVenda
}

function formatarEndereco(c: DomainVenda['contato']): string {
    if (!c) return 'Endereço não informado'
    const linha = [c.logradouro, c.numero].filter(Boolean).join(', ')
    const partes = [
        linha || c.endereco,
        c.complemento,
        c.bairro,
        [c.cidade, c.uf].filter(Boolean).join(' - '),
    ].filter(Boolean)
    return partes.join(' · ') || 'Endereço não informado'
}

const STATUS: Record<string, { label: string; cls: string }> = {
    entregue: { label: 'Entregue', cls: 'bg-success/15 text-success' },
    pendente: { label: 'Pendente', cls: 'bg-warning-strong/15 text-warning-strong' },
    cancelada: { label: 'Cancelada', cls: 'bg-destructive/15 text-destructive' },
}

export function VendaInfoEntrega({ venda }: VendaInfoEntregaProps) {
    const st = STATUS[venda.status] ?? STATUS.pendente

    return (
        <div className="bg-card/80 backdrop-blur-md border border-border rounded-xl p-5 shadow-card mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-base font-medium text-foreground">
                    <Truck className="h-5 w-5 text-primary" /> Entrega
                </h3>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
            </div>
            <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-foreground">
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{venda.entregadorNome ?? 'Entregador não definido'}</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{formatarEndereco(venda.contato)}</span>
                </div>
            </div>
        </div>
    )
}
