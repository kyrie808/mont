import { describe, it, expect } from 'vitest'
import { formatPhone } from '@mont/shared'
import { normalizarTelefone, filtroBuscaContato, isBuscaExata } from './telefone'

/**
 * `formatPhone` é a máscara única: usada tanto no input (enquanto digita)
 * quanto na exibição em lista/perfil. `packages/shared` não tem test runner,
 * então a cobertura mora aqui, que já consome o pacote.
 */
describe('formatPhone', () => {
    it('formata celular de 11 dígitos', () => {
        expect(formatPhone('11969791012')).toBe('(11) 96979-1012')
    })

    it('formata telefone FIXO de 10 dígitos com o split certo', () => {
        // Regressão: o escalonamento antigo assumia celular e devolvia
        // '(11) 33334-444'. Há 21 contatos de 10 dígitos na base.
        expect(formatPhone('1133334444')).toBe('(11) 3333-4444')
    })

    it('aceita entrada parcial sem quebrar (digitação progressiva)', () => {
        expect(formatPhone('')).toBe('')
        expect(formatPhone('1')).toBe('1')
        expect(formatPhone('11')).toBe('11')
        expect(formatPhone('1196')).toBe('(11) 96')
        expect(formatPhone('119697')).toBe('(11) 9697')
        expect(formatPhone('1196979')).toBe('(11) 9697-9')
    })

    it('é idempotente sobre valor já formatado', () => {
        expect(formatPhone('(11) 96979-1012')).toBe('(11) 96979-1012')
    })

    it('capa em 11 dígitos e ignora lixo não numérico', () => {
        expect(formatPhone('11969791012999')).toBe('(11) 96979-1012')
        expect(formatPhone('abc11969791012')).toBe('(11) 96979-1012')
    })
})

describe('normalizarTelefone', () => {
    it('reduz qualquer máscara ao mesmo identificador', () => {
        const esperado = '11969791012'
        expect(normalizarTelefone('11969791012')).toBe(esperado)
        expect(normalizarTelefone('11 96979-1012')).toBe(esperado)
        expect(normalizarTelefone('(11) 96979-1012')).toBe(esperado)
        expect(normalizarTelefone('(11)96979-1012')).toBe(esperado)
        expect(normalizarTelefone(' 11 9 6979 1012 ')).toBe(esperado)
    })

    it('tolera vazio e nulo', () => {
        expect(normalizarTelefone('')).toBe('')
        expect(normalizarTelefone(null)).toBe('')
        expect(normalizarTelefone(undefined)).toBe('')
    })
})

describe('filtroBuscaContato', () => {
    it('busca telefone SEMPRE contra telefone_norm, não contra o texto cru', () => {
        // Este é o motivo de o Gilmar não achar o cliente e cadastrar duplicado:
        // antes o filtro era `telefone.ilike.%(11) 96979-1012%` e não casava nada.
        const filtro = filtroBuscaContato('(11) 96979-1012')
        expect(filtro).toContain('telefone_norm.ilike.%11969791012%')
        expect(filtro).not.toContain('telefone.ilike')
    })

    it('acha pelo número solto, sem DDD', () => {
        expect(filtroBuscaContato('96979-1012')).toContain('telefone_norm.ilike.%969791012%')
    })

    it('busca por nome não gera cláusula de telefone', () => {
        const filtro = filtroBuscaContato('Beth')
        expect(filtro).toContain('nome_norm.ilike.%Beth%')
        expect(filtro).toContain('apelido_norm.ilike.%Beth%')
        expect(filtro).not.toContain('telefone_norm')
    })

    it('neutraliza caracteres que quebram o filtro do PostgREST', () => {
        const filtro = filtroBuscaContato('a%b_c,d)e(')
        expect(filtro).not.toContain('%b')
        expect(filtro).not.toContain('_c')
        expect(filtro).not.toContain(',d')
    })

    it('termo vazio não filtra nada', () => {
        expect(filtroBuscaContato('   ')).toBe('')
    })
})

/**
 * Espaço no fim = "acabou a palavra, quero ESSA palavra".
 * Sem espaço a busca segue por pedaço (comportamento antigo, intacto).
 * Em produção: 'Clau' acha 9 contatos por substring, 1 por palavra exata.
 */
