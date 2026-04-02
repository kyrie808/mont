import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes (data remains "fresh")
            gcTime: 1000 * 60 * 10, // 10 minutes (unused data is garbage collected)
            refetchOnWindowFocus: false, // Prevents excessive refetching on window switch
            retry: 1, // Retry failed requests once
        },
    },
})
