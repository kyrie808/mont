import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanTestData, createTestServiceClient } from '@mont/shared/test-utils'

const supabase = createTestServiceClient()

let produto: { id: string; nome: string; preco: number }

function makeItens() {
  return [
    {
      product_id: produto.id,
      product_name: produto.nome,
      quantity: 2,
      unit_price: produto.preco,
      total: produto.preco * 2
    }
  ]
}

async function criarPedido(params: {
  nome: string
  telefone: string
  endereco: string
  cep: string
}) {
  return supabase.rpc('criar_pedido', {
    p_nome_cliente: params.nome,
    p_telefone_cliente: params.telefone,
    p_endereco_entrega: params.endereco,
    p_metodo_entrega: 'entrega',
    p_metodo_pagamento: 'pix',
    p_subtotal: produto.preco * 2,
    p_frete: 5,
    p_total: produto.preco * 2 + 5,
    p_observacoes: 'teste integracao nome',
    p_indicado_por: null,
    p_itens: makeItens(),
    p_cep: params.cep,
    p_logradouro: 'Rua Teste',
    p_numero: '100',
    p_complemento: 'Apto 1',
    p_bairro: 'Centro',
    p_cidade: 'Sao Paulo',
    p_uf: 'SP'
  })
}

async function buscarContatoPorTelefone(telefone: string) {
  const telefoneNorm = telefone.replace(/\D/g, '')
  const { data, error } = await supabase
    .from('contatos')
    .select('id, nome, telefone, endereco, cep')
    .eq('telefone', telefoneNorm)
    .single()

  expect(error).toBeNull()
  return data
}

