/*
 * Service worker suicida — NÃO DELETAR ESTE ARQUIVO.
 *
 * Contexto (04/08/2026): o app teve PWA (vite-plugin-pwa, registerType 'prompt')
 * até 09/07/2026, quando o plugin foi removido em 7b58eb7. Remover o plugin NÃO
 * desregistra os service workers já instalados nos aparelhos. Pior: sem este
 * arquivo, `/sw.js` caía no rewrite catch-all do vercel.json e respondia
 * 200 com Content-Type text/html. Pela spec do Service Worker, um update cujo
 * script volta com MIME não-JavaScript FALHA e mantém o registro antigo ativo
 * (só 404/410 desregistram). Resultado: o celular do Gilmar ficou servindo um
 * build congelado de antes de 09/07 por quase um mês, sem receber nenhuma
 * correção — incluindo a blindagem da Nova Venda (venda sumindo em sinal fraco).
 *
 * Este arquivo troca aquele HTML por um JS válido que se autodestrói: o browser
 * baixa na próxima checagem de update, instala, apaga os caches, desregistra o
 * SW e recarrega as abas abertas. O aparelho descongela sozinho, sem ninguém
 * precisar limpar dados na mão.
 *
 * Precisa continuar existindo enquanto houver algum aparelho que ainda não
 * passou por aqui. Como não temos telemetria pra saber quando isso acontece,
 * trate como permanente: o custo de manter é um arquivo estático de 1KB.
 */

// O SW antigo era registerType 'prompt', ou seja, um SW novo ficaria em "waiting"
// esperando interação. skipWaiting força a troca já na primeira visita.
self.addEventListener('install', () => {
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            // 1. Apaga o precache do workbox (é ele que serve o index.html velho).
            try {
                const keys = await caches.keys()
                await Promise.all(keys.map((k) => caches.delete(k)))
            } catch {
                /* segue: desregistrar importa mais que limpar */
            }

            // 2. Se desregistra. A partir daqui o domínio volta a ser servido
            //    direto pela rede, sem intermediário.
            try {
                await self.registration.unregister()
            } catch {
                /* ignore */
            }

            // 3. Recarrega as abas abertas pra puxar o build atual na hora, em vez
            //    de esperar o usuário fechar e reabrir o app.
            try {
                const clients = await self.clients.matchAll({ type: 'window' })
                for (const client of clients) {
                    client.navigate(client.url)
                }
            } catch {
                /* ignore */
            }
        })(),
    )
})

// Sem handler de 'fetch' de propósito: enquanto este SW estiver vivo (poucos
// segundos), toda requisição vai direto pra rede, sem cache nenhum no caminho.
