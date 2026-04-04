'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Menu, X, ChevronRight } from 'lucide-react'
import { cn } from '@mont/shared'
import { useCartStore } from '@/lib/cart/store'

const NAV_LINKS = [
    { name: 'Home', href: '/' },
    { name: 'Produtos', href: '/produtos' },
    { name: 'Nossa História', href: '/#historia' },
    { name: 'Como Funciona', href: '/#como-funciona' },
]

export function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const { getTotalItems, setIsOpen: setIsCartOpen } = useCartStore()
    const itemCount = getTotalItems()

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <nav
            className={cn(
                'fixed top-0 left-0 right-0 z-50 transition-all duration-500 py-4 px-6',
                isScrolled ? 'bg-mont-white/80 backdrop-blur-md shadow-md py-3' : 'bg-transparent'
            )}
        >
            <div className="container mx-auto flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="relative z-50 flex items-center gap-2 group">
                    <div className="relative w-10 h-10 md:w-12 md:h-12 overflow-hidden rounded-full border-2 border-mont-gold group-hover:scale-110 transition-transform">
                        <Image
                            src="/logo.png"
                            alt="Mont Massas"
                            fill
                            className="object-cover"
                        />
                    </div>
                    <span className={cn(
                        "font-display text-xl md:text-2xl transition-colors",
                        isScrolled ? "text-mont-espresso" : "text-mont-espresso"
                    )}>
                        Mont <span className="text-mont-gold italic">Massas</span>
                    </span>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden lg:flex items-center gap-8">
                    {NAV_LINKS.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            className="text-mont-espresso font-medium hover:text-mont-gold transition-colors relative group"
                        >
                            {link.name}
                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-mont-gold transition-all duration-300 group-hover:w-full" />
                        </Link>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    {/* Cart Button */}
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="relative p-2 text-mont-espresso hover:text-mont-gold transition-colors group"
                    >
                        <ShoppingCart className="w-6 h-6" />
                        <AnimatePresence>
                            {itemCount > 0 && (
                                <motion.span
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-mont-gold text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm"
                                >
                                    {itemCount}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="lg:hidden p-2 text-mont-espresso hover:text-mont-gold transition-colors z-50"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed inset-0 bg-mont-cream z-40 lg:hidden pt-24 px-6"
                    >
                        <div className="flex flex-col gap-6">
                            {NAV_LINKS.map((link, idx) => (
                                <motion.div
                                    key={link.name}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                >
                                    <Link
                                        href={link.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="text-2xl font-display text-mont-espresso flex items-center justify-between group"
                                    >
                                        {link.name}
                                        <ChevronRight className="w-6 h-6 text-mont-gold opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                </motion.div>
                            ))}
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mt-12 p-6 bg-mont-white rounded-2xl border border-mont-surface"
                        >
                            <p className="text-mont-espresso font-display text-lg mb-2 text-center">
                                Gostaria de fazer um pedido especial?
                            </p>
                            <a
                                href="https://wa.me/5511999999999"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full py-3 bg-mont-gold text-white text-center rounded-xl font-bold hover:bg-mont-espresso transition-colors"
                            >
                                Falar no WhatsApp
                            </a>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    )
}
