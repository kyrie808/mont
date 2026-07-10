import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 2,
            gcTime: 1000 * 60 * 10,
            refetchOnWindowFocus: true, // no campo, reabrir o app deve trazer o estado fresco
            retry: 1,
        },
        // 'always': nunca pausa em silêncio quando offline (mesma lição da blindagem).
        mutations: { networkMode: 'always' },
    },
})
