import { useEffect, useState } from 'react'

/**
 * Observa uma media query em JS.
 *
 * Por que existe: os ramos mobile (`lg:hidden`) e desktop (`hidden lg:block`) são
 * AMBOS renderizados — só um é escondido por CSS —, então os dois compartilham a
 * mesma busca de dados. Quando o desktop precisa buscar algo diferente do mobile
 * (ver `Vendas.tsx`: mês limpo no desktop vs. tudo em aberto no mobile), só dá pra
 * divergir sabendo o viewport em JS.
 *
 * Inicializa de forma SÍNCRONA (SPA client-only, sem SSR) → sem flash nem
 * duplo-fetch no primeiro render.
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

    useEffect(() => {
        const mql = window.matchMedia(query)
        // Ressincroniza caso a query mude entre renders.
        setMatches(mql.matches)

        const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
        mql.addEventListener('change', onChange)
        return () => mql.removeEventListener('change', onChange)
    }, [query])

    return matches
}
