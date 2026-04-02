
'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message || 'Credenciais inválidas. Verifique seu email e senha.')
            setLoading(false)
        } else {
            if (data.user?.user_metadata?.role !== 'admin') {
                await supabase.auth.signOut()
                setError('Acesso não autorizado.')
                setLoading(false)
                return
            }
            router.push('/admin')
            router.refresh()
        }
    }

    return (
        <div className="min-h-screen bg-mont-cream flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8 border border-mont-gold/20">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-24 h-24 relative mb-4">
                        {/* Placeholder for Logo if needed, otherwise just text for now or verify if logo exists */}
                        <div className="w-full h-full bg-mont-espresso rounded-full flex items-center justify-center text-mont-gold text-2xl font-serif font-bold border-2 border-mont-gold">
                            M
                        </div>
                    </div>
                    <h1 className="text-3xl font-serif text-mont-espresso font-bold text-center">
                        Mont Distribuidora
                    </h1>
                    <p className="text-mont-gray mt-2 text-sm uppercase tracking-wide">
                        Acesso Restrito
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-mont-espresso mb-1"
                        >
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-mont-gold focus:border-transparent transition-colors"
                            placeholder="admin@montdistribuidora.com"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-mont-espresso mb-1"
                        >
                            Senha
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-mont-gold focus:border-transparent transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-200">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-mont-gold text-mont-espresso font-bold py-3 px-4 rounded-md hover:bg-yellow-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mont-gold disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-sm"
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    )
}
