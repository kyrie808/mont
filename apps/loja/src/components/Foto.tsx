import Image from 'next/image'
import { cn } from '@mont/shared'

interface FotoProps {
    url: string | null
    alt: string
    /** Largura aproximada em px no celular, para o next/image escolher o tamanho. */
    largura: number
    className?: string
    /** Variante escura (banner do topo). */
    escura?: boolean
    /** Foto principal acima da dobra (LCP): carrega já, sem esperar a rolagem. */
    prioridade?: boolean
}

/** Foto do storage do Supabase; sem foto, o retângulo tracejado do wireframe, vazio. */
export function Foto({ url, alt, largura, className, escura = false, prioridade = false }: FotoProps) {
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
    return (
        <div className={cn('relative shrink-0 overflow-hidden bg-areia', className)}>
            <Image src={url} alt={alt} fill sizes={`${largura}px`} priority={prioridade} className="object-cover" />
        </div>
    )
}
