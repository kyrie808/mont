'use client'

import React from 'react'
import Image from 'next/image'
import { Edit2, Power, PowerOff, Package, Eye, EyeOff, Star } from 'lucide-react'
import { cn } from '@mont/shared'
// Note: formatCurrency from @/lib/utils/format might need checking, but we already have shared utils
import type { ProdutoCatalogo } from '@mont/shared'

interface ProductCardProps {
    product: ProdutoCatalogo
    onToggleActive: (id: string, active: boolean) => void
    onEdit: (product: ProdutoCatalogo) => void
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
}

export default function ProductCard({ product, onToggleActive, onEdit }: ProductCardProps) {
    const {
        id,
        nome,
        categoria,
        preco,
        url_imagem_principal,
        visivel_catalogo,
        destaque,
        estoque_atual
    } = product

    return (
        <div className={cn(
            "bg-white rounded-2xl shadow-sm border transition-all duration-500 overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1",
            visivel_catalogo ? "border-slate-100" : "border-slate-100 opacity-75 grayscale-[0.5]"
        )}>
            {/* Imagem */}
            <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                {url_imagem_principal ? (
                    <Image
                        src={url_imagem_principal}
                        alt={nome || 'Produto'}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                        <Package size={48} strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Sem Imagem</span>
                    </div>
                )}
                
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {destaque && (
                        <div className="bg-amber-400 text-white p-2 rounded-xl shadow-lg shadow-amber-400/30" title="Produto em Destaque">
                            <Star size={14} fill="currentColor" />
                        </div>
                    )}
                    {!visivel_catalogo && (
                        <div className="bg-slate-800 text-white p-2 rounded-xl shadow-lg ring-4 ring-white/20" title="Oculto no Catálogo">
                            <EyeOff size={14} />
                        </div>
                    )}
                </div>

                {/* Overlay for quick actions can be added here if needed */}
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors duration-500" />
            </div>

            {/* Conteúdo */}
            <div className="p-5 space-y-4">
                <div className="space-y-1">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-mont-gold/60">
                            {categoria || 'Sem Categoria'}
                        </span>
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            visivel_catalogo ? "bg-green-500 animate-pulse" : "bg-slate-300"
                        )} />
                    </div>
                    <h3 className="font-display font-bold text-slate-800 line-clamp-1 group-hover:text-mont-gold transition-colors duration-300">
                        {nome}
                    </h3>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Preço Sugerido</p>
                        <p className="text-lg font-black text-slate-900">{formatCurrency(preco || 0)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Estoque</p>
                        <p className={cn(
                            "text-sm font-bold",
                            (estoque_atual || 0) <= 0 ? "text-red-500" : (estoque_atual || 0) < 10 ? "text-amber-500" : "text-slate-600"
                        )}>
                            {estoque_atual || 0} un
                        </p>
                    </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
                    <button
                        onClick={() => onEdit(product)}
                        className="flex-grow flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-mont-gold transition-all duration-300 text-xs font-bold shadow-lg shadow-slate-900/10 hover:shadow-mont-gold/30"
                    >
                        <Edit2 size={14} />
                        Gerenciar
                    </button>
                    <button
                        onClick={() => id && onToggleActive(id, !visivel_catalogo)}
                        className={cn(
                            "p-2.5 rounded-xl transition-all duration-300 ring-1 ring-inset",
                            visivel_catalogo 
                                ? "bg-white ring-red-100 text-red-500 hover:bg-red-50" 
                                : "bg-white ring-green-100 text-green-500 hover:bg-green-50"
                        )}
                        title={visivel_catalogo ? "Ocultar do Catálogo" : "Mostrar no Catálogo"}
                    >
                        {visivel_catalogo ? <PowerOff size={18} /> : <Power size={18} />}
                    </button>
                </div>
            </div>
        </div>
    )
}
