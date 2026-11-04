import { useState, useEffect } from 'react'
import { Truck, Plus, Trash2, Save } from 'lucide-react'
import { Card, Input, Button } from '../../ui'
import { useToast } from '../../ui/Toast'
import { configuracoesService, FRETE_CONFIG_DEFAULT, type BairroFixo, type FreteConfig, type FreteFaixa } from '../../../services/configuracoesService'
import { prepararBairrosFixos } from '../../../utils/freteBairros'

const num = (v: string) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
}

export function ConfiguracaoFrete() {
    const toast = useToast()
    const [config, setConfig] = useState<FreteConfig>(FRETE_CONFIG_DEFAULT)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        configuracoesService.getFrete()
            .then(setConfig)
            .catch(() => { /* usa o default */ })
            .finally(() => setLoading(false))
    }, [])

    const updateFaixa = (i: number, patch: Partial<FreteFaixa>) =>
        setConfig(c => ({ ...c, faixas: c.faixas.map((f, idx) => idx === i ? { ...f, ...patch } : f) }))
    const addFaixa = () => setConfig(c => ({ ...c, faixas: [...c.faixas, c.modo === 'valor_fixo' ? { ateKm: 0, valorFixo: 0 } : { ateKm: 0, valorPorKm: 0 }] }))
    const removeFaixa = (i: number) => setConfig(c => ({ ...c, faixas: c.faixas.filter((_, idx) => idx !== i) }))

    const bairros = config.bairrosFixos ?? []
    const updateBairro = (i: number, patch: Partial<BairroFixo>) =>
        setConfig(c => ({ ...c, bairrosFixos: (c.bairrosFixos ?? []).map((b, idx) => idx === i ? { ...b, ...patch } : b) }))
    const addBairro = () => setConfig(c => ({ ...c, bairrosFixos: [...(c.bairrosFixos ?? []), { bairro: '', cidade: 'São Paulo', valor: 0 }] }))
    const removeBairro = (i: number) => setConfig(c => ({ ...c, bairrosFixos: (c.bairrosFixos ?? []).filter((_, idx) => idx !== i) }))

    const handleSave = async () => {
        const preparados = prepararBairrosFixos(config.bairrosFixos ?? [])
        if (!preparados.ok) {
            toast.error(preparados.erro)
            return
        }
        setSaving(true)
        try {
            // Grava SÓ os valores do modo ativo — a config nunca carrega os dois modelos
            // juntos (sem fallback de um pro outro).
            const faixas: FreteFaixa[] = [...config.faixas]
                .sort((a, b) => a.ateKm - b.ateKm)
                .map(f => config.modo === 'valor_fixo'
                    ? { ateKm: f.ateKm, valorFixo: f.valorFixo ?? 0 }
                    : { ateKm: f.ateKm, valorPorKm: f.valorPorKm ?? 0 })
            const ordered: FreteConfig = { ...config, faixas, bairrosFixos: preparados.bairros }
            await configuracoesService.salvarFrete(ordered)
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

                        {/* Bairros com valor fixo: antes da distância (depois do ABC) */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-foreground">Bairros com valor fixo</span>
                                <Button variant="outline" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={addBairro}>
                                    Bairro
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Valem antes da distância, pelo bairro e cidade do CEP (sem diferença de acento ou maiúscula).
                                {config.regiaoFixa && ` ${config.regiaoFixa.nome} continua ${formatCurrency(config.regiaoFixa.valor)} pela cidade.`}
                            </p>
                            {bairros.length === 0 && (
                                <p className="text-sm text-muted-foreground">Nenhum bairro com valor fixo.</p>
                            )}
                            {bairros.map((b, i) => (
                                <div key={i} className="grid grid-cols-2 items-end gap-2 lg:grid-cols-[1fr_1fr_7rem_auto]">
                                    <Input
                                        label="Bairro"
                                        value={b.bairro}
                                        placeholder="Ex.: Interlagos"
                                        onChange={e => updateBairro(i, { bairro: e.target.value })}
                                    />
                                    <Input
                                        label="Cidade"
                                        value={b.cidade}
                                        onChange={e => updateBairro(i, { cidade: e.target.value })}
                                    />
                                    <Input
                                        label="R$ (fixo)"
                                        type="number"
                                        step="0.01"
                                        value={b.valor}
                                        onChange={e => updateBairro(i, { valor: num(e.target.value) })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeBairro(i)}
                                        className="mb-1 flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                                        aria-label={`Remover ${b.bairro || 'bairro'}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
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
