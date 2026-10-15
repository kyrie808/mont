// Backfill do CRM a partir da tabela `Message` da Evolution.
//
// Repõe em `mensagens_whatsapp` o que o webhook não entregou (ex.: envios pela API antes
// do SEND_MESSAGE ser ligado, em 14/10/2026). Manda DIRETO ao ingestor, sem passar pelo
// n8n: o W1 acionaria a secretária (W3) para cada mensagem antiga.
//
// Idempotente: o ingestor grava ignorando `message_id` repetido (índice único), e
// `ultimo_contato` só avança. Rodar duas vezes não duplica nada.
//
// Uso (da raiz do repo, com o Docker do CRM de pé):
//   deno run --allow-run=docker --allow-read --allow-net=herlvujykltxnwqmwmyx.supabase.co \
//     infra/crm/scripts/backfill-evolution.ts --desde 2026-10-12T00:00:00-03:00 [--gravar]
//
// Sem --gravar é simulação: lê a Evolution e mostra o que seria enviado, sem rede.
// Quantas já existem no Supabase se confere por SQL (ver README, "Backfill").
// --gravar lê INGESTOR_SECRET de infra/crm/.env e nunca o imprime.

import {
  isJidIgnorado,
  normalizarMensagem,
} from '../../../packages/shared/src/whatsapp.ts'

const INGESTOR_URL = 'https://herlvujykltxnwqmwmyx.supabase.co/functions/v1/whatsapp-ingestor'
const LOTE = 50

type Json = Record<string, unknown>

function lerArgs(): { desde: Date; gravar: boolean } {
  const i = Deno.args.indexOf('--desde')
  const desde = i >= 0 ? new Date(Deno.args[i + 1] ?? '') : new Date(NaN)
  if (Number.isNaN(desde.getTime())) {
    throw new Error('Informe --desde com data ISO e fuso, ex.: --desde 2026-10-12T00:00:00-03:00')
  }
  return { desde, gravar: Deno.args.includes('--gravar') }
}

/** Mensagens da instância `mont` desde `desde`, uma por linha, como JSON. */
async function exportarDaEvolution(desde: Date): Promise<Json[]> {
  const epoch = Math.floor(desde.getTime() / 1000) // inteiro validado: seguro no SQL
  const sql = `
    select json_build_object(
      'key', m.key, 'pushName', m."pushName", 'message', m.message,
      'messageType', m."messageType", 'messageTimestamp', m."messageTimestamp",
      'contextInfo', m."contextInfo", 'source', m.source, 'status', m.status)::text
    from "Message" m join "Instance" i on i.id = m."instanceId"
    where i.name = 'mont' and m."messageTimestamp" >= ${epoch}
    order by m."messageTimestamp";`

  const cmd = new Deno.Command('docker', {
    args: ['exec', '-i', 'mont-crm-postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d evolution -At -v ON_ERROR_STOP=1'],
    stdin: 'piped', stdout: 'piped', stderr: 'piped',
  })
  const proc = cmd.spawn()
  const w = proc.stdin.getWriter()
  await w.write(new TextEncoder().encode(sql))
  await w.close()
  const { code, stdout, stderr } = await proc.output()
  if (code !== 0) throw new Error(`psql falhou: ${new TextDecoder().decode(stderr)}`)

  return new TextDecoder().decode(stdout).split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l))
}

/**
 * A tabela guarda a mensagem de contato em LID com `remoteJid` = LID e o telefone em
 * `remoteJidAlt`. Ao vivo a Evolution entrega com o telefone no `remoteJid`; aqui
 * reproduzimos isso. LID sem `remoteJidAlt` segue como está: o ingestor resolve pelo
 * `wa_lid_map`.
 */
function comoWebhook(crua: Json): Json {
  const key = (crua.key ?? {}) as Json
  const jid = key.remoteJid
  const alt = key.remoteJidAlt
  if (typeof jid === 'string' && jid.endsWith('@lid') && typeof alt === 'string' && alt) {
    return { ...crua, key: { ...key, remoteJid: alt } }
  }
  return crua
}

function diaBrt(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
    .format(new Date(iso))
}

async function lerSegredo(): Promise<string> {
  const env = await Deno.readTextFile(new URL('../.env', import.meta.url))
  const linha = env.split(/\r?\n/).find((l) => l.startsWith('INGESTOR_SECRET='))
  const valor = linha?.slice('INGESTOR_SECRET='.length).trim().replace(/^["']|["']$/g, '')
  if (!valor) throw new Error('INGESTOR_SECRET não encontrado em infra/crm/.env')
  return valor
}

async function main() {
  const { desde, gravar } = lerArgs()
  const lidas = await exportarDaEvolution(desde)

  // Grupo, status e newsletter não saem da máquina: o ingestor descartaria de qualquer jeito.
  const enviar = lidas
    .filter((c) => !isJidIgnorado(((c.key ?? {}) as Json).remoteJid as string | undefined))
    .map(comoWebhook)

  const porDia = new Map<string, number>()
  let semTelefone = 0
  for (const c of enviar) {
    const m = normalizarMensagem(c)
    if (!m) { semTelefone++; continue }
    const k = `${diaBrt(m.enviadaEm)} ${m.direcao}`
    porDia.set(k, (porDia.get(k) ?? 0) + 1)
  }

  console.log(`Evolution desde ${desde.toISOString()}: ${lidas.length} lidas, ${lidas.length - enviar.length} de grupo/status ficam de fora, ${enviar.length} a enviar`)
  console.log(`  com telefone: ${enviar.length - semTelefone}; LID sem telefone (o ingestor resolve pelo wa_lid_map): ${semTelefone}`)
  for (const [k, n] of [...porDia].sort()) console.log(`  ${k}: ${n}`)

  if (!gravar) {
    console.log('Simulação: nada enviado. Use --gravar para enviar ao ingestor.')
    return
  }

  const segredo = await lerSegredo()
  const total = { recebidas: 0, gravadas: 0, ignoradas: 0, pedidos: 0 }

  for (let i = 0; i < enviar.length; i += LOTE) {
    const lote = enviar.slice(i, i + LOTE)
    const res = await fetch(INGESTOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ingestor-secret': segredo },
      body: JSON.stringify({ event: 'messages.set', instance: 'mont', data: { messages: lote } }),
    })
    const corpo = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Lote ${i / LOTE + 1} falhou com HTTP ${res.status}: ${JSON.stringify(corpo)}`)

    total.recebidas += corpo.recebidas ?? 0
    total.gravadas += corpo.gravadas ?? 0
    total.ignoradas += corpo.ignoradas ?? 0
    total.pedidos += corpo.pedidos ?? 0
    console.log(`  lote ${i / LOTE + 1}: ${lote.length} enviadas, gravadas ${corpo.gravadas ?? 0}, ignoradas ${corpo.ignoradas ?? 0}, contatos ${JSON.stringify(corpo.contatos ?? {})}`)
  }

  console.log(`Total: ${JSON.stringify(total)}`)
}

await main()
