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
    isAnuncioPago,
    podeGravarAtribuicao,
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

    it('recompõe o 9º dígito quando o número já vem com DDI e 12 dígitos', () => {
        // Caso REAL: o WhatsApp guarda o número do Denivaldo (DDD 35) no formato
        // antigo — `553588438564@s.whatsapp.net`, 12 dígitos, sem o 9. Um regex
        // ingênuo (`^55\d{2}9\d{8}$`) descartaria o cliente inteiro.
        expect(telefoneWa('553588438564')).toBe('5535988438564')
        expect(telefoneWaDeJid('553588438564@s.whatsapp.net')).toBe('5535988438564')
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

/**
 * Regressões vindas do PRIMEIRO referral real capturado em produção (11/08/2026),
 * de uma cliente que já existia na base. Os dois defeitos abaixo só apareceram
 * porque o dado real chegou — nenhum teste sintético teria pego.
 */
describe('isAnuncioPago — anúncio pago vs post orgânico', () => {
    // Payload REAL recebido: post do Facebook com botão de CTA, sem clid.
    const postOrganico = {
        sourceId: '122161464422987064',
        sourceUrl: 'https://fb.me/20S9JgX94n',
        conversionSource: 'FB_Post',
        entryPointConversionSource: 'post_cta',
    }

    it('post orgânico NÃO é anúncio pago', () => {
        // A Ellen já era `origem: 'direto'`, cliente com 1 venda. Tratar isso como
        // anúncio reescreveria a origem dela e enfileiraria um Lead falso na CAPI.
        expect(isAnuncioPago(postOrganico)).toBe(false)
    })

    it('mas o referral orgânico continua sendo capturado — é informação boa', () => {
        expect(extrairReferral({ message: { extendedTextMessage: { contextInfo: postOrganico } } }))
            .not.toBeNull()
    })

    it('anúncio pago é reconhecido pelo clid, por FB_Ads ou por ctwa_ad', () => {
        expect(isAnuncioPago({ ctwaClid: 'AfXyZ' })).toBe(true)
        expect(isAnuncioPago({ conversionSource: 'FB_Ads' })).toBe(true)
        expect(isAnuncioPago({ entryPointConversionSource: 'ctwa_ad' })).toBe(true)
        expect(isAnuncioPago(null)).toBe(false)
    })
})

describe('extrairReferral — não guarda lixo', () => {
    it('descarta thumbnail e objetos aninhados', () => {
        // O primeiro referral real gravou 43 KB porque a versão anterior copiava o
        // externalAdReply inteiro, incluindo a miniatura do anúncio em base64.
        const ref = extrairReferral({
            message: {
                extendedTextMessage: {
                    contextInfo: {
                        externalAdReply: {
                            ctwaClid: 'AfXyZ',
                            sourceId: '123',
                            thumbnail: 'x'.repeat(40_000),
                            thumbnailUrl: 'https://exemplo/imagem.jpg',
                            quotedMessage: { conversation: 'ruido' },
                        },
                    },
                },
            },
        })!
        expect(lerCtwaClid(ref)).toBe('AfXyZ')
        expect(lerSourceId(ref)).toBe('123')
        expect(JSON.stringify(ref)).not.toContain('xxxx')
        expect(JSON.stringify(ref).length).toBeLessThan(500)
    })
})

describe('normalizarMensagem — telefone forçado (resgate de histórico)', () => {
    // O histórico chega com LID, do qual NÃO dá pra derivar telefone. Foi por isso
    // que as 6.098 mensagens do pareamento foram descartadas.
    const cruaComLid = {
        key: { remoteJid: '269466768244766@lid', fromMe: false, id: 'HIST_1' },
        messageTimestamp: 1786150000,
        message: { conversation: 'mensagem antiga' },
    }

    it('sem telefone forçado, mensagem em LID é descartada', () => {
        expect(normalizarMensagem(cruaComLid)).toBeNull()
    })

    it('com telefone forçado, é aceita e usa o telefone resolvido', () => {
        const m = normalizarMensagem(cruaComLid, '5511964911627')!
        expect(m.telefoneWa).toBe('5511964911627')
        expect(m.conteudo).toBe('mensagem antiga')
    })

    it('grupo continua descartado MESMO com telefone forçado', () => {
        const grupo = { ...cruaComLid, key: { ...cruaComLid.key, remoteJid: '123@g.us' } }
        expect(normalizarMensagem(grupo, '5511964911627')).toBeNull()
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

describe('podeGravarAtribuicao — a origem declarada por gente ganha', () => {
    it('indicação NUNCA vira anúncio, mesmo que a cliente clique num depois', () => {
        // O caso da Najla: trazida pelo Rodrigo da Daniele, comprou no mesmo dia.
        expect(podeGravarAtribuicao('indicacao', false)).toBe(false)
    })

    it('catálogo e facebook também são declarações, não palpites', () => {
        expect(podeGravarAtribuicao('catalogo', false)).toBe(false)
        expect(podeGravarAtribuicao('facebook', false)).toBe(false)
    })

    it("'direto' NÃO é neutro: é a prospecção do Gilmar, e anúncio não apaga o trabalho dele", () => {
        expect(podeGravarAtribuicao('direto', false)).toBe(false)
    })

    it('quem já é de anúncio pode ter o clid COMPLETADO (não muda história)', () => {
        // Os 62 leads que o Luccas cadastrou à mão nunca tiveram ctwa_clid.
        expect(podeGravarAtribuicao('anuncio', false)).toBe(true)
    })

    it('clid já capturado nunca é regravado — o primeiro clique é o que a Meta atribui', () => {
        expect(podeGravarAtribuicao('direto', true)).toBe(false)
        expect(podeGravarAtribuicao('anuncio', true)).toBe(false)
    })

    it('origem ausente não é tratada como neutra', () => {
        expect(podeGravarAtribuicao(null, false)).toBe(false)
        expect(podeGravarAtribuicao(undefined, false)).toBe(false)
    })
})
