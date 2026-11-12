// Gera as versões leves (webp) das fotos que JÁ estão no bucket "products" (12/11/2026).
// As fotos novas ganham as versões na hora do upload (Edge Function upload-product-image); este script
// cobre as antigas. Não apaga nem altera nenhum original: só cria arquivos em products/variantes/.
//
//   products/<caminho>  →  products/variantes/800/<caminho>.webp  e  products/variantes/200/<caminho>.webp
//   (mesma convenção de apps/loja/src/lib/imagem/variantes.ts e da Edge Function)
//
// Quem reduz é o Image Transformation do Supabase (lado maior até 800/200 px, sem ampliar, webp q80).
//
// Uso (a chave service_role vem do ambiente ou dos .env.local da loja e da raiz, lidos como o Next lê; nunca é impressa):
//   node supabase/scripts/gerar-variantes-fotos.mjs            # só lista
//   node supabase/scripts/gerar-variantes-fotos.mjs --aplicar  # gera o que falta
//   ... --aplicar --refazer   # gera de novo mesmo as que já existem

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// Sem as variáveis no ambiente: lê os .env da loja e os da raiz do repo (onde fica a service_role), do mesmo
// jeito que o Next lê (@next/env). Nada é copiado nem impresso. Precedência: ambiente > loja > raiz.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const pastaLoja = fileURLToPath(new URL('../../apps/loja/', import.meta.url))
    const pastaRaiz = fileURLToPath(new URL('../../', import.meta.url))
    // No pnpm o @next/env é dependência do next (não da loja): resolve a partir dele.
    const doNext = createRequire(createRequire(`${pastaLoja}package.json`).resolve('next/package.json'))
    const { loadEnvConfig, updateInitialEnv } = doNext('@next/env')
    const semLog = { info: () => {}, error: console.error }
    loadEnvConfig(pastaLoja, false, semLog)
    // A 2ª leitura (forçada) volta ao ambiente inicial antes de ler: o que veio da loja vira esse inicial,
    // e a raiz só completa o que falta.
    updateInitialEnv({ ...process.env })
    loadEnvConfig(pastaRaiz, false, semLog, true)
}

const BUCKET = 'products'
const LARGURAS = [200, 800]
const PASTA_VARIANTES = 'variantes'

const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!base || !chave) {
    // Só os nomes do que falta (nunca valores).
    const faltam = [!base && 'SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL)', !chave && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean)
    console.error(`Falta no ambiente: ${faltam.join(' e ')}.`)
    process.exit(1)
}
const aplicar = process.argv.includes('--aplicar')
const refazer = process.argv.includes('--refazer')
const autorizacao = { Authorization: `Bearer ${chave}`, apikey: chave }

/** Todos os arquivos do bucket (a API lista uma pasta por vez; pasta vem com id null). */
async function listar(prefixo = '') {
    const arquivos = []
    for (let offset = 0; ; offset += 1000) {
        const resposta = await fetch(`${base}/storage/v1/object/list/${BUCKET}`, {
            method: 'POST',
            headers: { ...autorizacao, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix: prefixo, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
        })
        if (!resposta.ok) throw new Error(`listar "${prefixo}": HTTP ${resposta.status} ${await resposta.text()}`)
        const itens = await resposta.json()
        for (const item of itens) {
            const caminho = prefixo ? `${prefixo}/${item.name}` : item.name
            if (item.id === null) arquivos.push(...(await listar(caminho)))
            else arquivos.push({ caminho, tipo: item.metadata?.mimetype ?? '' })
        }
        if (itens.length < 1000) break
    }
    return arquivos
}

async function gerar(caminho, largura) {
    const render =
        `${base}/storage/v1/render/image/public/${BUCKET}/${encodeURI(caminho)}` +
        `?width=${largura}&height=${largura}&resize=contain&quality=80`
    const resposta = await fetch(render, { headers: { Accept: 'image/webp' } })
    const tipo = resposta.headers.get('content-type') ?? ''
    if (!resposta.ok || !tipo.startsWith('image/webp')) throw new Error(`render ${largura}: HTTP ${resposta.status} (${tipo})`)
    const bytes = Buffer.from(await resposta.arrayBuffer())
    const destino = `${PASTA_VARIANTES}/${largura}/${caminho}.webp`
    const envio = await fetch(`${base}/storage/v1/object/${BUCKET}/${encodeURI(destino)}`, {
        method: 'POST',
        headers: { ...autorizacao, 'Content-Type': 'image/webp', 'x-upsert': 'true', 'cache-control': 'max-age=86400' },
        body: bytes,
    })
    if (!envio.ok) throw new Error(`upload ${destino}: HTTP ${envio.status} ${await envio.text()}`)
    return bytes.length
}

const todos = await listar()
const existentes = new Set(todos.map((a) => a.caminho))
const originais = todos.filter((a) => !a.caminho.startsWith(`${PASTA_VARIANTES}/`) && a.tipo.startsWith('image/'))
const pendentes = originais.flatMap((o) =>
    LARGURAS.filter((l) => refazer || !existentes.has(`${PASTA_VARIANTES}/${l}/${o.caminho}.webp`)).map((l) => ({ ...o, largura: l })),
)

console.log(`${originais.length} fotos originais · ${pendentes.length} versões leves a gerar${aplicar ? '' : ' (só listando; use --aplicar)'}`)
if (!aplicar) {
    for (const p of pendentes) console.log(`  ${PASTA_VARIANTES}/${p.largura}/${p.caminho}.webp`)
    process.exit(0)
}

let ok = 0
const falhas = []
for (const p of pendentes) {
    try {
        const bytes = await gerar(p.caminho, p.largura)
        ok++
        console.log(`  ok  ${p.largura}  ${p.caminho}  (${Math.round(bytes / 1024)} KB)`)
    } catch (e) {
        falhas.push(`${p.caminho} (${p.largura}): ${e.message}`)
        console.log(`  ERRO ${p.largura}  ${p.caminho}: ${e.message}`)
    }
}
console.log(`\n${ok} geradas, ${falhas.length} falhas.`)
if (falhas.length > 0) process.exit(1)
