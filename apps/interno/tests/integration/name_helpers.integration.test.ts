import { afterAll, describe, expect, it } from 'vitest'
import { createTestServiceClient } from '@mont/shared/test-utils'

const supabase = createTestServiceClient()

afterAll(() => {
  // no-op for symmetry with other integration suites
})

describe('fn_count_words', () => {
  it('retorna 0 para null', async () => {
    const { data, error } = await supabase.rpc('fn_count_words', { texto: null })
    expect(error).toBeNull()
    expect(data).toBe(0)
  })

  it('retorna 0 para string vazia', async () => {
    const { data, error } = await supabase.rpc('fn_count_words', { texto: '' })
    expect(error).toBeNull()
    expect(data).toBe(0)
  })

  it('retorna 0 para apenas espacos', async () => {
    const { data, error } = await supabase.rpc('fn_count_words', { texto: '  ' })
    expect(error).toBeNull()
    expect(data).toBe(0)
  })

  it('retorna 1 para nome simples', async () => {
    const { data, error } = await supabase.rpc('fn_count_words', { texto: 'Simone' })
    expect(error).toBeNull()
    expect(data).toBe(1)
  })

  it('retorna 2 para duas palavras', async () => {
    const { data, error } = await supabase.rpc('fn_count_words', { texto: 'Simone Saturnino' })
    expect(error).toBeNull()
    expect(data).toBe(2)
  })

  it('normaliza espacos e conta corretamente', async () => {
    const { data, error } = await supabase.rpc('fn_count_words', {
      texto: '  Simone   Saturnino  de  Barros  '
    })
    expect(error).toBeNull()
    expect(data).toBe(4)
  })

  it('retorna 4 para nome completo', async () => {
    const { data, error } = await supabase.rpc('fn_count_words', {
      texto: 'Simone Saturnino de Barros'
    })
    expect(error).toBeNull()
    expect(data).toBe(4)
  })
})

describe('fn_capitalize_name', () => {
  it('retorna null para null', async () => {
    const { data, error } = await supabase.rpc('fn_capitalize_name', { nome: null })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('retorna vazio para string vazia', async () => {
    const { data, error } = await supabase.rpc('fn_capitalize_name', { nome: '' })
    expect(error).toBeNull()
    expect(data).toBe('')
  })

  it('capitaliza nome completo com preposicao', async () => {
    const { data, error } = await supabase.rpc('fn_capitalize_name', {
      nome: 'SIMONE SATURNINO DE BARROS'
    })
    expect(error).toBeNull()
    expect(data).toBe('Simone Saturnino de Barros')
  })

  it('mantem preposicao interna em minusculo', async () => {
    const { data, error } = await supabase.rpc('fn_capitalize_name', { nome: 'joão da silva' })
    expect(error).toBeNull()
    expect(data).toBe('João da Silva')
  })

  it('mantem dos em minusculo', async () => {
    const { data, error } = await supabase.rpc('fn_capitalize_name', { nome: 'maria dos santos' })
    expect(error).toBeNull()
    expect(data).toBe('Maria dos Santos')
  })

  it('mantem e em minusculo quando interno', async () => {
    const { data, error } = await supabase.rpc('fn_capitalize_name', { nome: 'PEDRO E PAULO' })
    expect(error).toBeNull()
    expect(data).toBe('Pedro e Paulo')
  })

  it('garante primeira palavra em maiusculo mesmo sendo preposicao', async () => {
    const { data, error } = await supabase.rpc('fn_capitalize_name', { nome: 'DE SOUZA' })
    expect(error).toBeNull()
    expect(data).toBe('De Souza')
  })

  it('mantem uma palavra de forma idempotente', async () => {
    const { data, error } = await supabase.rpc('fn_capitalize_name', { nome: 'Simone' })
    expect(error).toBeNull()
    expect(data).toBe('Simone')
  })

  it('normaliza espacos em excesso', async () => {
    const { data, error } = await supabase.rpc('fn_capitalize_name', {
      nome: '  simone  saturnino  '
    })
    expect(error).toBeNull()
    expect(data).toBe('Simone Saturnino')
  })
})
