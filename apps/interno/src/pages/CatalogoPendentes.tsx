import { useState } from 'react'
import {
  AlertCircle,
  Search,
  Link as LinkIcon,
  ExternalLink,
  Loader2,
  CheckCircle2,
  UserPlus
} from 'lucide-react'
import { useToast } from '../components/ui/Toast'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import {
  Card,
  Badge,
  Button,
  Input,
  Modal,
  PageSkeleton
} from '../components/ui'
import { useCatalogoPendentes } from '../hooks/useCatalogoPendentes'
import { useContatos } from '../hooks/useContatos'
import type { CatalogoPendente } from '../hooks/useCatalogoPendentes'

export function CatalogoPendentes() {
  const toast = useToast()
  const navigate = useNavigate()
  const { data: pendentes = [], isLoading: loading, error, vincularManualmente } = useCatalogoPendentes()
  const { contatos, loading: loadingContatos } = useContatos()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPedido, setSelectedPedido] = useState<CatalogoPendente | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  const filteredContatos = contatos?.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telefone.includes(searchTerm)
  )

  const handleLink = async (contatoId: string) => {
    if (!selectedPedido) return

    setIsLinking(true)
    try {
      await vincularManualmente.mutateAsync({
        pendenteId: selectedPedido.id,
        catPedidoId: selectedPedido.cat_pedido_id,
        contatoId
      })
      toast.success('Pedido vinculado com sucesso!')
      setSelectedPedido(null)
    } catch {
      toast.error('Erro ao vincular pedido')
    } finally {
      setIsLinking(false)
    }
  }

  if (loading) {
    return <PageSkeleton rows={5} showHeader showCards={false} />
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">{(error as Error).message || 'Erro ao carregar pendências'}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Recarregar</Button>
      </div>
    )
  }

  return (
    <>
      <Header title="Pendentes Catálogo" showBack centerTitle />

      <div className="p-4 pb-24 space-y-4">
        {pendentes.length === 0 ? (
          <Card className="p-8 text-center flex flex-col items-center justify-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-success" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tudo em dia!</h3>
              <p className="text-sm text-gray-500">Não há pedidos pendentes de vinculação.</p>
            </div>
          </Card>
        ) : (
          pendentes.map((pedido: CatalogoPendente) => (
            <Card key={pedido.id} className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                    Pedido #{pedido.cat_pedidos.numero_pedido}
                  </h3>
                  <p className="text-sm text-gray-500">{pedido.cat_pedidos.nome_cliente}</p>
                  <p className="font-mono text-xs text-gray-400">{pedido.cat_pedidos.telefone_cliente}</p>
                </div>
                <Badge variant="warning">Aguardando Vínculo</Badge>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {pedido.motivo_falha}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setSelectedPedido(pedido)}
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Vincular Contato
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://wa.me/55${pedido.cat_pedidos.telefone_cliente.replace(/\D/g, '')}`)}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={!!selectedPedido}
        onClose={() => setSelectedPedido(null)}
        title="Vincular Pedido ao Contato"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Selecione o contato correto para vincular ao pedido de <strong>{selectedPedido?.cat_pedidos?.nome_cliente}</strong>.
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
            {loadingContatos ? (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-600" />
              </div>
            ) : filteredContatos?.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm text-gray-500">Nenhum contato encontrado.</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/contatos')}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Criar Novo Contato
                </Button>
              </div>
            ) : (
              filteredContatos?.map((contato) => (
                <button
                  key={contato.id}
                  onClick={() => handleLink(contato.id)}
                  disabled={isLinking}
                  className="w-full p-3 text-left rounded-lg border border-border hover:bg-muted transition-colors flex justify-between items-center group"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{contato.nome}</p>
                    <p className="text-xs text-gray-500">{contato.telefone}</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Badge variant="success" className="cursor-pointer">Selecionar</Badge>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="pt-4 border-t dark:border-gray-800 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setSelectedPedido(null)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
