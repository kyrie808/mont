import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Shield, Lock, User, ArrowRight, Loader2 } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'

export function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()
    const toast = useToast()

    const from = location.state?.from?.pathname || '/'
    const shouldReduceMotion = useReducedMotion()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password) {
            toast.error('Preencha todos os campos')
            return
        }

        setIsLoading(true)
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                if (error.message === 'Invalid login credentials') {
                    toast.error('Credenciais inválidas')
                } else {
                    toast.error(error.message)
                }
                return
            }

            toast.success('Bem-vindo de volta!')
            navigate(from, { replace: true })
        } catch {
            toast.error('Ocorreu um erro ao realizar o login')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-dvh w-full flex items-center justify-center bg-background text-foreground">

                {/* Decorative elements - subtle as in Dashboard */}
                <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-elevated" />

                <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={shouldReduceMotion ? false : { opacity: 1, y: 0 }}
                    className="w-full max-w-[400px] px-6"
                >
                    {/* Logo / Header */}
                    <div className="flex flex-col items-center mb-12">
                        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-elevated mb-6">
                            <Shield className="w-8 h-8 text-black" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
                            Mont Distribuidora
                        </h1>
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">
                            Acesso Restrito
                        </p>
                    </div>

                    {/* Login Form - Simple Card style as in Dashboard widgets */}
                    <div className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl p-8 shadow-sm">
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="login-email" className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                                    E-mail
                                </label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                                    <input
                                        id="login-email"
                                        type="email"
                                        placeholder="comandante@mont.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none font-display"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="login-password" className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                                    Senha
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                                    <input
                                        id="login-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none font-display"
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-primary hover:opacity-90 text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 group border-none shadow-sm h-auto"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Entrar
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </div>

                    <div className="mt-12 text-center">
                        <p className="text-gray-400 dark:text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">
                            Gestão Comercial & Logística
                        </p>
                    </div>
                </motion.div>
        </div>
    )
}
