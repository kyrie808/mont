import { cn } from '@mont/shared'

/** Bloco cinza-areia que "respira" enquanto carrega (parado para quem pede menos movimento). */
export function Bloco({ className }: { className?: string }) {
    return <div aria-hidden="true" className={cn('rounded-xl bg-areia motion-safe:animate-pulse', className)} />
}

/** Cabeçalho das telas internas (seta + título), na mesma altura do real: nada pula quando a tela chega. */
function CabecalhoTela() {
    return (
        <div className="flex h-14 items-center gap-3 border-b border-linha px-4">
            <Bloco className="h-6 w-6 rounded-md" />
            <Bloco className="h-5 w-28 rounded-md" />
        </div>
    )
}

/** Tela 01 carregando: cabeçalho, abas, dois cards de massa e linhas de doces. */
export function EsqueletoLoja() {
    return (
        <div role="status" aria-label="Carregando a loja" className="pb-[100px]">
            <div className="flex h-16 items-center gap-2.5 border-b border-linha px-4">
                <Bloco className="h-10 w-10 rounded-full" />
                <div className="flex flex-col gap-1.5">
                    <Bloco className="h-4 w-16 rounded-md" />
                    <Bloco className="h-3 w-36 rounded-md" />
                </div>
            </div>
            <div className="flex h-14 items-center gap-2 border-b border-linha px-4">
                <Bloco className="h-9 w-20 rounded-[18px]" />
                <Bloco className="h-9 w-20 rounded-[18px]" />
                <Bloco className="h-9 w-16 rounded-[18px]" />
            </div>
            <div className="flex flex-col gap-3 px-4 pt-8">
                <Bloco className="h-7 w-64 rounded-md" />
                <div className="grid grid-cols-2 gap-3">
                    <Bloco className="h-[290px] rounded-2xl" />
                    <Bloco className="h-[290px] rounded-2xl" />
                </div>
                <Bloco className="mt-6 h-7 w-52 rounded-md" />
                {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5">
                        <Bloco className="h-14 w-14" />
                        <div className="flex flex-1 flex-col gap-2">
                            <Bloco className="h-4 w-4/5 rounded-md" />
                            <Bloco className="h-4 w-16 rounded-md" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

/** Telas internas (sacola, dados, combo) carregando. */
export function EsqueletoTela({ rotulo }: { rotulo: string }) {
    return (
        <div role="status" aria-label={rotulo}>
            <CabecalhoTela />
            <EsqueletoLinhas />
        </div>
    )
}

/** Linhas de item (sacola) enquanto a sacola é lida do aparelho. */
export function EsqueletoLinhas() {
    return (
        <div className="flex flex-col gap-3 px-4 py-3">
            <Bloco className="h-20 rounded-[14px]" />
            <Bloco className="h-20 rounded-[14px]" />
            <Bloco className="mt-1 h-6 w-full rounded-md" />
        </div>
    )
}
