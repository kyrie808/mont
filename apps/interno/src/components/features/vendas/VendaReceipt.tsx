import { formatCurrency, formatDate } from '@mont/shared'
import { VendaStatusBadges } from './VendaStatusBadges'

import type { DomainVenda } from '../../../types/domain'

interface VendaReceiptProps {
    venda: DomainVenda
}

export function VendaReceipt({ venda }: VendaReceiptProps) {
    const neonShadow = "dark:drop-shadow-[0_0_10px_rgba(19,236,19,0.5)]"

    return (
        <div className="relative w-full mb-8">
            <div className="bg-white dark:bg-card pt-8 px-6 pb-6 rounded-t-xl relative border-x border-t border-gray-200 dark:border-border shadow-xl dark:shadow-2xl">
                <div className="flex flex-col items-center mb-8">
                    <span className="text-xs font-mono text-gray-400 dark:text-primary/60 tracking-[0.2em] mb-2 uppercase">Valor Total</span>
                    <h1 className={`text-4xl font-mono font-bold text-gray-900 dark:text-primary tracking-tight mb-6 ${neonShadow}`}>
                        {formatCurrency(venda.total)}
                    </h1>

                    <VendaStatusBadges venda={venda} />

                    {venda.valorPago > 0 && !venda.pago && (
                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            Pago: {formatCurrency(venda.valorPago)}
                            <span className="mx-1.5">·</span>
                            <span className="text-red-600 dark:text-red-400 font-bold">
                                Saldo: {formatCurrency(venda.total - venda.valorPago)}
                            </span>
                        </p>
                    )}

                    <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-4">
                        {formatDate(venda.data)}
                    </p>
                    {venda.formaPagamento === 'fiado' && venda.dataPrevistaPagamento && (
                        <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-1">
                            Vence em {formatDate(venda.dataPrevistaPagamento)}
                        </p>
                    )}
                </div>

                <div className="w-full border-b-2 border-dashed border-gray-200 dark:border-border my-6 relative">
                    <div className="absolute -left-[30px] -top-[10px] w-5 h-5 rounded-full bg-secondary dark:bg-background"></div>
                    <div className="absolute -right-[30px] -top-[10px] w-5 h-5 rounded-full bg-secondary dark:bg-background"></div>
                </div>

                <div className="flex flex-col space-y-4">
                    {venda.itens.map((item) => (
                        <div key={item.id} className="flex justify-between items-start group">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-primary dark:group-hover:text-white transition-colors">
                                    {item.produto?.nome || 'Produto Removido'}
                                </span>
                                <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                                    QTD: x{item.quantidade}
                                </span>
                            </div>
                            <span className="text-sm font-mono text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors">
                                {formatCurrency(item.subtotal)}
                            </span>
                        </div>
                    ))}

                    <div className="border-b border-dashed border-gray-200 dark:border-border w-full my-4"></div>

                    {venda.taxaEntrega > 0 && (
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Taxa de Entrega</span>
                            <span className="font-mono text-gray-700 dark:text-gray-300">{formatCurrency(venda.taxaEntrega)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Desconto</span>
                        <span className="font-mono text-green-600 dark:text-primary">- {formatCurrency(0)}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm font-bold mt-2 pt-2 border-t border-gray-100 dark:border-white/5">
                        <span className="text-gray-900 dark:text-gray-100">Subtotal</span>
                        <span className="font-mono text-gray-900 dark:text-primary">
                            {formatCurrency(
                                venda.itens.reduce((acc, item) => acc + item.subtotal, 0) + (venda.taxaEntrega || 0)
                            )}
                        </span>
                    </div>

                    {venda.pago ? (
                        <div className="flex justify-center mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-border">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">✓ Quitado</span>
                        </div>
                    ) : venda.pagamentos.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-border">
                            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block mb-2">Pagamentos recebidos</span>
                            {venda.pagamentos.map((pag) => (
                                <div key={pag.id} className="flex justify-between text-xs py-1">
                                    <span className="font-mono text-gray-500 dark:text-gray-400">
                                        {formatDate(pag.data)} · {pag.metodo}
                                    </span>
                                    <span className="font-mono text-gray-700 dark:text-gray-300">
                                        {formatCurrency(pag.valor)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="h-4 w-full relative overflow-hidden">
                <svg className="absolute top-0 left-0 w-full h-4 text-white dark:text-card fill-current drop-shadow-sm dark:drop-shadow-xl" preserveAspectRatio="none" viewBox="0 0 100 10">
                    <polygon points="0,0 100,0 100,10 98,0 96,10 94,0 92,10 90,0 88,10 86,0 84,10 82,0 80,10 78,0 76,10 74,0 72,10 70,0 68,10 66,0 64,10 62,0 60,10 58,0 56,10 54,0 52,10 50,0 48,10 46,0 44,10 42,0 40,10 38,0 36,10 34,0 32,10 30,0 28,10 26,0 24,10 22,0 20,10 18,0 16,10 14,0 12,10 10,0 8,10 6,0 4,10 2,0 0,10"></polygon>
                </svg>
            </div>
            <div className="absolute -bottom-4 left-4 right-4 h-4 bg-black/10 dark:bg-black/40 blur-lg rounded-[100%] z-[-1]"></div>
        </div>
    )
}
