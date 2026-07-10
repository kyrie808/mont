import { Loader2 } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { EntregasPage } from './pages/EntregasPage'

export default function App() {
    const { session, loading } = useAuth()

    if (loading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
        )
    }

    return session ? <EntregasPage /> : <LoginPage />
}
