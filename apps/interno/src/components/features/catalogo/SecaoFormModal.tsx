import { useState, useEffect } from 'react'
import { Modal, ModalActions, Button, Input, Select } from '../../ui'
import type { Secao } from '@mont/shared'

interface Props {
    isOpen: boolean
    onClose: () => void
    initial: Secao | null
    onSubmit: (values: { nome: string; ativa: boolean; descricao: string }) => Promise<void>
}

export function SecaoFormModal({ isOpen, onClose, initial, onSubmit }: Props) {
    const [nome, setNome] = useState('')
    const [ativa, setAtiva] = useState(true)
    const [descricao, setDescricao] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setNome(initial?.nome ?? '')
            setAtiva(initial?.ativa ?? true)
            setDescricao(initial?.descricao ?? '')
            setSaving(false)
        }
    }, [isOpen, initial])

    const submit = async () => {
        if (!nome.trim()) return
        setSaving(true)
        try {
            await onSubmit({ nome: nome.trim(), ativa, descricao })
            onClose()
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initial ? 'Editar seção' : 'Nova seção'} size="md">
            <div className="space-y-4">
                <Input
                    label="Nome da seção (aba do catálogo)"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Combos, Resfriados, Congelados"
                />
                <Input
                    label="Descrição na loja (opcional)"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex: Queijo Canastra de verdade. Parmesão e Meia Cura."
                    maxLength={120}
                    helperText="Aparece sob o título da seção na loja. Uma linha, até 120 caracteres."
                />
                {initial && (
                    <Select
                        label="Visível no catálogo"
                        value={ativa ? 'true' : 'false'}
                        onChange={(e) => setAtiva(e.target.value === 'true')}
                        options={[
                            { label: 'Sim', value: 'true' },
                            { label: 'Não', value: 'false' },
                        ]}
                    />
                )}
            </div>
            <ModalActions>
                <Button variant="secondary" onClick={onClose} disabled={saving}>
                    Cancelar
                </Button>
                <Button variant="primary" onClick={submit} isLoading={saving} disabled={!nome.trim()}>
                    {initial ? 'Salvar' : 'Criar'}
                </Button>
            </ModalActions>
        </Modal>
    )
}
