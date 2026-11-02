'use client'

import Link from 'next/link'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { guardarEnviado, interpretarEnviado, lerEnviadoBruto } from '@/lib/pedido/enviado'

const nadaMuda = () => () => {}

/**
 * Tela 07 (sem pagamento online, 02/11): o pedido foi registrado; o WhatsApp da Mont abre com a
 * mensagem pronta. Abre sozinho uma vez; se não abrir, o cliente toca no link.
 */
export function Enviado() {
    // No servidor (e no 1º render do cliente) é undefined: mesmo HTML dos dois lados.
    const bruto = useSyncExternalStore(nadaMuda, lerEnviadoBruto, () => undefined)
    const pedido = useMemo(() => (bruto === undefined ? undefined : interpretarEnviado(bruto)), [bruto])

    useEffect(() => {
        if (pedido && !pedido.whatsappAberto) {
            guardarEnviado({ ...pedido, whatsappAberto: true })
            window.location.href = pedido.link
        }
    }, [pedido])

    if (pedido === undefined) return <div className="min-h-dvh" />

    return (
        <div className="flex min-h-dvh flex-col items-center gap-4 px-6 pt-20 text-center">
            {pedido ? (
                <>
                    <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-verde">
                        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="white" strokeWidth="3">
                            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                    {/* "Registrado" é a verdade: o pedido só chega à Mont quando o cliente aperta enviar no WhatsApp. */}
                    <h1 className="font-titulo text-[32px] leading-none">Pedido nº {pedido.numero} registrado</h1>
                    <p className="text-[17px] font-bold">Falta só mandar no WhatsApp.</p>
                    <a
                        href={pedido.link}
                        className="mt-2 flex h-14 w-full items-center justify-center rounded-[28px] bg-verde text-base font-bold text-white no-underline"
                    >
                        Abrir o WhatsApp
                    </a>
                    <p className="text-sm text-marrom-medio">
                        A mensagem já vai pronta: é só apertar enviar. Lá a gente combina o frete, o dia da entrega e o
                        pagamento.
                    </p>
                </>
            ) : (
                <p className="text-[15px] text-texto-suave">Nenhum pedido enviado nesta aba.</p>
            )}
            <Link href="/" className="mt-4 flex h-11 items-center px-3 text-sm font-bold">
                Voltar para a loja
            </Link>
        </div>
    )
}
