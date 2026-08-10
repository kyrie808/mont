import { describe, it, expect } from 'vitest'
import {
    telefoneWa,
    telefoneWaDeJid,
    isJidIgnorado,
    extrairReferral,
    lerCtwaClid,
    lerSourceId,
    extrairMensagensCruas,
    normalizarMensagem,
} from '@mont/shared'

// Camada pura: sem banco, sem rede, sem harness de integração.

describe('telefoneWa — chave canônica', () => {
    it('mantém o celular de 11 dígitos, que é o formato de 783 dos 810 contatos', () => {
        expect(telefoneWa('11910049290')).toBe('5511910049290')
    })

    it('aceita o número já com DDI, como vem do JID do WhatsApp', () => {
        expect(telefoneWa('5511910049290')).toBe('5511910049290')
    })

    it('ignora máscara — é o mesmo cliente digitado de qualquer jeito', () => {
        const esperado = '5511969791012'
        expect(telefoneWa('(11) 96979-1012')).toBe(esperado)
        expect(telefoneWa('11 96979 1012')).toBe(esperado)
        expect(telefoneWa('+55 (11) 96979-1012')).toBe(esperado)
    })

    it('recompõe o 9º dígito de celular antigo cadastrado com 10 dígitos', () => {
        expect(telefoneWa('1181234567')).toBe('5511981234567')
        expect(telefoneWa('1161234567')).toBe('5511961234567')
    })

    it('devolve null pra telefone fixo — fixo não existe no WhatsApp', () => {
        // Casos REAIS da base: Amanda (4 vendas) e Cira (1 venda).
        expect(telefoneWa('1148041265')).toBeNull()
        expect(telefoneWa('1143359605')).toBeNull()
    })

    it('devolve null pros placeholders que existem na base', () => {
        expect(telefoneWa('0000000000')).toBeNull() // "Mont Massas"
        expect(telefoneWa('999999924')).toBeNull() // 9 dígitos
        expect(telefoneWa('1101010101')).toBeNull() // assinante começa em 0
    })

    it('NÃO confunde DDD 55 (Rio Grande do Sul) com o DDI 55', () => {
        // 11 dígitos: não pode ser decapitado, senão vira outro número.
        expect(telefoneWa('55987654321')).toBe('5555987654321')
    })

    it('rejeita DDD inexistente e entrada vazia', () => {
        expect(telefoneWa('1091234567')).toBeNull() // DDD 10 não existe
        expect(telefoneWa('0011234567')).toBeNull()
        expect(telefoneWa('')).toBeNull()
        expect(telefoneWa(null)).toBeNull()
        expect(telefoneWa(undefined)).toBeNull()
    })

    it('rejeita celular de 11 dígitos que não começa em 9 (dado corrompido)', () => {
        expect(telefoneWa('11810049290')).toBeNull()
    })

    it('é idempotente — canonizar de novo não muda nada', () => {
        const uma = telefoneWa('(11) 96979-1012')
        expect(telefoneWa(uma)).toBe(uma)
    })
})

describe('telefoneWaDeJid', () => {
    it('extrai o telefone do JID da Evolution', () => {
        expect(telefoneWaDeJid('5511910049290@s.whatsapp.net')).toBe('5511910049290')
    })

    it('descarta o sufixo de device', () => {
        expect(telefoneWaDeJid('5511910049290:12@s.whatsapp.net')).toBe('5511910049290')
    })

    it('devolve null pra entrada inútil', () => {
        expect(telefoneWaDeJid(null)).toBeNull()
        expect(telefoneWaDeJid('@s.whatsapp.net')).toBeNull()
    })
})

describe('isJidIgnorado — o que não é conversa com cliente', () => {
    it('ignora grupo, status e canal', () => {
        expect(isJidIgnorado('120363000000000000@g.us')).toBe(true)
        expect(isJidIgnorado('status@broadcast')).toBe(true)
        expect(isJidIgnorado('123@newsletter')).toBe(true)
        expect(isJidIgnorado(null)).toBe(true)
    })

    it('aceita conversa 1:1', () => {
        expect(isJidIgnorado('5511910049290@s.whatsapp.net')).toBe(false)
    })
})

