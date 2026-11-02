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
                    <span
                        aria-hidden="true"
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-verde text-2xl font-bold text-white"
                    >
                        ✓
                    </span>
                    <h1 className="font-titulo text-[32px] leading-none">Pedido nº {pedido.numero} enviado</h1>
                    <p className="text-[15px] text-marrom-medio">
                        Se o WhatsApp não abriu,{' '}
                        <a href={pedido.link} className="font-bold">
                            toque aqui
                        </a>
                        .
                    </p>
                </>
            ) : (
                <p className="text-[15px] text-texto-suave">Nenhum pedido enviado nesta aba.</p>
            )}
            <Link href="/" className="mt-4 text-sm font-bold">
                Voltar para a loja
            </Link>
        </div>
    )
}
