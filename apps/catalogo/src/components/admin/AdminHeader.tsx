
'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

interface AdminHeaderProps {
    userEmail?: string
}

export default function AdminHeader({ userEmail }: AdminHeaderProps) {
    const router = useRouter()
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/admin/login')
        router.refresh()
    }

    return (
        <header className="bg-mont-espresso text-mont-cream py-4 px-4 shadow-md sticky top-0 z-50">
            <div className="container mx-auto max-w-4xl flex justify-between items-center">
                <div>
                    <h1 className="font-serif font-bold text-xl text-mont-gold">
                        Mont Admin
                    </h1>
                    {userEmail && (
                        <p className="text-xs text-mont-cream/70 truncate max-w-[200px]">
                            {userEmail}
                        </p>
                    )}
                </div>

                <button
                    onClick={handleLogout}
                    className="text-mont-cream/80 hover:text-mont-gold transition-colors p-2"
                    aria-label="Sair"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </header>
    )
}
