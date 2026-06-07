import { Package, ChevronRight } from 'lucide-react'
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
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">Gerenciar Produtos</h3>
                                <p className="text-sm text-muted-foreground">Adicionar, editar e desativar produtos</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                </div>
            </Card>
        </>
    )
}
