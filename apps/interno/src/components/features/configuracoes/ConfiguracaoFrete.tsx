import { useState, useEffect } from 'react'
import { Truck, Plus, Trash2, Save } from 'lucide-react'
import { Card, Input, Button } from '../../ui'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../ui/Toast'
import type { Json } from '@mont/shared'

interface FreteFaixa { ateKm: number; valorPorKm?: number; valorFixo?: number }
interface FreteConfig {
    modo: 'progressivo' | 'taxa_faixa' | 'valor_fixo'
    origem: { lat: number; lng: number; label?: string; cep?: string }
    faixas: FreteFaixa[]
    foraDoAlcance: 'a_combinar'
}

const DEFAULT_CONFIG: FreteConfig = {
    modo: 'valor_fixo',
    origem: { lat: -23.7205964, lng: -46.524444, label: 'Cozinha — Montanhão/SBC', cep: '09784-410' },
    faixas: [
        { ateKm: 30, valorFixo: 5 },
    ],
    foraDoAlcance: 'a_combinar',
}

const num = (v: string) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
}

export function ConfiguracaoFrete() {
    const toast = useToast()
    const [config, setConfig] = useState<FreteConfig>(DEFAULT_CONFIG)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        supabase.from('configuracoes').select('valor').eq('chave', 'frete_config').maybeSingle()
            .then(({ data }) => {
                if (data?.valor) setConfig(data.valor as unknown as FreteConfig)
                setLoading(false)
            })
    }, [])

    const updateFaixa = (i: number, patch: Partial<FreteFaixa>) =>
        setConfig(c => ({ ...c, faixas: c.faixas.map((f, idx) => idx === i ? { ...f, ...patch } : f) }))
    const addFaixa = () => setConfig(c => ({ ...c, faixas: [...c.faixas, c.modo === 'valor_fixo' ? { ateKm: 0, valorFixo: 0 } : { ateKm: 0, valorPorKm: 0 }] }))
    const removeFaixa = (i: number) => setConfig(c => ({ ...c, faixas: c.faixas.filter((_, idx) => idx !== i) }))

    const handleSave = async () => {
        setSaving(true)
        try {
            // Grava SÓ os valores do modo ativo — a config nunca carrega os dois modelos
            // juntos (sem fallback de um pro outro).
            const faixas: FreteFaixa[] = [...config.faixas]
                .sort((a, b) => a.ateKm - b.ateKm)
                .map(f => config.modo === 'valor_fixo'
                    ? { ateKm: f.ateKm, valorFixo: f.valorFixo ?? 0 }
                    : { ateKm: f.ateKm, valorPorKm: f.valorPorKm ?? 0 })
            const ordered: FreteConfig = { ...config, faixas }
            const { error } = await supabase.from('configuracoes')
                .upsert({ chave: 'frete_config', valor: ordered as unknown as Json }, { onConflict: 'chave' })
            if (error) throw error
            setConfig(ordered)
            toast.success('Frete salvo!')
        } catch {
            toast.error('Erro ao salvar o frete')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card className="lg:col-span-2">
            <div className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Frete por distância</h3>
                        <p className="text-sm text-muted-foreground">Faixas por distância de rota — frete fixo por faixa ou por km, usado no catálogo</p>
                    </div>
                </div>

                {loading ? (
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : (
                    <>
                        {/* Origem (ponto de saída) */}
                        <div className="space-y-2">
                            <span className="text-sm font-bold text-foreground">Origem (cozinha)</span>
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Latitude"
                                    type="number"
                                    step="any"
                                    value={config.origem.lat}
                                    onChange={e => setConfig(c => ({ ...c, origem: { ...c.origem, lat: num(e.target.value) } }))}
                                />
                                <Input
                                    label="Longitude"
                                    type="number"
                                    step="any"
                                    value={config.origem.lng}
                                    onChange={e => setConfig(c => ({ ...c, origem: { ...c.origem, lng: num(e.target.value) } }))}
                                />
                            </div>
                            {config.origem.label && (
                                <p className="text-xs text-muted-foreground">{config.origem.label}{config.origem.cep ? ` · CEP ${config.origem.cep}` : ''}</p>
                            )}
                        </div>

                        {/* Modelo de cobrança */}
                        <div className="space-y-2">
                            <span className="text-sm font-bold text-foreground">Modelo de cobrança</span>
                            <div className="flex gap-2">
                                <Button
                                    variant={config.modo === 'valor_fixo' ? 'primary' : 'outline'}
                                    size="sm"
                                    onClick={() => setConfig(c => ({ ...c, modo: 'valor_fixo' }))}
                                >
                                    Valor fixo
                                </Button>
                                <Button
                                    variant={config.modo !== 'valor_fixo' ? 'primary' : 'outline'}
                                    size="sm"
                                    onClick={() => setConfig(c => ({ ...c, modo: 'progressivo' }))}
                                >
                                    Por km
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {config.modo === 'valor_fixo'
                                    ? 'Cada faixa cobra um valor fechado (ex.: até 3 km = R$ 5).'
                                    : 'Cada trecho de km é cobrado pela taxa da sua faixa (progressivo).'}
                            </p>
                        </div>

                        {/* Faixas */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-foreground">Faixas</span>
                                <Button variant="outline" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={addFaixa}>
                                    Faixa
                                </Button>
                            </div>
                            {config.faixas.map((f, i) => (
                                <div key={i} className="flex items-end gap-2">
                                    <Input
                                        label="Até (km)"
                                        type="number"
                                        step="0.1"
                                        value={f.ateKm}
                                        onChange={e => updateFaixa(i, { ateKm: num(e.target.value) })}
                                    />
                                    {config.modo === 'valor_fixo' ? (
                                        <Input
                                            label="R$ (fixo)"
                                            type="number"
                                            step="0.01"
                                            value={f.valorFixo ?? 0}
                                            onChange={e => updateFaixa(i, { valorFixo: num(e.target.value) })}
                                        />
                                    ) : (
                                        <Input
                                            label="R$ / km"
                                            type="number"
                                            step="0.01"
                                            value={f.valorPorKm ?? 0}
                                            onChange={e => updateFaixa(i, { valorPorKm: num(e.target.value) })}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeFaixa(i)}
                                        className="mb-1 flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                                        aria-label="Remover faixa"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <p className="text-xs text-muted-foreground">Acima da última faixa, o frete é combinado pelo WhatsApp.</p>
                        </div>

                        <Button variant="primary" leftIcon={<Save className="h-4 w-4" />} onClick={handleSave} isLoading={saving}>
                            Salvar frete
                        </Button>
                    </>
                )}
            </div>
        </Card>
    )
}
