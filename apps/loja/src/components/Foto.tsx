'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@mont/shared'

interface FotoProps {
    url: string | null
    alt: string
    /** Largura aproximada em px no celular: escolhe a versão leve (miniatura de 200 ou a de 800). */
    largura: number
    className?: string
    /** Variante escura (banner do topo). */
    escura?: boolean
    /** Foto principal acima da dobra (LCP): carrega já, sem esperar a rolagem. */
    prioridade?: boolean
}

/** Foto do storage do Supabase; sem foto, o retângulo tracejado do wireframe, vazio. */
export function Foto({ url, alt, largura, className, escura = false, prioridade = false }: FotoProps) {
    // Versão leve que não existe (ex.: foto recém-subida antes de ganhar as versões): cai no original,
    // mais pesado, mas nunca em branco.
    const [semVersaoLeve, setSemVersaoLeve] = useState<string | null>(null)

    if (!url) {
        return (
            <div
                aria-hidden="true"
                className={cn(
                    'shrink-0 border border-dashed',
                    escura ? 'border-texto-suave bg-marrom-medio' : 'border-tracejado bg-areia',
                    className,
                )}
            />
        )
    }
    const original = semVersaoLeve === url
    return (
        <div className={cn('relative shrink-0 overflow-hidden bg-areia', className)}>
            <Image
                key={original ? 'original' : 'leve'}
                src={url}
                alt={alt}
                fill
                sizes={`${largura}px`}
                priority={prioridade}
                unoptimized={original}
                onError={original ? undefined : () => setSemVersaoLeve(url)}
                className="object-cover"
            />
        </div>
    )
}
