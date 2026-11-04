import Link from 'next/link'

/** Link velho (produto que saiu, combo de campanha encerrada, endereço do catálogo antigo) ou digitado errado. */
export default function NaoEncontrado() {
    return (
        <div className="flex min-h-dvh flex-col items-center gap-4 px-6 pt-24 text-center">
            <h1 className="font-titulo text-[30px] leading-none uppercase">Essa página não existe mais</h1>
            <p className="text-[15px] text-marrom-medio">A loja continua aqui.</p>
            <Link
                href="/"
                className="mt-2 flex h-14 w-full items-center justify-center rounded-[28px] bg-laranja text-base font-bold text-marrom no-underline"
            >
                Ver a loja
            </Link>
        </div>
    )
}
