import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useCartStore } from '../stores/useCartStore'

/*
 * Garante que o aparelho não fique preso num build antigo.
 *
 * Motivação (04/08/2026): o celular do Gilmar rodou por quase um mês um build de
 * antes de 09/07 sem receber nenhuma correção — inclusive a blindagem da Nova
 * Venda, o que fez vendas sumirem em sinal fraco. A causa do congelamento (um
 * service worker legado) está resolvida em public/sw.js; este hook é a proteção
 * para o caso geral: aba/app aberto por dias, que nunca recarrega sozinho.
 *
 * Como funciona: compara o __BUILD_ID__ compilado no bundle com o publicado em
 * /version.json. Divergiu, tem versão nova no ar.
 *
 * O recarregamento é DELIBERADAMENTE conservador: só acontece com o carrinho
 * vazio e fora das telas de checkout. Recarregar no meio de uma venda perderia
 * exatamente o que estamos tentando proteger. Na prática o update entra na
 * próxima navegação do usuário, o que se confunde com um carregamento normal.
 */

const VERSION_URL = '/version.json'
const POLL_INTERVAL_MS = 15 * 60 * 1000

// Telas onde uma venda pode estar em andamento — nunca recarregar aqui.
function isRotaDeCheckout(pathname: string): boolean {
    return pathname.startsWith('/nova-venda') || /^\/vendas\/[^/]+\/editar/.test(pathname)
}

async function buscarBuildPublicado(signal: AbortSignal): Promise<string | null> {
    try {
        const res = await fetch(VERSION_URL, { cache: 'no-store', signal })
        if (!res.ok) return null
        const data: unknown = await res.json()
        if (typeof data === 'object' && data !== null && 'buildId' in data) {
            const { buildId } = data as { buildId: unknown }
            return typeof buildId === 'string' ? buildId : null
        }
        return null
    } catch {
        // Offline, timeout, deploy em andamento: não é erro do usuário, só tenta depois.
        return null
    }
}

export function useVersionGuard(): void {
    const [updatePendente, setUpdatePendente] = useState(false)
    const { pathname } = useLocation()
    const itensNoCarrinho = useCartStore((s) => s.items.length)
    // Trava para não disparar dois reloads caso o efeito reavalie durante o unload.
    const recarregando = useRef(false)

    // Detecção: no mount, ao voltar o foco para o app, e a cada 15 min.
    useEffect(() => {
        if (import.meta.env.DEV) return

        const controller = new AbortController()
        let cancelado = false

        const verificar = async () => {
            if (cancelado || document.visibilityState !== 'visible') return
            const publicado = await buscarBuildPublicado(controller.signal)
            if (!cancelado && publicado && publicado !== __BUILD_ID__) {
                setUpdatePendente(true)
            }
        }

        void verificar()
        const timer = window.setInterval(() => void verificar(), POLL_INTERVAL_MS)
        document.addEventListener('visibilitychange', verificar)

        return () => {
            cancelado = true
            controller.abort()
            window.clearInterval(timer)
            document.removeEventListener('visibilitychange', verificar)
        }
    }, [])

    // Aplicação: só quando for seguro. Reavalia a cada navegação e a cada mudança
    // do carrinho, então o reload acontece no primeiro momento tranquilo.
    useEffect(() => {
        if (!updatePendente || recarregando.current) return
        if (itensNoCarrinho > 0 || isRotaDeCheckout(pathname)) return

        recarregando.current = true
        window.location.reload()
    }, [updatePendente, pathname, itensNoCarrinho])
}