async function buscarUltimoCatPedidoNome(contatoId: string) {
  const { data, error } = await supabase
    .from('cat_pedidos')
    .select('nome_cliente')
    .eq('contato_id', contatoId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .single()

  expect(error).toBeNull()
  return data?.nome_cliente
}

beforeAll(async () => {
  const { data, error } = await supabase
    .from('produtos')
    .select('id, nome, preco')
    .eq('codigo', 'PDQ001')
    .single()

  expect(error).toBeNull()
  expect(data).not.toBeNull()
  produto = data as { id: string; nome: string; preco: number }
})

afterEach(async () => {
  await cleanTestData(supabase)
})

afterAll(async () => {
  await cleanTestData(supabase)
})

describe('RPC criar_pedido - regra de enriquecimento de nome', () => {
  it('cria contato novo com nome capitalizado e grava cat_pedidos.nome_cliente capitalizado', async () => {
    const telefone = '11990000001'

    const { data: rpcData, error: rpcError } = await criarPedido({
      nome: 'SIMONE SATURNINO DE BARROS',
      telefone,
      endereco: 'Rua Nova, 10',
      cep: '01310100'
    })

    expect(rpcError).toBeNull()
    expect(rpcData).not.toBeNull()

    const contato = await buscarContatoPorTelefone(telefone)
    expect(contato?.nome).toBe('Simone Saturnino de Barros')
    expect(contato?.endereco).toBe('Rua Nova, 10')
    expect(contato?.cep).toBe('01310100')

    const nomeCatPedido = await buscarUltimoCatPedidoNome(contato!.id)
    expect(nomeCatPedido).toBe('Simone Saturnino de Barros')
  })

  it('atualiza nome de contato existente quando novo nome tem mais palavras', async () => {
    const telefone = '11990000002'
    const telefoneNorm = telefone.replace(/\D/g, '')

    const { data: contatoBase, error: contatoBaseError } = await supabase
      .from('contatos')
      .insert({
        nome: 'Simone',
        telefone: telefoneNorm,
        tipo: 'B2C',
        status: 'cliente',
        origem: 'direto',
        endereco: 'Endereco antigo',
        cep: '00000000'
      })
      .select('id')
      .single()

    expect(contatoBaseError).toBeNull()

    const { error: rpcError } = await criarPedido({
      nome: 'SIMONE SATURNINO DE BARROS',
      telefone,
      endereco: 'Rua Atualizada, 20',
      cep: '04567000'
    })

    expect(rpcError).toBeNull()

    const { data: contatoAtualizado, error: contatoAtualizadoError } = await supabase
      .from('contatos')
      .select('id, nome, endereco, cep')
      .eq('id', contatoBase!.id)
      .single()

    expect(contatoAtualizadoError).toBeNull()
    expect(contatoAtualizado?.nome).toBe('Simone Saturnino de Barros')
    expect(contatoAtualizado?.endereco).toBe('Rua Atualizada, 20')
    expect(contatoAtualizado?.cep).toBe('04567000')

    const nomeCatPedido = await buscarUltimoCatPedidoNome(contatoBase!.id)
    expect(nomeCatPedido).toBe('Simone Saturnino de Barros')
  })

  it('preserva nome quando contato atual tem mais palavras e novo nome tem menos', async () => {
    const telefone = '11990000003'
    const telefoneNorm = telefone.replace(/\D/g, '')

    const { data: contatoBase, error: contatoBaseError } = await supabase
      .from('contatos')
      .insert({
        nome: 'Simone Saturnino de Barros',
        telefone: telefoneNorm,
        tipo: 'B2C',
        status: 'cliente',
        origem: 'direto',
        endereco: 'Endereco base',
        cep: '11111111'
      })
      .select('id')
      .single()

    expect(contatoBaseError).toBeNull()

    const { error: rpcError } = await criarPedido({
      nome: 'SIMONE',
      telefone,
      endereco: 'Rua Nova 3, 30',
      cep: '22222222'
    })

    expect(rpcError).toBeNull()

    const { data: contatoAtualizado, error: contatoAtualizadoError } = await supabase
      .from('contatos')
      .select('nome, endereco, cep')
      .eq('id', contatoBase!.id)
      .single()

    expect(contatoAtualizadoError).toBeNull()
    expect(contatoAtualizado?.nome).toBe('Simone Saturnino de Barros')
    expect(contatoAtualizado?.endereco).toBe('Rua Nova 3, 30')
    expect(contatoAtualizado?.cep).toBe('22222222')

    const nomeCatPedido = await buscarUltimoCatPedidoNome(contatoBase!.id)
    expect(nomeCatPedido).toBe('Simone')
  })

  it('preserva nome quando quantidade de palavras eh igual', async () => {
    const telefone = '11990000004'
    const telefoneNorm = telefone.replace(/\D/g, '')

    const { data: contatoBase, error: contatoBaseError } = await supabase
      .from('contatos')
      .insert({
        nome: 'Simone Saturnino',
        telefone: telefoneNorm,
        tipo: 'B2C',
        status: 'cliente',
        origem: 'direto',
        endereco: 'Endereco base 4',
        cep: '33333333'
      })
      .select('id')
      .single()

    expect(contatoBaseError).toBeNull()

    const { error: rpcError } = await criarPedido({
      nome: 'SIMONE MARIA',
      telefone,
      endereco: 'Rua Nova 4, 40',
      cep: '44444444'
    })

    expect(rpcError).toBeNull()

    const { data: contatoAtualizado, error: contatoAtualizadoError } = await supabase
      .from('contatos')
      .select('nome, endereco, cep')
      .eq('id', contatoBase!.id)
      .single()

    expect(contatoAtualizadoError).toBeNull()
    expect(contatoAtualizado?.nome).toBe('Simone Saturnino')
    expect(contatoAtualizado?.endereco).toBe('Rua Nova 4, 40')
    expect(contatoAtualizado?.cep).toBe('44444444')

    const nomeCatPedido = await buscarUltimoCatPedidoNome(contatoBase!.id)
    expect(nomeCatPedido).toBe('Simone Maria')
  })
})
