import { useEffect, useState } from 'react'

/**
 * `true` quando o viewport é ≥ lg (1024px) — o mesmo breakpoint das utilities `lg:`.
 * Usado para montar SÓ UMA árvore de formulário por vez (mobile sagrado × desktop v2),
 * evitando registro duplicado de campo no react-hook-form.
 */
export function useIsDesktop(): boolean {
    const query = '(min-width: 1024px)'
    const [isDesktop, setIsDesktop] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(query).matches,
    )

    useEffect(() => {
        const mq = window.matchMedia(query)
        const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
        setIsDesktop(mq.matches)
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [])

    return isDesktop
}
