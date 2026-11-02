'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { linkWhatsApp } from '@/lib/formato'

// Público no navegador (NEXT_PUBLIC_): o pedido sempre pode seguir pelo WhatsApp, mesmo com a loja fora.
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''

/** Falha ao montar uma tela (ex.: banco fora do ar): na voz da Mont, com saída pelo WhatsApp. */
export default function ErroLoja({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error('[loja] erro na tela', error)
    }, [error])

    return (
        <div role="alert" className="flex min-h-dvh flex-col items-center gap-4 px-6 pt-24 text-center">
            <h1 className="font-titulo text-[30px] leading-none uppercase">Deu um tropeço aqui</h1>
            <p className="text-[15px] text-marrom-medio">
                Não conseguimos abrir a loja agora. Tente de novo em instantes ou faça o pedido direto no WhatsApp.
            </p>
            <button
                type="button"
                onClick={reset}
                className="mt-2 h-14 w-full cursor-pointer rounded-[28px] bg-laranja text-base font-bold text-marrom"
            >
                Tentar de novo
            </button>
            {/^55\d{10,11}$/.test(WHATSAPP) && (
                <a
                    href={linkWhatsApp(WHATSAPP)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-14 w-full items-center justify-center rounded-[28px] border-[1.5px] border-marrom text-base font-bold no-underline"
                >
                    Pedir pelo WhatsApp
                </a>
            )}
            <Link href="/" className="flex h-11 items-center px-3 text-sm font-bold">
                Voltar para o começo
            </Link>
        </div>
    )
}
