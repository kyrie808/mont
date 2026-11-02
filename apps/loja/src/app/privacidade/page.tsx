import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Política de privacidade · Loja Mont',
}

// TEXTO PROVISÓRIO: substituir pelo texto final enviado pelo Luccas.
export default function PaginaPrivacidade() {
    return (
        <div className="min-h-dvh pb-10">
            <header className="flex h-14 items-center gap-1 border-b border-linha px-2">
                <Link
                    href="/"
                    aria-label="Voltar para a loja"
                    className="flex h-11 w-11 items-center justify-center text-[22px] no-underline"
                >
                    ←
                </Link>
                <span className="text-base font-bold">Política de privacidade</span>
            </header>

            <article className="flex flex-col gap-3 px-4 pt-5 text-sm leading-relaxed">
                <h1 className="font-titulo text-[26px] font-normal uppercase tracking-[0.5px]">Política de privacidade</h1>
                <p className="text-texto-suave">Texto provisório. A versão final desta política será publicada aqui.</p>
                <p>
                    Usamos seus dados (nome, WhatsApp e endereço) só para entregar o seu pedido e avisar o andamento
                    dele. Ofertas pelo WhatsApp só com a sua autorização, e dá para sair quando quiser.
                </p>
            </article>
        </div>
    )
}
