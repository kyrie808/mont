
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingBag } from 'lucide-react'

export default function AdminNav() {
    const pathname = usePathname()

    const isActive = (path: string) => {
        return pathname === path || pathname.startsWith(`${path}/`)
    }

    const navItems = [
        {
            label: 'Dashboard',
            path: '/admin',
            icon: LayoutDashboard // Dashboard equivalent
        },
        {
            label: 'Produtos',
            path: '/admin/produtos',
            icon: Package // Product/Box equivalent
        },
        {
            label: 'Pedidos',
            path: '/admin/pedidos',
            icon: ShoppingBag // Shopping Bag/Orders equivalent
        }
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] md:hidden z-40">
            <div className="flex justify-around items-center">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors w-full ${isActive(item.path)
                                ? 'text-mont-gold bg-mont-gold/5'
                                : 'text-gray-400 hover:text-mont-espresso'
                            }`}
                    >
                        <item.icon
                            size={24}
                            strokeWidth={isActive(item.path) ? 2.5 : 2}
                        />
                        <span className="text-[10px] mt-1 font-medium tracking-wide uppercase">
                            {item.label}
                        </span>
                    </Link>
                ))}
            </div>
        </nav>
    )
}
