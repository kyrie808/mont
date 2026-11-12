'use client'

import type { ImageLoaderProps } from 'next/image'
import { carregarFoto } from './variantes'

/** Loader de todas as <Image> da loja (next.config: images.loaderFile). Ver ./variantes.ts. */
export default function loaderDaLoja({ src, width }: ImageLoaderProps): string {
    return carregarFoto({ src, width })
}
