import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { EntregasPage } from './pages/EntregasPage'
import { HistoricoPage } from './pages/HistoricoPage'
import { GanhosPage } from './pages/GanhosPage'
import { PerfilPage } from './pages/PerfilPage'
import { TabBar, type Tab } from './components/TabBar'

function AppShell() {
    const [tab, setTab] = useState<Tab>('entregas')
    return (
        <>
            {tab === 'entregas' && <EntregasPage />}
            {tab === 'historico' && <HistoricoPage />}
            {tab === 'ganhos' && <GanhosPage />}
            {tab === 'perfil' && <PerfilPage />}
            <TabBar active={tab} onChange={setTab} />
        </>
    )
}

export default function App() {
    const { session, loading } = useAuth()

    if (loading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
        )
    }

    return session ? <AppShell /> : <LoginPage />
}
