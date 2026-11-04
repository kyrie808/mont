import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ImagePlus, Star, X } from 'lucide-react'
import { cn } from '@mont/shared'
import { useToast } from '../../ui/Toast'
import { produtoService } from '../../../services/produtoService'
import { MAXIMO_FOTOS, moverFoto, tornarCapa, vagasNaGaleria } from '../../../utils/galeriaFotos'

interface GaleriaFotosProdutoProps {
    produtoId: string
}

/**
 * Fotos do produto na edição: adicionar várias, arrastar para mudar a ordem, "Tornar capa" e remover.
 * A 1ª é a capa (card da loja, prévia do link, listas do sistema). Cada mudança grava na hora,
 * numa transação (RPC salvar_fotos_produto); se falhar, a tela volta ao que estava gravado.
 */
export function GaleriaFotosProduto({ produtoId }: GaleriaFotosProdutoProps) {
    const toast = useToast()
    const queryClient = useQueryClient()
    const entrada = useRef<HTMLInputElement>(null)
    const [fotos, setFotos] = useState<string[]>([])
    const [carregando, setCarregando] = useState(true)
    const [enviando, setEnviando] = useState(0)
    const [salvando, setSalvando] = useState(false)

    useEffect(() => {
        let ativo = true
        setCarregando(true)
        produtoService
            .getFotos(produtoId)
            .then((lista) => ativo && setFotos(lista))
            .catch(() => ativo && toast.error('Não consegui carregar as fotos do produto'))
            .finally(() => ativo && setCarregando(false))
        return () => {
            ativo = false
        }
        // toast é estável; recarrega só ao trocar de produto.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [produtoId])

    const sensores = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const gravar = async (nova: string[], removidas: string[] = []) => {
        const anterior = fotos
        setFotos(nova)
        setSalvando(true)
        try {
            await produtoService.salvarFotos(produtoId, nova)
            queryClient.invalidateQueries({ queryKey: ['produtos'] })
            void produtoService.apagarArquivosDeFotos(removidas)
            return true
        } catch (erro) {
            console.error('[Galeria] Erro ao salvar as fotos:', erro)
            setFotos(anterior)
            toast.error(erro instanceof Error ? `Fotos não salvas: ${erro.message}` : 'Fotos não salvas. Tente de novo.')
            return false
        } finally {
            setSalvando(false)
        }
    }

    const adicionar = async (arquivos: FileList | null) => {
        const lista = [...(arquivos ?? [])]
        if (entrada.current) entrada.current.value = ''
        if (lista.length === 0) return
        const cabem = lista.slice(0, vagasNaGaleria(fotos))
        if (cabem.length < lista.length) toast.error(`No máximo ${MAXIMO_FOTOS} fotos por produto`)
        if (cabem.length === 0) return

        setEnviando(cabem.length)
        const novas: string[] = []
        try {
            for (const arquivo of cabem) {
                novas.push(await produtoService.uploadImage(arquivo))
                setEnviando((n) => n - 1)
            }
        } catch (erro) {
            const mensagem = erro instanceof Error ? erro.message : ''
            if (mensagem.includes('maximum allowed size')) toast.error('Imagem muito grande. O limite é 5MB.')
            else if (mensagem.includes('mime type')) toast.error('Formato não suportado. Use PNG, JPG ou WebP.')
            else toast.error(`Erro no envio: ${mensagem || 'tente de novo.'}`)
        } finally {
            setEnviando(0)
        }
        if (novas.length === 0) return
        if (await gravar([...fotos, ...novas])) {
            toast.success(novas.length === 1 ? 'Foto adicionada' : `${novas.length} fotos adicionadas`)
        } else {
            void produtoService.apagarArquivosDeFotos(novas)
        }
    }

    const remover = (url: string) => {
        if (!confirm('Remover esta foto do produto?')) return
        void gravar(
            fotos.filter((f) => f !== url),
            [url],
        )
    }

    const aoSoltar = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return
        void gravar(moverFoto(fotos, fotos.indexOf(String(active.id)), fotos.indexOf(String(over.id))))
    }

    const ocupado = salvando || enviando > 0

    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
                <label className="block text-sm font-medium">Fotos do produto</label>
                <span className="text-xs text-muted-foreground">
                    {fotos.length}/{MAXIMO_FOTOS}
                </span>
            </div>
            <p className="text-xs text-muted-foreground">
                A 1ª é a capa (card da loja e prévia do link). Arraste pela alça para mudar a ordem.
            </p>

            {carregando ? (
                <p className="text-xs text-muted-foreground">Carregando fotos…</p>
            ) : (
                <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
                    <SortableContext items={fotos} strategy={rectSortingStrategy}>
                        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                            {fotos.map((url, i) => (
                                <FotoArrastavel
                                    key={url}
                                    url={url}
                                    posicao={i}
                                    total={fotos.length}
                                    desabilitado={ocupado}
                                    onTornarCapa={() => void gravar(tornarCapa(fotos, url))}
                                    onRemover={() => remover(url)}
                                />
                            ))}
                            {vagasNaGaleria(fotos) > 0 && (
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => entrada.current?.click()}
                                        disabled={ocupado}
                                        className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/40 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-60"
                                    >
                                        <ImagePlus className="size-5" />
                                        {enviando > 0 ? `Enviando ${enviando}…` : 'Adicionar'}
                                    </button>
                                </li>
                            )}
                        </ul>
                    </SortableContext>
                </DndContext>
            )}

            <input
                ref={entrada}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => void adicionar(e.target.files)}
                className="hidden"
                aria-label="Escolher fotos do produto"
            />
            {salvando && <p className="text-xs text-muted-foreground">Salvando…</p>}
        </div>
    )
}

interface FotoArrastavelProps {
    url: string
    posicao: number
    total: number
    desabilitado: boolean
    onTornarCapa: () => void
    onRemover: () => void
}

function FotoArrastavel({ url, posicao, total, desabilitado, onTornarCapa, onRemover }: FotoArrastavelProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: url,
        disabled: desabilitado,
    })
    const capa = posicao === 0

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                'relative aspect-square overflow-hidden rounded-lg border bg-muted',
                capa ? 'border-primary' : 'border-border',
                isDragging && 'z-10 opacity-60',
            )}
        >
            <img src={url} alt={`Foto ${posicao + 1} de ${total}`} className="size-full object-cover" />

            {capa && (
                <span className="absolute bottom-1 left-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    Capa
                </span>
            )}

            <button
                type="button"
                {...attributes}
                {...listeners}
                className="absolute top-1 left-1 flex size-8 cursor-grab touch-none items-center justify-center rounded-md bg-background/85 text-foreground shadow-card active:cursor-grabbing"
                aria-label={`Arrastar a foto ${posicao + 1} para mudar a ordem`}
            >
                <GripVertical className="size-4" />
            </button>

            <button
                type="button"
                onClick={onRemover}
                disabled={desabilitado}
                className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-md bg-background/85 text-destructive shadow-card disabled:opacity-60"
                aria-label={`Remover a foto ${posicao + 1}`}
            >
                <X className="size-4" />
            </button>

            {!capa && (
                <button
                    type="button"
                    onClick={onTornarCapa}
                    disabled={desabilitado}
                    className="absolute right-1 bottom-1 flex h-8 items-center gap-1 rounded-md bg-background/85 px-2 text-[11px] font-semibold text-foreground shadow-card disabled:opacity-60"
                    aria-label={`Tornar a foto ${posicao + 1} a capa`}
                >
                    <Star className="size-3.5" />
                    Capa
                </button>
            )}
        </li>
    )
}
