import { useState } from 'react'
import { Truck, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
    const { signIn } = useAuth()
    const [email, setEmail] = useState('')
    const [senha, setSenha] = useState('')
    const [erro, setErro] = useState<string | null>(null)
    const [carregando, setCarregando] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErro(null)
        setCarregando(true)
        try {
            await signIn(email.trim(), senha)
        } catch {
            setErro('E-mail ou senha inválidos.')
        } finally {
            setCarregando(false)
        }
    }

    return (
        <div className="flex min-h-dvh items-center justify-center bg-slate-900 px-6">
            <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
                <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500">
                        <Truck className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-xl font-black text-white">Entregas · Mont</h1>
                    <p className="mt-1 text-sm text-slate-400">Acesse com seu login de entregador.</p>
                </div>

                <div className="space-y-3">
                    <input
                        type="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoComplete="username"
                        placeholder="E-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
                    />
                    <input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Senha"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
                    />
                </div>

                {erro && <p className="text-center text-sm font-medium text-red-400">{erro}</p>}

                <button
                    type="submit"
                    disabled={carregando}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-bold text-white active:scale-95 disabled:opacity-60"
                >
                    {carregando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                    Entrar
                </button>
            </form>
        </div>
    )
}
