import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge de classes Tailwind (clsx + tailwind-merge) — padrão shadcn. */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
