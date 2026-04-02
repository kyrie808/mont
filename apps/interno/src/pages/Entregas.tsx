import { useState, useEffect, useCallback } from 'react'
import { Clock, MapPin, Truck } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingScreen } from '@/components/ui'

// Entregas Components
import {
    OriginSelector,
    DeliveryList,
    OptimizationButton,
    RouteTimeline
} from '@/components/features/entregas'

// Hooks
import { useCep } from '@/hooks/useCep'
import { useToast } from '../components/ui/Toast'

// Supabase
import { supabase } from '@/lib/supabase'

// Types
interface DeliveryItem {
    id: string
    cliente_nome: string
    endereco: string
    bairro: string | null
    total: number
    latitude?: number | null
    longitude?: number | null
    data: string
}

interface RouteStop {
    id: string
    name: string
    address: string
    neighborhood: string | null
}

export function Entregas() {
    const toast = useToast()
    const { fetchCep } = useCep()

    // State
    const [pendentes, setPendentes] = useState<DeliveryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [locais, setLocais] = useState<Array<{ endereco: string; tipo: string }>>([])
    const [origin, setOrigin] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [optimizing, setOptimizing] = useState(false)
    const [route, setRoute] = useState<RouteStop[]>([])

    const fetchPendingSales = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('vendas')
                .select(`
                    id,
                    total,
                    data,
                    contato:contato_id (
                        id,
                        nome,
                        endereco,
                        bairro,
                        latitude,
                        longitude
                    )
                `)
                .eq('status', 'pendente')
                .order('data', { ascending: true })

            if (error) throw error

            type RawVenda = {
                id: string
                total: number
                data: string
                contato: {
                    id: string
                    nome: string
                    endereco: string | null
                    bairro: string | null
                    logradouro: string | null
                    numero: string | null
                    cidade: string | null
                    latitude: number | null
                    longitude: number | null
                } | null
            }

            const formatted: DeliveryItem[] = ((data as unknown as RawVenda[]) || []).map((v) => ({
                id: v.id,
                cliente_nome: v.contato?.nome || 'Cliente',
                endereco: v.contato?.endereco || `${v.contato?.logradouro || ''}, ${v.contato?.numero || ''} - ${v.contato?.cidade || ''}`,
                bairro: v.contato?.bairro || null,
                total: v.total || 0,
                latitude: v.contato?.latitude || null,
                longitude: v.contato?.longitude || null,
                data: v.data
            }))

            setPendentes(formatted)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as entregas')
        } finally {
            setLoading(false)
        }
    }, [])

    // Fetch pending deliveries
    useEffect(() => {
        fetchPendingSales()
        // Fetch saved locations
        supabase.from('configuracoes')
            .select('*')
            .eq('chave', 'locais_partida')
            .maybeSingle()
            .then(({ data }) => {
                if (data) {
                    const val = data?.valor as Array<{ endereco?: string; nome?: string }> | undefined
                    if (val && Array.isArray(val) && val.length > 0) {
                        // Transform to legacy format
                        const formatted = val.map((loc) => ({
                            endereco: loc.endereco || loc.nome || '',
                            tipo: loc.nome?.toLowerCase() || 'local'
                        }))
                        setLocais(formatted)
                        // Set first location as default origin
                        setOrigin(formatted[0].endereco)
                    }
                }
            })
    }, [fetchPendingSales])

    const handleToggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
            return newSet
        })
    }

    const handleAddressInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setOrigin(val)

        // CEP auto-complete
        if (/^\d{8}$/.test(val)) {
            const addr = await fetchCep(val)
            if (addr) {
                setOrigin(`${addr.street}, ${addr.neighborhood} - ${addr.city}, ${addr.state}`)
            }
        }
    }

    const handleOptimizeRoute = async () => {
        if (selectedIds.size === 0) {
            toast.warning('Selecione pelo menos uma entrega')
            return
        }

        setOptimizing(true)
        try {
            const selected = pendentes.filter(p => selectedIds.has(p.id))

            // Simple optimization: group by neighborhood, then by address
            const sorted = [...selected].sort((a, b) => {
                if (a.bairro && b.bairro) {
                    if (a.bairro !== b.bairro) return a.bairro.localeCompare(b.bairro)
                }
                return a.endereco.localeCompare(b.endereco)
            })

            const stops: RouteStop[] = sorted.map(s => ({
                id: s.id,
                name: s.cliente_nome,
                address: s.endereco,
                neighborhood: s.bairro
            }))

            setRoute(stops)

            toast.success(`Rota otimizada! ${stops.length} paradas organizadas por bairro`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível otimizar a rota')
        } finally {
            setOptimizing(false)
        }
    }

    const handleNavigateGoogleMaps = () => {
        if (route.length === 0) return

        const waypoints = route.map(r => encodeURIComponent(r.address)).join('/')
        const url = `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${waypoints}`
        window.open(url, '_blank')
    }

    return (
        <>
                <Header
                    title="Rota Inteligente"
                    centerTitle
                    showBack
                />

                <PageContainer className="relative z-10 space-y-6 pt-4 pb-24 px-4">

                    {/* Loading State */}
                    {loading ? (
                        <LoadingScreen message="Carregando entregas..." />
                    ) : pendentes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                <Truck className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Nenhuma entrega pendente</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                                Todas as vendas estão entregues ou não há pedidos pendentes.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* 2-Column Layout */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                {/* Left Column: Selection & Controls */}
                                <div className="space-y-6">
                                    {/* Origin Selector */}
                                    <OriginSelector
                                        locais={locais}
                                        origin={origin}
                                        onOriginChange={setOrigin}
                                        onAddressInput={handleAddressInput}
                                    />

                                    {/* Delivery List */}
                                    <DeliveryList
                                        deliveries={pendentes}
                                        selectedIds={selectedIds}
                                        onToggleSelection={handleToggleSelection}
                                        groupByNeighborhood={true}
                                    />

                                    {/* Optimization Button */}
                                    <OptimizationButton
                                        isLoading={optimizing}
                                        selectedCount={selectedIds.size}
                                        onClick={handleOptimizeRoute}
                                        disabled={optimizing || selectedIds.size === 0}
                                    />
                                </div>

                                {/* Right Column: Route Preview */}
                                <div className="lg:sticky lg:top-24 lg:h-fit space-y-6">
                                    {route.length > 0 ? (
                                        <>
                                            {/* Route Stats Card */}
                                            <Card className="p-5 bg-card shadow-card border border-border rounded-xl">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Rota Gerada</h3>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                            {route.length} paradas · Organizado por bairro
                                                        </p>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-full bg-semantic-green/10 flex items-center justify-center">
                                                        <MapPin className="w-5 h-5 text-semantic-green" />
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="outline"
                                                    onClick={handleNavigateGoogleMaps}
                                                    className="w-full rounded-lg h-10 font-medium"
                                                >
                                                    Abrir no Google Maps
                                                </Button>
                                            </Card>

                                            {/* Route Timeline */}
                                            <Card className="p-5 bg-card shadow-card border border-border rounded-xl max-h-[600px] overflow-y-auto">
                                                <RouteTimeline stops={route} />
                                            </Card>
                                        </>
                                    ) : (
                                        <Card className="p-8 bg-card shadow-card border border-border rounded-xl">
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                                    <Clock className="w-8 h-8 text-gray-400" />
                                                </div>
                                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aguardando rota</p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
                                                    Selecione as entregas e clique em "Gerar Rota Otimizada" para visualizar
                                                </p>
                                            </div>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </PageContainer>
        </>
    )
}
