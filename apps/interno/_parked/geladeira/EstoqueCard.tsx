import React from 'react'
import { Minus, Plus } from 'lucide-react'
import { Card } from '../../ui'
import type { DomainProduto } from '../../../types/domain'

interface EstoqueCardProps {
    produto: DomainProduto
    onIncrement: () => void
    onDecrement: () => void
    isUpdating: boolean
}

export function EstoqueCard({ produto, onIncrement, onDecrement, isUpdating }: EstoqueCardProps) {
    const is1kg = produto.nome.toLowerCase().includes('1kg') || produto.codigo.includes('1KG')
    const bgColor = is1kg ? 'bg-accent-50 border-accent-200' : 'bg-primary-50 border-primary-200'
    const textColor = is1kg ? 'text-accent-600' : 'text-primary-600'

    return (
        <Card className={`${bgColor} border-2 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{produto.nome}</p>
                    <p className="text-xs text-gray-500 font-medium">{produto.codigo}</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={(e: React.MouseEvent) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onDecrement()
                        }}
                        disabled={isUpdating || (produto.estoqueAtual || 0) <= 0}
                        className={`
                            w-10 h-10 rounded-full flex items-center justify-center
                            bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed
                            transition-all active:scale-90
                        `}
                    >
                        <Minus className="h-5 w-5 text-gray-600" />
                    </button>

                    <div className="flex flex-col items-center min-w-[3.5rem]">
                        <span className={`text-3xl font-black ${textColor}`}>
                            {produto.estoqueAtual || 0}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Baldes</span>
                    </div>

                    <button
                        type="button"
                        onClick={(e: React.MouseEvent) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onIncrement()
                        }}
                        disabled={isUpdating}
                        className={`
                            w-10 h-10 rounded-full flex items-center justify-center
                            ${is1kg ? 'bg-accent-500 hover:bg-accent-600' : 'bg-primary-500 hover:bg-primary-600'}
                            text-white disabled:opacity-50 disabled:cursor-not-allowed
                            transition-all shadow-lg active:scale-90
                        `}
                    >
                        <Plus className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </Card>
    )
}
