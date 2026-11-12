'use client'

import { useRef, useState } from 'react'
import { cn } from '@mont/shared'
import { FaixaEsgotado, fotoEsgotada } from '@/components/Esgotado'
import { Foto } from '@/components/Foto'

interface GaleriaFotosProps {
    /** Capa primeiro. Vazia = o retângulo de "sem foto". */
    fotos: string[]
    alt: string
    /** Largura aproximada em px no celular, para o next/image escolher o tamanho. */
    largura: number
    /** Altura e cantos (a largura é a do container). */
    className: string
    prioridade?: boolean
    /** Esgotado: fotos em cinza e a faixa "ESGOTADO" por cima (wireframe Esgotado). */
    esgotado?: boolean
}

/**
 * Fotos do produto. Com uma foto (ou nenhuma), é a foto de sempre. Com mais, desliza com o dedo
 * (rolagem nativa com encaixe, sem biblioteca) e os pontinhos mostram a posição e levam a cada foto.
 */
export function GaleriaFotos({ fotos, alt, largura, className, prioridade = false, esgotado = false }: GaleriaFotosProps) {
    const trilho = useRef<HTMLDivElement>(null)
    const [atual, setAtual] = useState(0)

    if (fotos.length <= 1) {
        if (!esgotado) {
            return <Foto url={fotos[0] ?? null} alt={alt} largura={largura} prioridade={prioridade} className={cn('shrink-0', className)} />
        }
        return (
            <div className={cn('relative shrink-0 overflow-hidden', className)}>
                <Foto url={fotos[0] ?? null} alt={alt} largura={largura} prioridade={prioridade} className={cn('h-full w-full', fotoEsgotada)} />
                <FaixaEsgotado tamanho="pagina" />
            </div>
        )
    }

    const aoRolar = () => {
        const el = trilho.current
        if (!el || el.clientWidth === 0) return
        setAtual(Math.min(fotos.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))))
    }
    const irPara = (i: number) => {
        const el = trilho.current
        if (!el) return
        const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollTo({ left: i * el.clientWidth, behavior: suave ? 'smooth' : 'auto' })
    }

    return (
        <div className="flex shrink-0 flex-col gap-2">
            {/* A faixa fica fora do trilho (não rola com as fotos), recortada pelo mesmo canto. */}
            <div className={cn('relative overflow-hidden', esgotado && className)}>
                <div
                    ref={trilho}
                    onScroll={aoRolar}
                    role="group"
                    aria-roledescription="galeria"
                    aria-label={`Fotos de ${alt}`}
                    className={cn(
                        'flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                        className,
                    )}
                >
                    {fotos.map((url, i) => (
                        <div
                            key={url}
                            role="group"
                            aria-roledescription="foto"
                            aria-label={`${i + 1} de ${fotos.length}`}
                            className="h-full w-full shrink-0 snap-center"
                        >
                            <Foto
                                url={url}
                                alt={i === 0 ? alt : `${alt}, foto ${i + 1}`}
                                largura={largura}
                                prioridade={prioridade && i === 0}
                                className={cn('h-full w-full', esgotado && fotoEsgotada)}
                            />
                        </div>
                    ))}
                </div>
                {esgotado && <FaixaEsgotado tamanho="pagina" />}
            </div>
            <div className="flex justify-center">
                {fotos.map((url, i) => (
                    <button
                        key={url}
                        type="button"
                        onClick={() => irPara(i)}
                        aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
                        aria-current={i === atual ? 'true' : undefined}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center"
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'h-2 rounded-full transition-[width,background-color] duration-200',
                                i === atual ? 'w-5 bg-marrom' : 'w-2 bg-tracejado',
                            )}
                        />
                    </button>
                ))}
            </div>
        </div>
    )
}
