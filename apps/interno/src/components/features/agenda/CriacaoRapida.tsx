import { useMemo, useState } from 'react'
import { AlertTriangle, Search, X } from 'lucide-react'
import { cn, formatCurrency, formatPhone } from '@mont/shared'
import { Button, Modal, ModalActions, Tabs, TabsList, TabsTrigger } from '../../ui'
import { useToast } from '../../ui/Toast'
import { useBuscaClientesAgenda, useClienteAgenda, useLembreteMutations, useVendasEmAberto } from '../../../hooks/useAgenda'
import { useDebounce } from '../../../hooks/useDebounce'
import { novoLembreteSchema, RESPONSAVEIS, type Responsavel, type TipoLembrete } from '../../../schemas/agenda'
import { mensagemDeErro, NOME_FORMA, NOME_RESPONSAVEL } from '../../../utils/agenda'
import type { ClienteAgenda } from '../../../services/agendaService'

/** O que pode chegar preenchido (clique no dia, "Criar retorno" de um item de camada). */
export interface PrefillLembrete {
    data: string
    tipo?: TipoLembrete
    titulo?: string
    contato?: { id: string; nome: string; telefone: string } | null
    vendaId?: string | null
}

interface CriacaoRapidaProps {
    aberto: boolean
    prefill: PrefillLembrete
    onFechar: () => void
}

/** As abas do Google ("Evento / Tarefa") viram os tipos do lembrete. */
const ABAS: Array<{ id: TipoLembrete; rotulo: string }> = [
    { id: 'cobranca', rotulo: 'Cobrança' },
    { id: 'parcela', rotulo: 'Parcela' },
    { id: 'pendencia_interna', rotulo: 'Pendência' },
    { id: 'retorno_comercial', rotulo: 'Retorno comercial' },
]

const campo =
    'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

function diaMes(d: string): string {
    return `${d.slice(8, 10)}/${d.slice(5, 7)}`
}

export function CriacaoRapida({ aberto, prefill, onFechar }: CriacaoRapidaProps) {
    // Remonta o formulário a cada abertura: o prefill de um clique não vaza para o próximo.
    if (!aberto) return null
    return <Formulario prefill={prefill} onFechar={onFechar} />
}

