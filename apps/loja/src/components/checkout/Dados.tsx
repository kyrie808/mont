'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { z } from 'zod'
import { enviarPedido } from '@/app/checkout/acoes'
import { linkWhatsApp } from '@/lib/formato'
import { guardarEnviado, novaChavePedido } from '@/lib/pedido/enviado'
import { TEXTO_OFERTAS } from '@/lib/pedido/esquema'
import { catalogoDa, resumirSacola } from '@/lib/sacola/calculo'
import { useSacola } from '@/lib/sacola/store'
import { useSacolaPronta } from '@/lib/sacola/useSacolaPronta'
import type { Vitrine } from '@/lib/vitrine/tipos'

interface DadosProps {
    vitrine: Vitrine
    whatsapp: string
}

const esquemaViaCep = z.object({
    logradouro: z.string().optional(),
    bairro: z.string().optional(),
    localidade: z.string().optional(),
    uf: z.string().optional(),
    erro: z.union([z.boolean(), z.string()]).optional(),
})

/** "11987654321" → "(11) 98765-4321" enquanto digita. */
function mascaraTelefone(v: string): string {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d.length ? `(${d}` : ''
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function mascaraCep(v: string): string {
    const d = v.replace(/\D/g, '').slice(0, 8)
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

const campo =
    'h-12 w-full rounded-xl border border-tracejado bg-white px-3.5 text-[15px] font-medium text-marrom ' +
    'placeholder:text-texto-suave/60 focus:border-[1.5px] focus:border-marrom focus:outline-none'
const rotulo = 'text-[13px] font-bold'

/** Tela 05: dados de entrega e envio do pedido pelo WhatsApp (sem pagamento online, decisão de 02/11). */
export function Dados({ vitrine, whatsapp }: DadosProps) {
    const router = useRouter()
    const pronta = useSacolaPronta()
    const itens = useSacola((s) => s.itens)
    const esvaziar = useSacola((s) => s.esvaziar)
    const resumo = useMemo(() => resumirSacola(pronta ? itens : [], catalogoDa(vitrine)), [pronta, itens, vitrine])

    const [telefone, setTelefone] = useState('')
    const [nome, setNome] = useState('')
    const [cep, setCep] = useState('')
    const [numero, setNumero] = useState('')
    const [logradouro, setLogradouro] = useState('')
    const [bairro, setBairro] = useState('')
    const [cidade, setCidade] = useState('')
    const [uf, setUf] = useState('')
    const [complemento, setComplemento] = useState('')
    const [ofertas, setOfertas] = useState(false)
    const [site, setSite] = useState('')
    const [cepStatus, setCepStatus] = useState<'vazio' | 'buscando' | 'ok' | 'erro'>('vazio')
    const [erro, setErro] = useState<string | null>(null)
    const [enviando, iniciarEnvio] = useTransition()
    // Uma chave por tela: tocar de novo (ou rede instável) devolve o mesmo pedido, não cria outro.
    const [chave] = useState(novaChavePedido)

    async function buscarCep(valor: string) {
        const digitos = valor.replace(/\D/g, '')
        if (digitos.length !== 8) {
            setCepStatus('vazio')
            return
        }
        setCepStatus('buscando')
        try {
            const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
            const lido = esquemaViaCep.safeParse(await resposta.json())
            if (!lido.success || lido.data.erro || !lido.data.localidade || !lido.data.uf) {
                setCepStatus('erro')
                return
            }
            setLogradouro(lido.data.logradouro ?? '')
            setBairro(lido.data.bairro ?? '')
            setCidade(lido.data.localidade)
            setUf(lido.data.uf)
            setCepStatus('ok')
        } catch {
            setCepStatus('erro')
        }
    }

    const sacolaVazia = pronta && resumo.linhas.length === 0
    const podeEnviar = pronta && !sacolaVazia && !resumo.temPendencia && cepStatus === 'ok' && !enviando

    function enviar() {
        if (!podeEnviar) return
        setErro(null)
        iniciarEnvio(async () => {
            const resultado = await enviarPedido({
                chave,
                nome,
                telefone,
                cep,
                logradouro,
                numero,
                complemento,
                bairro,
                cidade,
                uf,
                ofertas,
                site,
                itens,
            })
            if (!resultado.ok) {
                setErro(resultado.erro)
                return
            }
            guardarEnviado({ numero: resultado.numero, link: resultado.link, whatsappAberto: false })
            esvaziar()
            router.replace('/checkout/enviado')
        })
    }

    return (
        <div className="relative min-h-dvh pb-[100px]">
            <header className="flex h-14 items-center gap-1 border-b border-linha px-2">
                <Link
                    href="/sacola"
                    aria-label="Voltar para a sacola"
                    className="flex h-11 w-11 items-center justify-center text-[22px] no-underline"
                >
                    ←
                </Link>
                <span className="text-base font-bold">Seus dados</span>
                <span className="ml-auto pr-3 text-xs text-texto-suave">1 Sacola · 2 Dados</span>
            </header>

            {sacolaVazia ? (
                <div className="flex flex-col items-center gap-3 px-4 pt-16 text-center">
                    <span className="text-[15px] text-texto-suave">Sua sacola está vazia.</span>
                    <Link href="/" className="text-sm font-bold">
                        Voltar para a loja
                    </Link>
                </div>
            ) : (
                <form
                    className="flex flex-col gap-3 p-4"
                    onSubmit={(e) => {
                        e.preventDefault()
                        enviar()
                    }}
                >
                    <div className="flex flex-col gap-1.5">
                        <label className={rotulo} htmlFor="cel">
                            Seu WhatsApp
                        </label>
                        <input
                            id="cel"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            placeholder="(11) 98765-4321"
                            value={telefone}
                            onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                            className={campo}
                            required
                        />
                        <span className="text-xs text-texto-suave">Sem senha. É por ele que avisamos o andamento do pedido.</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className={rotulo} htmlFor="nome">
                            Seu nome
                        </label>
                        <input
                            id="nome"
                            autoComplete="name"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            className={campo}
                            maxLength={80}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 flex flex-col gap-1.5">
                            <label className={rotulo} htmlFor="cep">
                                CEP
                            </label>
                            <input
                                id="cep"
                                inputMode="numeric"
                                autoComplete="postal-code"
                                placeholder="09600-000"
                                value={cep}
                                onChange={(e) => {
                                    const valor = mascaraCep(e.target.value)
                                    setCep(valor)
                                    void buscarCep(valor)
                                }}
                                className={campo}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className={rotulo} htmlFor="num">
                                Número
                            </label>
                            <input
                                id="num"
                                inputMode="numeric"
                                value={numero}
                                onChange={(e) => setNumero(e.target.value)}
                                className={campo}
                                maxLength={20}
                                required
                            />
                        </div>
                    </div>
                    {cepStatus === 'buscando' && <span className="text-xs text-texto-suave">Buscando o endereço…</span>}
                    {cepStatus === 'erro' && (
                        <span className="text-xs text-texto-suave">
                            Não achamos esse CEP. Confira os números ou{' '}
                            <a href={linkWhatsApp(whatsapp)} target="_blank" rel="noopener noreferrer" className="font-bold">
                                fale com a gente no WhatsApp
                            </a>
                            .
                        </span>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label className={rotulo} htmlFor="rua">
                            Rua (preenche pelo CEP)
                        </label>
                        <input
                            id="rua"
                            autoComplete="address-line1"
                            value={logradouro}
                            onChange={(e) => setLogradouro(e.target.value)}
                            className={campo}
                            maxLength={120}
                            required
                        />
                        {cepStatus === 'ok' && (
                            <span className="text-xs text-texto-suave">
                                {[bairro, `${cidade}/${uf}`].filter(Boolean).join(' · ')}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className={rotulo} htmlFor="comp">
                            Complemento ou ponto de referência
                        </label>
                        <input
                            id="comp"
                            placeholder="Ex.: portão verde, casa 2"
                            value={complemento}
                            onChange={(e) => setComplemento(e.target.value)}
                            className={campo}
                            maxLength={120}
                        />
                    </div>

                    {/* Armadilha para robô: escondida de gente de verdade. */}
                    <input
                        type="text"
                        name="site"
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        value={site}
                        onChange={(e) => setSite(e.target.value)}
                        className="absolute -left-[9999px] h-px w-px opacity-0"
                    />

                    <label className="mt-1 flex items-start gap-2.5 text-[13px] text-marrom-medio">
                        <input
                            type="checkbox"
                            checked={ofertas}
                            onChange={(e) => setOfertas(e.target.checked)}
                            className="m-0 h-5 w-5 shrink-0 accent-marrom"
                        />
                        {TEXTO_OFERTAS}
                    </label>

                    {erro && (
                        <p role="alert" className="rounded-xl bg-areia px-3.5 py-3 text-sm font-medium">
                            {erro}
                        </p>
                    )}

                    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] border-t border-linha bg-creme px-4 pt-3 pb-5">
                        <button
                            type="submit"
                            disabled={!podeEnviar}
                            className="h-14 w-full cursor-pointer rounded-[28px] border-0 bg-laranja text-base font-bold text-marrom disabled:cursor-default disabled:bg-linha disabled:text-texto-suave"
                        >
                            {enviando ? 'Enviando…' : 'Enviar pedido pelo WhatsApp'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    )
}
