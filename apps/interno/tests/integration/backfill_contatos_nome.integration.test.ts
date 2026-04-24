import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { cleanTestData, createTestServiceClient } from '@mont/shared/test-utils'

const supabase = createTestServiceClient()

type ContatoSeed = {
  id: string
  nome: string
}

async function inserirContato(nome: string, telefone: string) {
  const { data, error } = await supabase
    .from('contatos')
    .insert({
      nome,
      telefone,
      tipo: 'B2C',
      status: 'cliente',
      origem: 'direto'
    })
    .select('id, nome')
    .single()

  expect(error).toBeNull()
  return data as ContatoSeed
}

async function inserirCatPedido(contatoId: string, nomeCliente: string, telefone: string, criadoEm: string) {
  const { error } = await supabase.from('cat_pedidos').insert({
    contato_id: contatoId,
    nome_cliente: nomeCliente,
    telefone_cliente: telefone,
    criado_em: criadoEm,
    metodo_entrega: 'entrega',
    metodo_pagamento: 'pix',
    subtotal: 10,
    frete: 0,
    total: 10,
    status: 'pendente',
    status_pagamento: 'pendente'
  })

  expect(error).toBeNull()
}

afterEach(async () => {
  await cleanTestData(supabase)
})

afterAll(async () => {
  await cleanTestData(supabase)
})

describe('backfill de contatos.nome via cat_pedidos', () => {
  it('aplica regra de maior riqueza de nome e cria snapshot', async () => {
    const contatoA = await inserirContato('Simone', '11991000001')
    const contatoB = await inserirContato('Simone', '11991000002')
    const contatoC = await inserirContato('Maria Silva', '11991000003')
    const contatoD = await inserirContato('João', '11991000004')
    const contatoE = await inserirContato('Pedro Santos', '11991000005')

    await inserirCatPedido(contatoB.id, 'SIMONE SATURNINO DE BARROS', '11991000002', '2026-04-23T08:00:00Z')
    await inserirCatPedido(contatoC.id, 'Maria', '11991000003', '2026-04-23T08:00:00Z')
    await inserirCatPedido(contatoD.id, 'João Pedro', '11991000004', '2026-04-23T08:00:00Z')
    await inserirCatPedido(contatoD.id, 'João Pedro Silva', '11991000004', '2026-04-23T09:00:00Z')
    await inserirCatPedido(contatoE.id, 'pedro santos', '11991000005', '2026-04-23T08:00:00Z')

    const { data: rpcData, error: rpcError } = await supabase.rpc('fn_backfill_contatos_nome')
    expect(rpcError).toBeNull()
    expect(rpcData).not.toBeNull()

    const { data: contatos, error: contatosError } = await supabase
      .from('contatos')
      .select('id, nome')
      .in('id', [contatoA.id, contatoB.id, contatoC.id, contatoD.id, contatoE.id])

    expect(contatosError).toBeNull()
    const porId = new Map((contatos ?? []).map((item) => [item.id, item.nome]))

    expect(porId.get(contatoA.id)).toBe('Simone')
    expect(porId.get(contatoB.id)).toBe('Simone Saturnino de Barros')
    expect(porId.get(contatoC.id)).toBe('Maria Silva')
    expect(porId.get(contatoD.id)).toBe('João Pedro Silva')
    expect(porId.get(contatoE.id)).toBe('Pedro Santos')

    const { data: logs, error: logsError } = await supabase
      .from('backfill_contatos_nome_log')
      .select('snapshot_table_name, total_snapshot, total_atualizados, criado_em')
      .order('criado_em', { ascending: false })
      .limit(1)
      .single()

    expect(logsError).toBeNull()
    expect(logs?.snapshot_table_name.startsWith('_backup_contatos_nome_')).toBe(true)
    expect(logs?.total_snapshot).toBe(5)
    expect(logs?.total_atualizados).toBe(2)
  })
})
