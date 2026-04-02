import { Package, MessageSquare, ChevronRight } from 'lucide-react'
import { Card } from '../../ui'
import { useNavigate } from 'react-router-dom'

export function ConfiguracaoLinks() {
    const navigate = useNavigate()

    return (
        <>
            <Card
                hover
                onClick={() => navigate('/produtos')}
                className="cursor-pointer lg:col-span-1"
            >
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-500/10 rounded-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-violet-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Gerenciar Produtos</h3>
                                <p className="text-sm text-gray-500">Adicionar, editar e desativar produtos</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                </div>
            </Card>

            <Card
                hover
                onClick={() => navigate('/relatorio-fabrica')}
                className="cursor-pointer lg:col-span-1"
            >
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                                <MessageSquare className="h-5 w-5 text-accent" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Relatório para Fábrica</h3>
                                <p className="text-sm text-gray-500">Gerar pedido por período</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                </div>
            </Card>
        </>
    )
}
