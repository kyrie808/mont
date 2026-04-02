import { useNavigate } from 'react-router-dom'
import { ChevronRight, Map as MapIcon } from 'lucide-react'

interface LogisticsWidgetProps {
    metrics: {
        entregasRealizadas: number
        entregasPendentes: number
    }
}

export function LogisticsWidget({ metrics }: LogisticsWidgetProps) {
    const navigate = useNavigate()

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Logística em Tempo Real</h2>
            </div>

            {/* Delivery Status Card */}
            <div className="flex items-center gap-4 rounded-xl bg-card p-4 shadow-sm border border-border">
                {/* Circular Gauge */}
                <div className="relative size-16 shrink-0">
                    <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                        {/* Background Circle */}
                        <path className="text-gray-100 dark:text-gray-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4"></path>
                        {/* Progress Circle */}
                        {(() => {
                            const total = metrics.entregasRealizadas + metrics.entregasPendentes
                            const percentage = total > 0 ? (metrics.entregasRealizadas / total) * 100 : 0
                            const dashArray = `${percentage}, 100`
                            return (
                                <path
                                    className="text-primary transition-all duration-1000"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeDasharray={dashArray}
                                    strokeLinecap="round"
                                    strokeWidth="4"
                                ></path>
                            )
                        })()}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                            {Math.round((metrics.entregasRealizadas + metrics.entregasPendentes) > 0
                                ? (metrics.entregasRealizadas / (metrics.entregasRealizadas + metrics.entregasPendentes)) * 100
                                : 0)}%
                        </span>
                    </div>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-white">Rota Diária</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 dark:bg-green-900/40 text-semantic-green uppercase tracking-wide">No Prazo</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Motorista: Auto-atribuição</p>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className="size-2 rounded-full bg-semantic-green"></div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{metrics.entregasRealizadas} Entregues</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="size-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{metrics.entregasPendentes} Pendentes</span>
                        </div>
                    </div>
                </div>
                <button
                    className="shrink-0 size-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                    onClick={() => navigate('/entregas')}
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            </div>

            {/* Recent Activity / Map Teaser */}
            <div
                className="w-full h-32 rounded-xl bg-gray-200 dark:bg-gray-800 relative overflow-hidden group cursor-pointer"
                onClick={() => navigate('/entregas')}
            >
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-60 dark:opacity-40 transition-opacity group-hover:opacity-70"
                    style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA9ZDKdkTUcPjdDrhoNFXLUYkV8XhlkCsbwhgpZpE4R1wOGwt1znk2bmD2wk7lMqAuxraLGGOyFe_F4lTetoGK0YbIH7eaks3YHUnVUwPL0yiHctEpILJUI_HQ459vG7sxTfyF6rsLulL1nr1E1lIo2H8Es4I9mtid_pKop1mqC0T96IFDTkIlBWSPUnp-z5rUl9wFejGDq5r6O2-8qH2TmXX1IZLzIIwhf0yjnY_sQQI6MJfbHKQpo_uUJtVDvALh2Mgr9wf3gCs8E')" }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center p-6">
                    <div>
                        <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Rastreamento</p>
                        <h3 className="text-white text-lg font-bold">Mapa da Frota</h3>
                    </div>
                    <MapIcon className="text-white ml-auto !w-8 !h-8 group-hover:translate-x-1 transition-transform" />
                </div>
            </div>
        </div>
    )
}
