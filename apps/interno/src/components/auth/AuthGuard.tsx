import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface AuthGuardProps {
    children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
    const { user, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-neo border-t-transparent"></div>
                    <p className="font-display font-medium text-gray-500 animate-pulse">Carregando...</p>
                </div>
            </div>
        )
    }

    if (!user) {
        // Redirect to login but save the current location they were trying to access
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}