describe('filtroBuscaContato — espaço no fim ativa palavra exata', () => {
    it('SEM espaço no fim busca por pedaço (Claudete, Claudia… entram)', () => {
        const filtro = filtroBuscaContato('Clau')
        expect(filtro).toContain('nome_norm.ilike.%Clau%')
        expect(filtro).toContain('apelido_norm.ilike.%Clau%')
        expect(filtro).not.toContain('imatch')
    })

    it('COM espaço no fim exige a palavra inteira', () => {
        const filtro = filtroBuscaContato('Clau ')
        expect(filtro).toContain('nome_norm.imatch.\\yClau\\y')
        expect(filtro).toContain('apelido_norm.imatch.\\yClau\\y')
        expect(filtro).not.toContain('ilike')
    })

    it('vários espaços no fim continuam significando exato', () => {
        expect(filtroBuscaContato('Clau   ')).toContain('nome_norm.imatch.\\yClau\\y')
    })

    it('multi-palavra vira frase ancorada', () => {
        expect(filtroBuscaContato('Maria Clau ')).toContain('nome_norm.imatch.\\yMaria Clau\\y')
    })

    it('telefone com espaço no fim exige o número completo e idêntico', () => {
        const filtro = filtroBuscaContato('11969791012 ')
        expect(filtro).toContain('telefone_norm.eq.11969791012')
        expect(filtro).not.toContain('telefone_norm.ilike')
    })

    it('telefone sem espaço continua casando pedaço do número', () => {
        const filtro = filtroBuscaContato('969791012')
        expect(filtro).toContain('telefone_norm.ilike.%969791012%')
        expect(filtro).not.toContain('telefone_norm.eq')
    })

    it('só espaços não vira busca exata de nada — devolve filtro vazio', () => {
        // Regressão: se isto devolvesse filtro, o join !inner de vendas
        // esconderia vendas sem contato sem aplicar filtro nenhum.
        expect(filtroBuscaContato('   ')).toBe('')
        expect(filtroBuscaContato(' ')).toBe('')
    })

    it('escapa metacaractere de regex para não virar curinga', () => {
        const filtro = filtroBuscaContato('Ana+ ')
        expect(filtro).toContain('nome_norm.imatch.\\yAna\\+\\y')
    })

    it('mantém a sanitização do .or() também no modo exato', () => {
        const filtro = filtroBuscaContato('a%b_c,d)e( ')
        expect(filtro).not.toContain('%b')
        expect(filtro).not.toContain('_c')
        expect(filtro).not.toContain(',d')
        expect(filtro).not.toContain(')e')
    })
})

/**
 * Acento não pode separar cliente de quem procura por ele.
 * 140 dos 807 contatos têm acento no nome (17%). A busca casa contra
 * `nome_norm`/`apelido_norm` — colunas geradas com `normalize(NFD)` no banco,
 * espelho exato do `stripAccents` aplicado aqui no termo.
 */
describe('filtroBuscaContato — acento é irrelevante', () => {
    it('com e sem acento produzem O MESMO filtro (modo exato)', () => {
        expect(filtroBuscaContato('Cláudia ')).toBe(filtroBuscaContato('Claudia '))
        expect(filtroBuscaContato('Cláudia ')).toContain('nome_norm.imatch.\\yClaudia\\y')
    })

    it('com e sem acento produzem O MESMO filtro (modo pedaço)', () => {
        expect(filtroBuscaContato('Antônio')).toBe(filtroBuscaContato('Antonio'))
        expect(filtroBuscaContato('Antônio')).toContain('nome_norm.ilike.%Antonio%')
    })

    it('normaliza acento em qualquer posição da palavra', () => {
        expect(filtroBuscaContato('Mendonça ')).toContain('nome_norm.imatch.\\yMendonca\\y')
        expect(filtroBuscaContato('Thaís')).toContain('nome_norm.ilike.%Thais%')
        expect(filtroBuscaContato('Ainoã')).toContain('nome_norm.ilike.%Ainoa%')
        expect(filtroBuscaContato('Écio')).toContain('nome_norm.ilike.%Ecio%')
    })

    it('nunca mira as colunas cruas — só as normalizadas', () => {
        for (const termo of ['Ana', 'Ana ', 'Cláudia', 'Cláudia ']) {
            const filtro = filtroBuscaContato(termo)
            expect(filtro).not.toMatch(/(^|,)nome\./)
            expect(filtro).not.toMatch(/(^|,)apelido\./)
        }
    })
})

/**
 * Regra que a barra de busca usa pra mostrar o chip "palavra exata".
 * Fica aqui pra UI e filtro nunca discordarem sobre o que ativa o modo.
 */
describe('isBuscaExata', () => {
    it('true só quando há conteúdo E espaço no fim', () => {
        expect(isBuscaExata('Clau ')).toBe(true)
        expect(isBuscaExata('Maria Clau ')).toBe(true)
        expect(isBuscaExata('Clau   ')).toBe(true)
    })

    it('false sem espaço no fim', () => {
        expect(isBuscaExata('Clau')).toBe(false)
        expect(isBuscaExata('Maria Clau')).toBe(false)
    })

    it('false quando só há espaço em branco', () => {
        expect(isBuscaExata('')).toBe(false)
        expect(isBuscaExata(' ')).toBe(false)
        expect(isBuscaExata('   ')).toBe(false)
    })

    it('concorda com o filtro: chip aceso ⇔ filtro em modo exato', () => {
        for (const termo of ['Clau ', 'Clau', 'Ana ', '   ', 'Cláudia ']) {
            const filtro = filtroBuscaContato(termo)
            if (filtro) {
                expect(filtro.includes('imatch')).toBe(isBuscaExata(termo))
            }
        }
    })
})
