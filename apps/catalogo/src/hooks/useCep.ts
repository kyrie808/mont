import { useState } from 'react'

interface CepData {
    cep: string
    state: string
    city: string
    neighborhood: string
    street: string
    service: string
}

interface UseCepResult {
    loading: boolean
    error: string | null
    address: CepData | null
    fetchCep: (cep: string) => Promise<CepData | null>
    clearAddress: () => void
}

export function useCep(): UseCepResult {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [address, setAddress] = useState<CepData | null>(null)

    const fetchCep = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, '')

        if (cleanCep.length !== 8) {
            setError('CEP inválido')
            return null
        }

        setLoading(true)
        setError(null)
        setAddress(null)

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`)

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('CEP não encontrado')
                }
                throw new Error('Erro ao buscar CEP')
            }

            const data: CepData = await response.json()
            setAddress(data)
            return data
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao buscar CEP'
            setError(message)
            return null
        } finally {
            setLoading(false)
        }
    }

    const clearAddress = () => {
        setAddress(null)
        setError(null)
    }

    return {
        loading,
        error,
        address,
        fetchCep,
        clearAddress,
    }
}
