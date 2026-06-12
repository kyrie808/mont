// Edge Function: upload-product-image
// Sobe imagem de produto pro bucket 'products' usando service_role (bypassa RLS).
// Motivo: o Storage rejeita o JWT do interno (descompasso de chave de assinatura JWT
// entre serviços) → upload client-side dá 403. Aqui validamos o admin pelo JWT (via
// is_admin no PostgREST, que aceita o token) e subimos com service_role.
//
// Chamado pelo interno via supabase.functions.invoke('upload-product-image', { body: FormData })
// FormData: file (File, obrigatório), old_url (string, opcional — remove o antigo).
// Resposta: { url } | { error }.

import { createClient } from 'jsr:@supabase/supabase-js@2'

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
    const file = form.get('file') as File | null
    const oldUrl = (form.get('old_url') as string | null) || null
    if (!file) return json({ error: 'Arquivo (file) é obrigatório' }, 400)

    // 3. Sobe com service_role (bypassa RLS do Storage).
    const admin = createClient(url, serviceKey)

    if (oldUrl) {
      const oldName = oldUrl.split('/').pop()
      if (oldName) await admin.storage.from('products').remove([oldName])
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const fileName = `${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await admin.storage.from('products').upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })
    if (upErr) return json({ error: `Upload falhou: ${upErr.message}` }, 500)

    const { data: pub } = admin.storage.from('products').getPublicUrl(fileName)
    return json({ url: pub.publicUrl }, 200)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
