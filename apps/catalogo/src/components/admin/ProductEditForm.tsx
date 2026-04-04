'use client'

import React, { useState } from 'react'
import { X, Save, Trash2, Image as ImageIcon, Check, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@mont/shared'
import type { Produto, ProdutoCatalogo } from '@mont/shared'

interface ProductEditFormProps {
    product: ProdutoCatalogo
    onClose: () => void
    onSave: (id: string, data: Partial<Produto>) => Promise<void>
    onImageDeleted?: (id: string) => Promise<void>
    showToast: (message: string, type: 'success' | 'error') => void
}

export default function ProductEditForm({ product, onClose, onSave, onImageDeleted, showToast }: ProductEditFormProps) {
    const [formData, setFormData] = useState<Partial<Produto>>({
        nome: product.nome || '',
        subtitulo: product.subtitulo || '',
        descricao: product.descricao || '',
        preco: product.preco || 0,
        categoria: product.categoria || '',
        estoque_atual: product.estoque_atual || 0,
        visivel_catalogo: product.visivel_catalogo || false,
        destaque: product.destaque || false,
    })
    
    // Principal image display only
    const imageUrl = product.url_imagem_principal || ''
    
    const [isSaving, setIsSaving] = useState(false)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as HTMLInputElement
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : (type === 'number' ? Number(value) : value)
        setFormData(prev => ({ ...prev, [name]: val }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!product.id) return
        
        setIsSaving(true)
        try {
            await onSave(product.id, formData)
            showToast('Produto atualizado com sucesso!', 'success')
            onClose()
        } catch (error) {
            console.error(error)
            showToast('Erro ao atualizar produto.', 'error')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-xl font-bold font-display text-slate-800">
                            Editar <span className="text-mont-gold">Produto</span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">ID: {product.id}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form id="product-edit-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Nome do Produto</label>
                            <input
                                type="text"
                                name="nome"
                                value={formData.nome || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-mont-gold focus:border-mont-gold outline-none transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Categoria</label>
                            <input
                                type="text"
                                name="categoria"
                                value={formData.categoria || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-mont-gold focus:border-mont-gold outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Subtítulo (Opcional)</label>
                        <input
                            type="text"
                            name="subtitulo"
                            value={formData.subtitulo || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-mont-gold focus:border-mont-gold outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Descrição</label>
                        <textarea
                            name="descricao"
                            rows={3}
                            value={formData.descricao || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-mont-gold focus:border-mont-gold outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Preço (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                name="preco"
                                value={formData.preco || 0}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-mont-gold focus:border-mont-gold outline-none transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Estoque Atual</label>
                            <input
                                type="number"
                                name="estoque_atual"
                                value={formData.estoque_atual || 0}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-mont-gold focus:border-mont-gold outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-6 pt-4 border-t border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    name="visivel_catalogo"
                                    checked={formData.visivel_catalogo || false}
                                    onChange={handleChange}
                                    className="peer sr-only"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-mont-gold/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mont-gold"></div>
                            </div>
                            <span className="text-sm font-bold text-slate-700">Público no Catálogo</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    name="destaque"
                                    checked={formData.destaque || false}
                                    onChange={handleChange}
                                    className="peer sr-only"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-mont-gold/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </div>
                            <span className="text-sm font-bold text-slate-700 text-amber-600">Destaque</span>
                        </label>
                    </div>

                    {/* Image Display UI */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-700">Imagem do Produto</h3>
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-center">
                            {imageUrl ? (
                                <div className="relative w-40 h-40 rounded-lg overflow-hidden ring-4 ring-mont-surface shadow-md group">
                                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                    {onImageDeleted && product.id && (
                                        <button
                                            type="button"
                                            onClick={() => onImageDeleted(product.id || '')}
                                            className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="text-white" size={24} />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-300 shadow-sm">
                                        <ImageIcon size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Nenhuma imagem carregada</p>
                                        <p className="text-[10px] text-slate-400 mt-1 text-center font-medium">Use o painel para gerenciar mídias</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        form="product-edit-form"
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-2 px-8 py-2.5 bg-mont-espresso text-white rounded-xl font-bold text-sm shadow-md hover:bg-mont-gold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
