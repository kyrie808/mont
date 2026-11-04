import { describe, expect, it } from 'vitest'
import { faltaParaEnviar, frasesDoQueFalta } from './faltando'

const sacola = [{ tipo: 'produto' as const, produtoId: '3074f382-ee98-4cf5-9d6d-e403c7d61166', quantidade: 1 }]

const completo = {
    chave: 'f92c393e-625c-4e7f-99bf-c4d636035388',
    nome: 'Maria Souza',
    telefone: '(11) 98765-4321',
    entrega: 'entrega' as const,
    cep: '09784-410',
    logradouro: 'Rua João XXIII',
    numero: '39',
    complemento: '',
    bairro: 'Montanhão',
    cidade: 'São Bernardo do Campo',
    uf: 'SP',
    pagamento: 'pix' as const,
    indicadoPor: '',
    ofertas: false,
    site: '',
    itens: sacola,
}

/**
 * A1 (02/11): a tela 05 só liberava o envio quando a busca do CEP dava certo. CEP novo ou ViaCEP
 * fora do ar travava o pedido. Agora vale a mesma regra do servidor (esquemaEnvioPedido).
 */
describe('faltaParaEnviar', () => {
    it('endereço digitado à mão (CEP não achado) libera o envio', () => {
        expect(faltaParaEnviar({ ...completo, bairro: '' })).toEqual([])
    })

    it('aponta os campos na ordem da tela', () => {
        expect(faltaParaEnviar({ ...completo, numero: '', telefone: '(11) 9876', cidade: '', uf: '' })).toEqual([
            'seu WhatsApp',
            'número',
            'cidade',
            'estado (UF)',
        ])
    })

    it('CEP incompleto e rua vazia', () => {
        expect(faltaParaEnviar({ ...completo, cep: '0978', logradouro: '' })).toEqual(['CEP', 'rua'])
    })

    it('retirada na Mont não pede endereço', () => {
        expect(
            faltaParaEnviar({ ...completo, entrega: 'retirada', cep: '', logradouro: '', numero: '', cidade: '', uf: '' }),
        ).toEqual([])
        expect(faltaParaEnviar({ ...completo, entrega: 'retirada', cep: '', nome: '' })).toEqual(['seu nome'])
    })

    it('não fala da chave, da armadilha de robô nem da sacola', () => {
        expect(faltaParaEnviar({ ...completo, chave: 'x', site: 'robo', itens: [] })).toEqual([])
    })
})

describe('frasesDoQueFalta', () => {
    it('junta com vírgula e "e"', () => {
        expect(frasesDoQueFalta([])).toBe('')
        expect(frasesDoQueFalta(['número'])).toBe('Para enviar, falta: número.')
        expect(frasesDoQueFalta(['seu nome', 'CEP', 'número'])).toBe('Para enviar, falta: seu nome, CEP e número.')
    })
})
