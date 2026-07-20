import { useState, type FormEvent } from 'react'
import { Check, X, Plus } from 'lucide-react'
import { cn } from '@mont/shared'
import {
    useRegistrarPontoContato,
    useAtualizarPontoContato,
    useExcluirInteracao,
    type Canal,
    type ResultadoPontoContato,
    type Sentido,
    type Interacao,
} from '../../hooks/useInteracoes'
import { useCampanhas, useAplicarCampanha } from '../../hooks/useCampanhas'

const CANAL_OPTIONS: Array<{ value: Canal; label: string }> = [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'google', label: 'Google' },
    { value: 'outro', label: 'Outro' },
]

// Direção do registro: eu contatei (saída = tentativa/follow-up) ou o cliente respondeu (entrada).
const SENTIDO_OPTIONS: Array<{ value: Sentido; label: string }> = [
    { value: 'saida', label: 'Eu contatei' },
    { value: 'entrada', label: 'Cliente respondeu' },
]

// Resposta do cliente (só em entrada). "Aguardando"/"Sem resposta" e a cadência de
// follow-up são derivados no board — não são opção manual aqui.
const RESULTADO_PONTO_OPTIONS: Array<{ value: ResultadoPontoContato; label: string }> = [
    { value: 'respondeu', label: 'Respondeu' },
    { value: 'aceitou', label: 'Aceitou' },
    { value: 'recusou', label: 'Recusou' },
]

// datetime-local (yyyy-MM-ddTHH:mm) no horário local de São Paulo.
const nowLocalDateTime = () =>
    new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T').slice(0, 16)

const isoToLocalDateTime = (iso: string) =>
    new Date(iso).toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T').slice(0, 16)

interface RegistrarContatoFormProps {
    contatoId: string
    onClose: () => void
    /** Quando presente, o form abre em modo EDIÇÃO (pré-preenche + atualiza/exclui). */
    interacao?: Interacao
}

