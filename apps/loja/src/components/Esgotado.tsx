'use client'

import { useSyncExternalStore } from 'react'
import { cn } from '@mont/shared'
import { linkWhatsApp } from '@/lib/formato'
import { CHAVE_AVISOS, interpretarAvisos, mensagemAviso } from '@/lib/vitrine/esgotado'

// Produto esgotado (wireframe docs/loja/wireframe/Esgotado.dc.html): faixa diagonal sobre a foto e o
// "Me avisa quando chegar", que abre o WhatsApp da Mont e vira o selo verde. O selo vale só neste aparelho.

/** Foto do esgotado: cinza e apagada, com a faixa por cima. Vai na foto (Foto/GaleriaFotos), dentro do recorte. */
export const fotoEsgotada = 'grayscale opacity-55'

type TamanhoFaixa = 'cartao' | 'linha' | 'pagina'

const faixas: Record<TamanhoFaixa, string> = {
    // Card em grade (foto de 120 px de altura).
    cartao: 'top-[22px] -right-[38px] h-[26px] w-[160px] rotate-[35deg] text-xs tracking-[2px] shadow-[0_2px_6px_rgba(0,0,0,0.2)]',
    // Linha de lista (miniatura de 56 px).
    linha: 'bottom-[9px] -left-[14px] h-[15px] w-[90px] -rotate-30 text-[8px] tracking-[1px]',
    // Foto grande do painel e da página do produto: a faixa do card, em escala.
    pagina: 'top-[40px] -right-[62px] h-[38px] w-[260px] rotate-[35deg] text-base tracking-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.2)]',
}

/** Faixa "ESGOTADO". O pai precisa de `relative overflow-hidden` (a faixa sai da foto e é cortada no canto). */
export function FaixaEsgotado({ tamanho }: { tamanho: TamanhoFaixa }) {
    return (
        <span
            className={cn(
                'pointer-events-none absolute flex items-center justify-center bg-faixa font-bold text-white uppercase',
                faixas[tamanho],
            )}
        >
            Esgotado
        </span>
    )
}

/** Etiqueta (pílula) "ESGOTADO" do sabor no Montar combo. */
export function EtiquetaEsgotado({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                'flex h-6 shrink-0 items-center rounded-xl bg-faixa px-2.5 text-[11px] font-bold tracking-[1px] text-white uppercase',
                className,
            )}
        >
            Esgotado
        </span>
    )
}

// "Já pedi para avisar": ids no localStorage, lidos uma vez e compartilhados por todos os botões da tela.
let avisos: ReadonlySet<string> | null = null
const ouvintes = new Set<() => void>()

function lerAvisos(): ReadonlySet<string> {
    if (avisos === null) {
        let texto: string | null = null
        try {
            texto = localStorage.getItem(CHAVE_AVISOS)
        } catch {
            // Aba anônima, armazenamento bloqueado: o botão continua funcionando, só não lembra.
        }
        avisos = new Set(interpretarAvisos(texto))
    }
    return avisos
}

function marcarAviso(produtoId: string): void {
    const novos = new Set(lerAvisos())
    novos.add(produtoId)
    avisos = novos
    try {
        localStorage.setItem(CHAVE_AVISOS, JSON.stringify([...novos]))
    } catch {
        // Sem armazenamento: o selo vale até recarregar a página.
    }
    ouvintes.forEach((avisar) => avisar())
}

function assinar(avisar: () => void): () => void {
    // Outra aba marcou: relê na próxima leitura.
    const aoMudarArmazenamento = (e: StorageEvent) => {
        if (e.key !== CHAVE_AVISOS) return
        avisos = null
        avisar()
    }
    ouvintes.add(avisar)
    window.addEventListener('storage', aoMudarArmazenamento)
    return () => {
        ouvintes.delete(avisar)
        window.removeEventListener('storage', aoMudarArmazenamento)
    }
}

/** No servidor (e no primeiro render do cliente) é false: o HTML bate; depois lê o aparelho. */
function useAvisado(produtoId: string): boolean {
    return useSyncExternalStore(
        assinar,
        () => lerAvisos().has(produtoId),
        () => false,
    )
}

type VarianteAviso = 'cartao' | 'linha' | 'barra'

const textos: Record<VarianteAviso, { botao: string; selo: string }> = {
    // No card de ~151 px, "Me avisa quando chegar" quebraria em 2 linhas: fica o curto, como na lista.
    cartao: { botao: 'Me avisa', selo: 'Vamos te avisar' },
    linha: { botao: 'Me avisa', selo: 'Avisaremos' },
    barra: { botao: 'Me avisa quando chegar', selo: 'Vamos te avisar' },
}

const tamanhos: Record<VarianteAviso, string> = {
    // Card em grade: largura do card.
    cartao: 'h-11 w-full rounded-[22px] px-3 text-[13px]',
    linha: 'h-11 shrink-0 rounded-[22px] px-3.5 text-[13px]',
    // Barra do painel/página do produto, no lugar do "Adicionar".
    barra: 'h-[52px] flex-1 rounded-[26px] px-4 text-base',
}

interface BotaoAvisaProps {
    produto: { id: string; nome: string }
    /** Número da Mont (NEXT_PUBLIC_WHATSAPP_NUMBER), o mesmo do pedido. */
    whatsapp: string
    variante: VarianteAviso
}

/** "Me avisa quando chegar": abre o WhatsApp da Mont com a mensagem pronta; depois vira o selo verde. */
export function BotaoAvisa({ produto, whatsapp, variante }: BotaoAvisaProps) {
    const avisado = useAvisado(produto.id)
    const base = cn('flex items-center justify-center gap-1.5 text-center font-bold', tamanhos[variante])

    if (avisado) {
        return (
            <span role="status" className={cn(base, 'bg-verde-claro text-verde-escuro')}>
                <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M5 12l5 5L19 7" />
                </svg>
                {textos[variante].selo}
            </span>
        )
    }

    return (
        <a
            href={linkWhatsApp(whatsapp, mensagemAviso(produto.nome))}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Me avisa quando ${produto.nome} voltar`}
            onClick={() => marcarAviso(produto.id)}
            className={cn(base, 'border-[1.5px] border-texto-suave bg-white text-marrom no-underline')}
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {textos[variante].botao}
        </a>
    )
}