function Formulario({ prefill, onFechar }: { prefill: PrefillLembrete; onFechar: () => void }) {
    const toast = useToast()
    const { criar } = useLembreteMutations()

    const [titulo, setTitulo] = useState(prefill.titulo ?? '')
    const [tipo, setTipo] = useState<TipoLembrete>(prefill.tipo ?? 'cobranca')
    const [data, setData] = useState(prefill.data)
    const [hora, setHora] = useState('')
    const [cliente, setCliente] = useState<Pick<ClienteAgenda, 'id' | 'nome' | 'telefone'> | null>(prefill.contato ?? null)
    const [vendaId, setVendaId] = useState<string | null>(prefill.vendaId ?? null)
    const [responsavel, setResponsavel] = useState<Responsavel | null>(null)
    const [valor, setValor] = useState('')
    const [descricao, setDescricao] = useState('')
    const [maisOpcoes, setMaisOpcoes] = useState(false)
    const [erro, setErro] = useState<string | null>(null)

    const [busca, setBusca] = useState('')
    const buscaAtrasada = useDebounce(busca, 250)
    const { data: resultados = [], isFetching: buscando } = useBuscaClientesAgenda(cliente ? '' : buscaAtrasada)
    const { data: vendas = [] } = useVendasEmAberto(cliente?.id ?? null)

    // "Não cobrar" vem do cadastro do cliente escolhido (lido pelo id, venha da busca ou de um item).
    const { data: cadastro } = useClienteAgenda(cliente?.id ?? null)
    const cobrancaSuspensa = cadastro?.cobranca_suspensa === true

    // Venda escolhida que não está (mais) em aberto não vale (enquanto a lista carrega, fica a do prefill).
    const vendaEscolhida = vendaId && (vendas.length === 0 || vendas.some((v) => v.id === vendaId)) ? vendaId : null

    const cobraDinheiro = tipo === 'cobranca' || tipo === 'parcela'
    const temFiadoAberto = useMemo(
        () => vendas.some((v) => v.forma_pagamento === 'fiado' && v.status === 'entregue'),
        [vendas],
    )

    const salvar = async () => {
        setErro(null)
        const valorNumero = tipo === 'parcela' && valor.trim() ? Number(valor.replace(',', '.')) : null
        const r = novoLembreteSchema.safeParse({
            titulo,
            data,
            hora: hora || null,
            tipo,
            descricao: descricao.trim() || null,
            contato_id: cliente?.id ?? null,
            venda_id: vendaEscolhida,
            responsavel,
            valor: valorNumero,
        })
        if (!r.success) {
            setErro(r.error.issues[0]?.message ?? 'Confira os campos')
            return
        }
        try {
            await criar.mutateAsync(r.data)
            toast.success('Lembrete criado')
            onFechar()
        } catch (e) {
            setErro(mensagemDeErro(e, 'Não deu para criar o lembrete'))
        }
    }

    return (
        <Modal isOpen onClose={onFechar} title="Novo lembrete" size="lg">
            <form
                className="space-y-4"
                onSubmit={(e) => { e.preventDefault(); void salvar() }}
            >
                <input
                    autoFocus
                    aria-label="Título"
                    placeholder="Adicionar título"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="w-full border-0 border-b-2 border-input bg-transparent pb-2 text-xl text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:outline-none"
                />

                <Tabs value={tipo} onValueChange={(v) => { const aba = ABAS.find((a) => a.id === v); if (aba) setTipo(aba.id) }}>
                    <TabsList>
                        {ABAS.map((a) => <TabsTrigger key={a.id} value={a.id}>{a.rotulo}</TabsTrigger>)}
                    </TabsList>
                </Tabs>

                <div className="grid grid-cols-[1fr_8rem] gap-3">
                    <label className="space-y-1 text-sm">
                        <span className="text-muted-foreground">Data</span>
                        <input type="date" required value={data} onChange={(e) => setData(e.target.value)} className={campo} />
                    </label>
                    <label className="space-y-1 text-sm">
                        <span className="text-muted-foreground">Hora (opcional)</span>
                        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
                    </label>
                </div>

                {/* Cliente */}
                <div className="space-y-1 text-sm">
                    <span className="text-muted-foreground">Cliente (opcional)</span>
                    {cliente ? (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                            <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{cliente.nome}</p>
                                {cliente.telefone && <p className="text-xs text-muted-foreground">{formatPhone(cliente.telefone)}</p>}
                            </div>
                            <button
                                type="button"
                                aria-label="Tirar cliente"
                                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => { setCliente(null); setVendaId(null); setBusca('') }}
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                aria-label="Buscar cliente"
                                placeholder="Nome, apelido ou telefone"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                className={cn(campo, 'pl-9')}
                            />
                            {busca.trim().length >= 2 && (
                                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-elevated">
                                    {resultados.length === 0 ? (
                                        <p className="px-3 py-2 text-muted-foreground">{buscando ? 'Buscando…' : 'Nenhum cliente'}</p>
                                    ) : resultados.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => { setCliente(c); setBusca('') }}
                                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
                                        >
                                            <span className="truncate text-foreground">{c.nome}</span>
                                            <span className="shrink-0 text-xs text-muted-foreground">{formatPhone(c.telefone)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {cliente && cobrancaSuspensa && cobraDinheiro && (
                    <p className="flex items-start gap-2 rounded-lg border border-warning-strong/30 bg-warning-strong/10 px-3 py-2 text-sm text-foreground">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-strong" />
                        Cobrança suspensa para este cliente.
                    </p>
                )}

                {cliente && tipo === 'retorno_comercial' && temFiadoAberto && (
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-warning-strong/30 bg-warning-strong/10 px-3 py-2 text-sm text-foreground">
                        <p className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-strong" />
                            Este cliente tem fiado em aberto. Melhor um lembrete de cobrança.
                        </p>
                        <button type="button" className="shrink-0 font-semibold text-warning-strong hover:underline" onClick={() => setTipo('cobranca')}>
                            Mudar para cobrança
                        </button>
                    </div>
                )}

                {cliente && (
                    <label className="block space-y-1 text-sm">
                        <span className="text-muted-foreground">Venda em aberto (opcional)</span>
                        <select value={vendaEscolhida ?? ''} onChange={(e) => setVendaId(e.target.value || null)} className={campo}>
                            <option value="">Nenhuma</option>
                            {vendas.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {diaMes(v.data)} · {NOME_FORMA[v.forma_pagamento] ?? v.forma_pagamento} · {formatCurrency(v.emAberto)} em aberto
                                    {v.data_prevista_pagamento ? ` · vence ${diaMes(v.data_prevista_pagamento)}` : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                {tipo === 'parcela' && (
                    <label className="block space-y-1 text-sm">
                        <span className="text-muted-foreground">Valor da parcela (R$)</span>
                        <input
                            inputMode="decimal"
                            placeholder="32,50"
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            className={cn(campo, 'tabular-nums')}
                        />
                    </label>
                )}

                <div className="space-y-1 text-sm">
                    <span className="text-muted-foreground">Responsável</span>
                    <div className="flex gap-2" role="group" aria-label="Responsável">
                        {RESPONSAVEIS.map((r) => (
                            <button
                                key={r}
                                type="button"
                                aria-pressed={responsavel === r}
                                onClick={() => setResponsavel(responsavel === r ? null : r)}
                                className={cn(
                                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                                    responsavel === r
                                        ? 'border-primary bg-primary/15 font-semibold text-foreground'
                                        : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                            >
                                {NOME_RESPONSAVEL[r]}
                            </button>
                        ))}
                    </div>
                </div>

                {maisOpcoes ? (
                    <label className="block space-y-1 text-sm">
                        <span className="text-muted-foreground">Descrição</span>
                        <textarea
                            rows={3}
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </label>
                ) : null}

                {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

                <ModalActions>
                    {!maisOpcoes && (
                        <Button type="button" variant="link" size="sm" className="mr-auto" onClick={() => setMaisOpcoes(true)}>
                            Mais opções
                        </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={onFechar}>Cancelar</Button>
                    <Button type="submit" size="sm" isLoading={criar.isPending}>Salvar</Button>
                </ModalActions>
            </form>
        </Modal>
    )
}