// Form de registro/edição de ponto de contato. Reutilizado no kanban
// (PerfilSideSheet), na timeline (InteracoesTimeline) e no perfil (ContatoDetalhe).
export function RegistrarContatoForm({ contatoId, onClose, interacao }: RegistrarContatoFormProps) {
    const isEdit = !!interacao
    const [sentido, setSentido] = useState<Sentido>(() => (interacao?.sentido as Sentido) ?? 'saida')
    const [canal, setCanal] = useState<Canal>(() => (interacao?.canal as Canal) ?? 'whatsapp')
    const [resultado, setResultado] = useState<ResultadoPontoContato>(() => {
        const r = interacao?.resultado
        return r === 'aceitou' || r === 'recusou' ? r : 'respondeu'
    })
    const [observacao, setObservacao] = useState(() => interacao?.observacao ?? '')
    const [data, setData] = useState(() => (interacao ? isoToLocalDateTime(interacao.data) : nowLocalDateTime()))

    // Campanha/oferta (promoção) — só no registro novo; ao salvar, cria a participação.
    const [campanhaId, setCampanhaId] = useState('')
    const [showNovaCampanha, setShowNovaCampanha] = useState(false)
    const [novaCampanha, setNovaCampanha] = useState('')
    const { data: campanhasPromo = [], criar: criarCampanha } = useCampanhas('promocao')
    const aplicarCampanha = useAplicarCampanha()

    const criar = useRegistrarPontoContato()
    const atualizar = useAtualizarPontoContato()
    const excluir = useExcluirInteracao()
    const isPending = criar.isPending || atualizar.isPending || excluir.isPending || criarCampanha.isPending
    const mutError = criar.error || atualizar.error || excluir.error || criarCampanha.error

    const handleCriarCampanha = async () => {
        try {
            const nova = await criarCampanha.mutateAsync(novaCampanha)
            setCampanhaId(nova.id)
            setNovaCampanha('')
            setShowNovaCampanha(false)
        } catch { /* erro exibido via mutError */ }
    }

    const isEntrada = sentido === 'entrada'

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        if (isPending) return
        // saída = eu contatei (sem resultado; pode levar oferta). entrada = cliente respondeu.
        const payload = {
            contatoId,
            canal,
            sentido,
            resultado: isEntrada ? resultado : null,
            observacao: observacao.trim() || undefined,
            data: new Date(data).toISOString(),
        }
        if (isEdit && interacao) {
            atualizar.mutate({ id: interacao.id, ...payload }, { onSuccess: onClose })
        } else {
            const campanha = isEntrada ? '' : campanhaId // oferta só em saída
            criar.mutate({ ...payload, campanhaId: campanha || undefined }, { onSuccess: () => {
                if (campanha) aplicarCampanha.mutate({ contatoId, campanhaId: campanha }) // resumo/chip
                setObservacao('')
                onClose()
            } })
        }
    }

    const handleExcluir = () => {
        if (!interacao || isPending) return
        excluir.mutate({ id: interacao.id, contatoId }, { onSuccess: onClose })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-3">
            {/* Quem falou? (direção) */}
            <div className="space-y-1.5">
                <p className="text-[10.5px] font-semibold text-muted-foreground/60">Quem falou?</p>
                <div className="grid grid-cols-2 gap-1.5">
                    {SENTIDO_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            disabled={isPending}
                            onClick={() => setSentido(opt.value)}
                            className={cn(
                                'rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50',
                                sentido === opt.value
                                    ? 'border-primary/40 bg-primary/15 text-primary'
                                    : 'border-border bg-foreground/3 text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Plataforma */}
            <div className="space-y-1.5">
                <p className="text-[10.5px] font-semibold text-muted-foreground/60">Plataforma</p>
                <select
                    value={canal}
                    onChange={(e) => setCanal(e.target.value as Canal)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-border bg-foreground/4 px-2.5 py-1.5 text-[12px] text-foreground outline-hidden focus:border-primary/40 disabled:opacity-50"
                >
                    {CANAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-card">
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Data e hora */}
            <div className="space-y-1.5">
                <p className="text-[10.5px] font-semibold text-muted-foreground/60">Data e hora</p>
                <input
                    type="datetime-local"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-border bg-foreground/4 px-2.5 py-1.5 text-[12px] text-foreground outline-hidden focus:border-primary/40 disabled:opacity-50"
                />
            </div>

            {/* Resposta — só quando o cliente respondeu (entrada) */}
            {isEntrada && (
            <div className="space-y-1.5">
                <p className="text-[10.5px] font-semibold text-muted-foreground/60">Resposta</p>
                <div className="flex flex-wrap gap-1.5">
                    {RESULTADO_PONTO_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            disabled={isPending}
                            onClick={() => setResultado(opt.value)}
                            className={cn(
                                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50',
                                resultado === opt.value
                                    ? 'border-primary/40 bg-primary/15 text-primary'
                                    : 'border-border bg-foreground/3 text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
            )}

            {/* Campanha/oferta (promoção) — só no registro novo de saída (eu contatei) */}
            {!isEdit && !isEntrada && (
                <div className="space-y-1.5">
                    <p className="text-[10.5px] font-semibold text-muted-foreground/60">Campanha/oferta (opcional)</p>
                    {showNovaCampanha ? (
                        <div className="flex items-center gap-1">
                            <input
                                autoFocus
                                value={novaCampanha}
                                onChange={(e) => setNovaCampanha(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleCriarCampanha() }
                                    if (e.key === 'Escape') { setShowNovaCampanha(false); setNovaCampanha('') }
                                }}
                                placeholder="Nome da campanha/oferta"
                                disabled={isPending}
                                className="w-full rounded-lg border border-border bg-foreground/4 px-2.5 py-1.5 text-[12px] text-foreground outline-hidden focus:border-primary/40 disabled:opacity-50"
                            />
                            <button type="button" onClick={handleCriarCampanha} disabled={isPending || !novaCampanha.trim()}
                                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary disabled:opacity-40" aria-label="Criar campanha">
                                <Check className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => { setShowNovaCampanha(false); setNovaCampanha('') }}
                                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground" aria-label="Cancelar">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <select
                                value={campanhaId}
                                onChange={(e) => setCampanhaId(e.target.value)}
                                disabled={isPending}
                                className="w-full rounded-lg border border-border bg-foreground/4 px-2.5 py-1.5 text-[12px] text-foreground outline-hidden focus:border-primary/40 disabled:opacity-50"
                            >
                                <option value="" className="bg-card">Nenhuma</option>
                                {campanhasPromo.map((c) => (
                                    <option key={c.id} value={c.id} className="bg-card">{c.nome}</option>
                                ))}
                            </select>
                            <button type="button" onClick={() => setShowNovaCampanha(true)} disabled={isPending}
                                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Nova campanha" title="Nova campanha/oferta">
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Nota */}
            <div className="space-y-1.5">
                <p className="text-[10.5px] font-semibold text-muted-foreground/60">Nota (opcional)</p>
                <textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    disabled={isPending}
                    placeholder="Detalhe o contato…"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-border bg-foreground/4 px-2.5 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/40 outline-hidden focus:border-primary/40 disabled:opacity-50"
                />
            </div>

            {mutError && <p className="text-[11px] text-destructive">{mutError.message}</p>}

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-primary/15 px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isPending ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Salvar'}
                </button>
                {isEdit && (
                    <button
                        type="button"
                        onClick={handleExcluir}
                        disabled={isPending}
                        className="rounded-lg px-3 py-1.5 text-[12px] text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
                    >
                        Excluir
                    </button>
                )}
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                    Cancelar
                </button>
            </div>
        </form>
    )
}