describe('extrairReferral — a atribuição do anúncio', () => {
    it('acha o ctwaClid dentro de contextInfo.externalAdReply (formato Baileys)', () => {
        const payload = {
            key: { remoteJid: '5511910049290@s.whatsapp.net', fromMe: false, id: 'ABC' },
            message: {
                extendedTextMessage: {
                    text: 'Vi o anúncio de vocês',
                    contextInfo: {
                        conversionSource: 'FB_Ads',
                        entryPointConversionSource: 'ctwa_ad',
                        entryPointConversionApp: 'facebook',
                        externalAdReply: {
                            ctwaClid: 'AfXyZ123',
                            sourceId: '120210000000000000',
                            sourceUrl: 'https://fb.me/abc',
                            title: 'Pão de queijo artesanal',
                        },
                    },
                },
            },
        }
        const ref = extrairReferral(payload)
        expect(lerCtwaClid(ref)).toBe('AfXyZ123')
        expect(lerSourceId(ref)).toBe('120210000000000000')
    })

    it('acha no formato snake_case da Cloud API (messages[].referral)', () => {
        const ref = extrairReferral({
            data: { referral: { ctwa_clid: 'CloudClid1', source_id: '999', source_type: 'ad' } },
        })
        expect(lerCtwaClid(ref)).toBe('CloudClid1')
        expect(lerSourceId(ref)).toBe('999')
    })

    it('acha no campo adReferral do patch da issue #2645', () => {
        const ref = extrairReferral({ data: { contextInfo: { adReferral: { ctwaClid: 'PatchClid' } } } })
        expect(lerCtwaClid(ref)).toBe('PatchClid')
    })

    it('reconhece anúncio por showAdAttribution mesmo sem clid', () => {
        // Acontece: a Meta marca a origem mas o clid não vem. Vale registrar
        // que veio de anúncio; o clid a gente sabe que faltou.
        const ref = extrairReferral({ message: { imageMessage: { contextInfo: { showAdAttribution: true } } } })
        expect(ref).not.toBeNull()
        expect(lerCtwaClid(ref)).toBeNull()
    })

    it('NÃO confunde citação de link comum com anúncio', () => {
        // externalAdReply também aparece em preview de link. Sem sinal de CTWA,
        // não é anúncio — e marcar como anúncio criaria lead falso.
        const ref = extrairReferral({
            message: { extendedTextMessage: { contextInfo: { headline: 'Notícia', body: 'resumo', mediaType: 1 } } },
        })
        expect(ref).toBeNull()
    })

    it('devolve null em conversa normal', () => {
        expect(extrairReferral({ message: { conversation: 'bom dia, tem pão hoje?' } })).toBeNull()
    })

    it('não trava com payload auto-referente', () => {
        const a: Record<string, unknown> = { message: { conversation: 'oi' } }
        a.self = a
        expect(() => extrairReferral(a)).not.toThrow()
    })
})

describe('extrairMensagensCruas — upsert (1) vs histórico (N)', () => {
    it('lê a mensagem única do MESSAGES_UPSERT', () => {
        expect(extrairMensagensCruas({ data: { key: { id: 'A' } } })).toHaveLength(1)
    })

    it('lê o LOTE do MESSAGES_SET quando data é array', () => {
        expect(extrairMensagensCruas({ data: [{ key: { id: 'A' } }, { key: { id: 'B' } }] })).toHaveLength(2)
    })

    it('lê o LOTE do MESSAGES_SET quando vem em data.messages', () => {
        const r = extrairMensagensCruas({ data: { messages: [{ key: { id: 'A' } }, { key: { id: 'B' } }] } })
        expect(r).toHaveLength(2)
    })

    it('devolve lista vazia pra corpo inválido, sem estourar', () => {
        expect(extrairMensagensCruas(null)).toEqual([])
        expect(extrairMensagensCruas({})).toEqual([])
        expect(extrairMensagensCruas({ data: 'texto' })).toEqual([])
    })
})

describe('normalizarMensagem', () => {
    const base = {
        key: { remoteJid: '5511910049290@s.whatsapp.net', fromMe: false, id: 'MSG1' },
        pushName: 'Fulano',
        messageTimestamp: 1786155728,
        message: { conversation: 'bom dia' },
    }

    it('normaliza mensagem de entrada', () => {
        const m = normalizarMensagem(base)!
        expect(m.messageId).toBe('MSG1')
        expect(m.telefoneWa).toBe('5511910049290')
        expect(m.direcao).toBe('entrada')
        expect(m.conteudo).toBe('bom dia')
        expect(m.tipoMidia).toBe('texto')
        expect(m.pushName).toBe('Fulano')
        expect(m.enviadaEm).toBe(new Date(1786155728_000).toISOString())
    })

    it('fromMe vira saída — é o Gilmar falando', () => {
        expect(normalizarMensagem({ ...base, key: { ...base.key, fromMe: true } })!.direcao).toBe('saida')
    })

    it('usa a legenda da imagem como conteúdo', () => {
        const m = normalizarMensagem({ ...base, message: { imageMessage: { caption: 'olha esse' } } })!
        expect(m.tipoMidia).toBe('imagem')
        expect(m.conteudo).toBe('olha esse')
    })

    it('áudio entra sem conteúdo, mas entra', () => {
        const m = normalizarMensagem({ ...base, message: { audioMessage: { seconds: 5 } } })!
        expect(m.tipoMidia).toBe('audio')
        expect(m.conteudo).toBeNull()
    })

    it('aceita timestamp como string e como Long', () => {
        expect(normalizarMensagem({ ...base, messageTimestamp: '1786155728' })!.enviadaEm)
            .toBe(new Date(1786155728_000).toISOString())
        expect(normalizarMensagem({ ...base, messageTimestamp: { low: 1786155728, high: 0 } })!.enviadaEm)
            .toBe(new Date(1786155728_000).toISOString())
    })

    it('descarta grupo, telefone inválido e mensagem sem id', () => {
        expect(normalizarMensagem({ ...base, key: { ...base.key, remoteJid: '123@g.us' } })).toBeNull()
        expect(normalizarMensagem({ ...base, key: { ...base.key, remoteJid: '551148041265@s.whatsapp.net' } })).toBeNull()
        expect(normalizarMensagem({ ...base, key: { remoteJid: base.key.remoteJid, fromMe: false } })).toBeNull()
        expect(normalizarMensagem({})).toBeNull()
    })

    it('carrega o referral quando a mensagem vem de anúncio', () => {
        const m = normalizarMensagem({
            ...base,
            message: {
                extendedTextMessage: { text: 'oi', contextInfo: { externalAdReply: { ctwaClid: 'X1' } } },
            },
        })!
        expect(lerCtwaClid(m.referral)).toBe('X1')
    })
})
