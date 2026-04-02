import { Search, X, Check } from 'lucide-react'
import { formatPhone } from '@mont/shared'
import type { DomainContato } from '@/types/domain'

interface FormIndicacaoProps {
    selectedIndicador: DomainContato | null
    handleClearIndicador: () => void
    indicadorSearch: string
    setIndicadorSearch: (val: string) => void
    showIndicadorDropdown: boolean
    indicadorResults: DomainContato[]
    handleSelectIndicador: (c: DomainContato) => void
}

export function FormIndicacao({
    selectedIndicador,
    handleClearIndicador,
    indicadorSearch,
    setIndicadorSearch,
    showIndicadorDropdown,
    indicadorResults,
    handleSelectIndicador
}: FormIndicacaoProps) {
    return (
        <div className="relative space-y-2 animate-in fade-in slide-in-from-top-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Indicado Por</label>
            {selectedIndicador ? (
                <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div>
                        <p className="font-medium text-foreground">{selectedIndicador.nome}</p>
                        <p className="text-xs text-muted-foreground">
                            {formatPhone(selectedIndicador.telefone)}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClearIndicador}
                        className="p-1 hover:bg-primary/20 rounded text-primary hover:text-primary-foreground transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : (
                <>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={indicadorSearch}
                            onChange={(e) => setIndicadorSearch(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-black/20 bg-background/50 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    {showIndicadorDropdown && indicadorResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-48 overflow-auto text-popover-foreground">
                            {indicadorResults.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => handleSelectIndicador(c)}
                                    className="w-full px-4 py-3 text-left hover:bg-accent hover:text-accent-foreground flex items-center justify-between transition-colors"
                                >
                                    <div>
                                        <p className="font-medium">{c.nome}</p>
                                        <p className="text-xs opacity-70">{formatPhone(c.telefone)}</p>
                                    </div>
                                    <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100" />
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
