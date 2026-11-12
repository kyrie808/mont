// Edge Function: upload-product-image
// Sobe imagem de produto pro bucket 'products' usando service_role (bypassa RLS).
// Motivo: o Storage rejeita o JWT do interno (descompasso de chave de assinatura JWT
// entre serviços) → upload client-side dá 403. Aqui validamos o admin pelo JWT (via
// is_admin no PostgREST, que aceita o token) e subimos com service_role.
//
// Chamado pelo interno via supabase.functions.invoke('upload-product-image', { body: FormData })
// Subir:   FormData file (File), old_url (string, opcional — remove o antigo). Resposta: { url } | { error }.
// Remover: FormData remover (JSON com a lista de URLs públicas do bucket 'products') — apaga os arquivos que
//          nenhum produto usa mais (cat_imagens_produto / sis_imagens_produto). Resposta: { removidos, mantidos } | { error }.
//          Usado pela galeria do produto no interno ao tirar uma foto (antes o interno tentava apagar
//          direto no Storage, que recusa o JWT dele, e o arquivo ficava órfão).
//
// Versões leves (12/11/2026): cada foto que sobe ganha duas cópias em webp, que a loja usa no lugar do
// /_next/image da Vercel (cota acabou): variantes/800/<nome>.webp e variantes/200/<nome>.webp (lado maior
// até 800 e 200 px). Quem reduz é o Image Transformation do Supabase, uma vez por foto. Remover ou trocar
// a foto apaga as versões junto. Mesma convenção de apps/loja/src/lib/imagem/variantes.ts.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const PREFIXO_PUBLICO = '/storage/v1/object/public/products/'
const LARGURAS_VARIANTE = [200, 800] as const

/** Caminhos das versões leves de uma foto do bucket (ver o topo do arquivo). */
function caminhosVariantes(caminho: string): string[] {
  return LARGURAS_VARIANTE.map((l) => `variantes/${l}/${caminho}.webp`)
}

/**
 * Gera as versões leves de uma foto que já está no bucket: pede ao Image Transformation do Supabase a foto
 * reduzida (lado maior até a largura, sem ampliar) em webp e grava a cópia fixa. Falhou: a loja usa o original.
 */
async function gerarVariantes(caminho: string, admin: SupabaseClient): Promise<string | null> {
  const base = Deno.env.get('SUPABASE_URL')!
  for (const largura of LARGURAS_VARIANTE) {
    const render = `${base}/storage/v1/render/image/public/products/${encodeURI(caminho)}` +
      `?width=${largura}&height=${largura}&resize=contain&quality=80`
    const resposta = await fetch(render, { headers: { Accept: 'image/webp' } })
    const tipo = resposta.headers.get('content-type') ?? ''
    if (!resposta.ok || !tipo.startsWith('image/webp')) {
      return `render ${largura}: HTTP ${resposta.status} (${tipo || 'sem tipo'})`
    }
    const { error } = await admin.storage.from('products').upload(`variantes/${largura}/${caminho}.webp`, await resposta.blob(), {
      cacheControl: '86400',
      upsert: true,
      contentType: 'image/webp',
    })
    if (error) return `upload ${largura}: ${error.message}`
  }
  return null
}

/** Apaga do bucket as fotos que nenhum produto usa mais. Só aceita URLs públicas do próprio bucket. */
async function removerArquivos(lista: string, admin: ReturnType<typeof createClient>): Promise<Response> {
  let urls: unknown
  try {
    urls = JSON.parse(lista)
  } catch {
    return json({ error: 'remover deve ser uma lista JSON de URLs' }, 400)
  }
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > 12) {
    return json({ error: 'remover deve ter de 1 a 12 URLs' }, 400)
  }
  const base = Deno.env.get('SUPABASE_URL')! + PREFIXO_PUBLICO
  const nomes = new Map<string, string>()
  for (const u of urls) {
    if (typeof u !== 'string' || !u.startsWith(base)) return json({ error: 'URL fora do bucket de produtos' }, 400)
    const nome = u.slice(base.length)
    if (!/^[A-Za-z0-9._-]+$/.test(nome)) return json({ error: 'Nome de arquivo inválido' }, 400)
    nomes.set(u, nome)
  }

  // Ainda em uso por algum produto (galeria ou foto das listas do sistema)? Então fica.
  const todas = [...nomes.keys()]
  const [cat, sis] = await Promise.all([
    admin.from('cat_imagens_produto').select('url').in('url', todas),
    admin.from('sis_imagens_produto').select('url').in('url', todas),
  ])
  const erroUso = cat.error ?? sis.error
  if (erroUso) return json({ error: `Falha ao conferir o uso: ${erroUso.message}` }, 500)
  const emUso = new Set([...(cat.data ?? []), ...(sis.data ?? [])].map((l: { url: string }) => l.url))

  const apagar = todas.filter((u) => !emUso.has(u))
  if (apagar.length > 0) {
    const arquivos = apagar.flatMap((u) => [nomes.get(u)!, ...caminhosVariantes(nomes.get(u)!)])
    const { error } = await admin.storage.from('products').remove(arquivos)
    if (error) return json({ error: `Remoção falhou: ${error.message}` }, 500)
  }
  return json({ removidos: apagar.map((u) => nomes.get(u)), mantidos: todas.filter((u) => emUso.has(u)).map((u) => nomes.get(u)) }, 200)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Sem autorização' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1. Verifica que o chamador é admin — usa o JWT do usuário no PostgREST (que aceita o token).
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: isAdmin, error: adminErr } = await userClient.rpc('is_admin')
    if (adminErr) return json({ error: `Falha ao verificar admin: ${adminErr.message}` }, 500)
    if (!isAdmin) return json({ error: 'Acesso negado: apenas administradores' }, 403)

    // 2. Lê o multipart.
    const form = await req.formData()
    const remover = form.get('remover')
    if (typeof remover === 'string') return await removerArquivos(remover, createClient(url, serviceKey))
    const file = form.get('file') as File | null
    const oldUrl = (form.get('old_url') as string | null) || null
    if (!file) return json({ error: 'Arquivo (file) é obrigatório' }, 400)

    // 3. Sobe com service_role (bypassa RLS do Storage).
    const admin = createClient(url, serviceKey)

    if (oldUrl) {
      const oldName = oldUrl.split('/').pop()
      if (oldName) await admin.storage.from('products').remove([oldName, ...caminhosVariantes(oldName)])
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await admin.storage.from('products').upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })
    if (upErr) return json({ error: `Upload falhou: ${upErr.message}` }, 500)

    // Versões leves para a loja. Se falhar, a foto já subiu e a loja mostra o original: só registra.
    const erroVariantes = await gerarVariantes(fileName, admin)
    if (erroVariantes) console.error(`[upload-product-image] versões leves de ${fileName}: ${erroVariantes}`)

    const { data: pub } = admin.storage.from('products').getPublicUrl(fileName)
    return json({ url: pub.publicUrl }, 200)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
