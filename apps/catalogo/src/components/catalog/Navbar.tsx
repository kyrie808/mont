'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { cn } from '@mont/shared'
import { useCartStore } from '@/lib/cart/store'

interface NavbarProps {
    cartItemCount?: number
}

export function Navbar({ cartItemCount: initialCount = 0 }: NavbarProps) {
    const [isScrolled, setIsScrolled] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const cartIconRef = useRef<HTMLAnchorElement>(null)
    const mobileMenuRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)

    // Connect to store
    const items = useCartStore((state) => state.items)
    const [mounted, setMounted] = useState(false)
    const [prevCount, setPrevCount] = useState(initialCount)

    // Calculate count from store on client, use initialCount on server/first render
    const count = mounted
        ? items.reduce((acc, item) => acc + item.quantity, 0)
        : initialCount

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)
    const closeMobileMenu = () => setIsMobileMenuOpen(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        const handleScroll = () => {
            const heroWrapper = document.querySelector('[data-hero-wrapper]')
            if (heroWrapper) {
                // Só ativar fundo sólido quando o scroll ultrapassar 58% do hero (logo após o flash terminar totalmente)
                const heroBottom = heroWrapper.scrollHeight * 0.58
                setIsScrolled(window.scrollY > heroBottom)
            } else {
                // Fallback para páginas sem hero
                setIsScrolled(window.scrollY > 50)
            }
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Cart Add Animation
    useEffect(() => {
        if (mounted && count > prevCount) {
            if (cartIconRef.current) {
                gsap.fromTo(cartIconRef.current,
                    { scale: 1 },
                    { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }
                )
            }
        }
        setPrevCount(count)
    }, [count, mounted, prevCount])

    // Mobile Menu Animation
    useEffect(() => {
        if (!mobileMenuRef.current || !overlayRef.current) return

        if (isMobileMenuOpen) {
            // Open animation
            gsap.to(overlayRef.current, { opacity: 1, duration: 0.3, pointerEvents: 'auto' })
            gsap.fromTo(mobileMenuRef.current,
                { x: '100%' },
                { x: '0%', duration: 0.3, ease: 'power3.out' }
            )
        } else {
            // Close animation
            gsap.to(overlayRef.current, { opacity: 0, duration: 0.3, pointerEvents: 'none' })
            gsap.to(mobileMenuRef.current, { x: '100%', duration: 0.3, ease: 'power3.in' })
        }
    }, [isMobileMenuOpen])

    const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5511934417085'
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Olá! Gostaria de falar com a Mont.`

    return (
        <>
            <nav
                className={cn(
                    'fixed top-0 left-0 right-0 z-50 transition-all duration-300 w-full',
                    isScrolled
                        ? 'bg-mont-cream/95 backdrop-blur-md shadow-sm'
                        : 'bg-transparent'
                )}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 sm:h-20">
                        {/* Logo */}
                        <Link
                            href="/"
                            className="font-display text-2xl sm:text-3xl font-bold text-mont-espresso hover:text-mont-gold transition-colors relative z-50"
                            onClick={closeMobileMenu}
                        >
                            Mont
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-8">
                            <Link
                                href="/produtos"
                                className="font-body text-mont-espresso hover:text-mont-gold transition-colors"
                            >
                                Produtos
                            </Link>
                            <Link
                                href="/sobre"
                                className="font-body text-mont-espresso hover:text-mont-gold transition-colors"
                            >
                                Sobre
                            </Link>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Cart Icon with Badge */}
                            <Link
                                ref={cartIconRef}
                                href="/carrinho"
                                className="relative group p-2 z-50"
                                aria-label={`Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}`}
                                onClick={closeMobileMenu}
                            >
                                <svg
                                    className="w-6 h-6 text-mont-espresso group-hover:text-mont-gold transition-colors"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                                    />
                                </svg>

                                {count > 0 && (
                                    <span className="absolute top-0 right-0 bg-mont-gold text-mont-espresso text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center transform translate-x-1/4 -translate-y-1/4">
                                        {count > 9 ? '9+' : count}
                                    </span>
                                )}
                            </Link>

                            {/* Mobile Hamburger Button */}
                            <button
                                className="md:hidden p-2 text-mont-espresso focus:outline-none z-50"
                                onClick={toggleMobileMenu}
                                aria-label="Menu"
                            >
                                <div className="w-6 h-6 flex flex-col justify-around">
                                    <span className={cn("block w-full h-0.5 bg-current transition-transform duration-300", isMobileMenuOpen ? "rotate-45 translate-y-2.5" : "")} />
                                    <span className={cn("block w-full h-0.5 bg-current transition-opacity duration-300", isMobileMenuOpen ? "opacity-0" : "")} />
                                    <span className={cn("block w-full h-0.5 bg-current transition-transform duration-300", isMobileMenuOpen ? "-rotate-45 -translate-y-2.5" : "")} />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            <div
                ref={overlayRef}
                className="fixed inset-0 bg-black/50 z-40 opacity-0 pointer-events-none"
                onClick={closeMobileMenu}
                aria-hidden="true"
            />

            {/* Mobile Menu Drawer */}
            <div
                ref={mobileMenuRef}
                className="fixed top-0 right-0 bottom-0 w-[80%] max-w-sm bg-[#3D2B22] z-40 transform translate-x-full shadow-2xl flex flex-col pt-24 px-8"
            >
                <div className="flex flex-col gap-8">
                    <Link
                        href="/produtos"
                        className="font-display text-3xl text-mont-cream hover:text-mont-orange transition-colors border-b border-mont-cream/10 pb-4"
                        onClick={closeMobileMenu}
                    >
                        Produtos
                    </Link>
                    <Link
                        href="/sobre"
                        className="font-display text-3xl text-mont-cream hover:text-mont-orange transition-colors border-b border-mont-cream/10 pb-4"
                        onClick={closeMobileMenu}
                    >
                        Sobre
                    </Link>
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-display text-3xl text-[#E8601C] hover:text-mont-orange-dark transition-colors pb-4 flex items-center gap-2"
                        onClick={closeMobileMenu}
                    >
                        Contato
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                    </a>
                </div>

                <div className="mt-auto mb-10 text-mont-cream/30 text-center text-sm">
                    © 2024 Mont Distribuidora
                </div>
            </div>
        </>
    )
}
