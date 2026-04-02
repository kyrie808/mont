import { useNavigate } from 'react-router-dom'
import { Refrigerator, AlertTriangle, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '../ui'
import { useEstoqueMetrics } from '../../hooks/useEstoqueMetrics'
import { ENABLE_GELADEIRA } from '../../constants/flags'
import { cn } from '@mont/shared'

export function EstoqueWidget() {
    const navigate = useNavigate()
    const { produtosBaixoEstoque, loading } = useEstoqueMetrics()

    const handleNavigate = () => {
        if (ENABLE_GELADEIRA) {
            navigate('/estoque')
        } else {
            navigate('/produtos')
        }
    }

    if (loading) {
        return (
            <Card className="h-full flex items-center justify-center p-6">
                <div className="animate-pulse flex flex-col items-center gap-2">
                    <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                    <div className="h-4 w-24 bg-gray-200 rounded"></div>
                </div>
            </Card>
        )
    }

    const isAlert = produtosBaixoEstoque > 0

    return (
        <Card
            className={cn(
                "cursor-pointer transition-all hover:shadow-md border active:scale-[0.99]",
                isAlert
                    ? "bg-warning-50/50 border-warning text-warning-900"
                    : "bg-success-50/50 border-success text-success-900"
            )}
            onClick={handleNavigate}
        >
            <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "p-3 rounded-full shadow-sm",
                        isAlert ? "bg-white text-warning-600" : "bg-white text-success-600"
                    )}>
                        {isAlert ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle className="h-6 w-6" />}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg leading-tight">
                            {isAlert ? 'Atenção ao Estoque' : 'Estoque Saudável'}
                        </h3>
                        <p className={cn(
                            "text-sm font-medium opacity-90",
                            isAlert ? "text-warning-800" : "text-success-800"
                        )}>
                            {isAlert
                                ? `${produtosBaixoEstoque} produto(s) abaixo do mínimo`
                                : 'Todos produtos abastecidos'
                            }
                        </p>
                    </div>
                </div>

                {/* Context Label */}
                <div className="flex flex-col items-center justify-center opacity-50 px-2">
                    <Refrigerator className="h-5 w-5" />
                </div>
            </CardContent>
        </Card>
    )
}
