import { useState, useEffect } from 'react'
import { Modal, ModalActions, Button, Input } from '../../ui'
import { useToast } from '../../ui/Toast'
import { formatCurrency, cn } from '@mont/shared'
import type { Conta } from '@mont/shared'

interface AjustarSaldoModalProps {
    isOpen: boolean
    conta: Conta | null
    onClose: () => void
    onSave: (contaId: string, saldoReal: number) => Promise<void>
}

export function AjustarSaldoModal({ isOpen, conta, onClose, onSave }: AjustarSaldoModalProps) {
    const toast = useToast()
    const [saldoReal, setSaldoReal] = useState(0)
    const [display, setDisplay] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    // Pré-preenche com o saldo atual (o usuário só muda o que difere da realidade).
    useEffect(() => {
        if (isOpen && conta) {
            const atual = conta.saldo_atual ?? 0
            setSaldoReal(atual)
            setDisplay(atual ? formatCurrency(atual) : '')
        }
    }, [isOpen, conta])

    // Máscara de centavos (mesmo padrão do LancamentoModal).
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value.replace(/\D/g, '')
        const n = Number(v) / 100
        setSaldoReal(n)
        setDisplay(v === '' ? '' : formatCurrency(n))
    }

    const atual = conta?.saldo_atual ?? 0
    const diff = Math.round((saldoReal - atual) * 100) / 100

    const handleConfirm = async () => {
        if (!conta) return
        try {
            setIsSaving(true)
            await onSave(conta.id, saldoReal)
            onClose()
        } catch {
            toast.error('Erro ao ajustar saldo')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajustar saldo (reconciliação)" size="sm">
            <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Conta</span>
                        <span className="font-bold text-foreground">{conta?.nome}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Saldo no sistema</span>
                        <span className="font-bold text-foreground tabular-nums">{formatCurrency(atual)}</span>
                    </div>
                </div>

                <Input
                    label="Saldo real (o que existe de fato)"
                    type="text"
                    inputMode="numeric"
                    value={display}
                    onChange={handleChange}
                    placeholder="R$ 0,00"
                />

                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">
                    <span className="text-muted-foreground">Ajuste que será lançado</span>
                    <span className={cn(
                        "font-black tabular-nums",
                        diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-success" : "text-destructive"
                    )}>
                        {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                    </span>
                </div>

                <p className="text-xs text-muted-foreground">
                    {diff === 0
                        ? 'O saldo já bate — nada será lançado.'
                        : `Será criado um lançamento de ${diff > 0 ? 'entrada' : 'saída'} de ${formatCurrency(Math.abs(diff))} (categoria "Ajuste de Saldo", fora de faturamento/lucro).`}
                </p>

                <ModalActions>
                    <Button variant="outline" onClick={onClose} type="button">
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} isLoading={isSaving} disabled={diff === 0}>
                        Confirmar ajuste
                    </Button>
                </ModalActions>
            </div>
        </Modal>
    )
}
