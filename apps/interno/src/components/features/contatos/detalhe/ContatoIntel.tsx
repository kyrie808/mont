import { useState } from 'react'
import { MapPin, Fingerprint, ChevronDown, Phone, Mail, Copy } from 'lucide-react'
import { cn } from '@mont/shared'
import { useToast } from '../../../../components/ui/Toast'
import type { DomainContato } from '../../../../types/domain'

export function ContatoIntel({ contato }: { contato: DomainContato }) {
    const toast = useToast()
    const [isAddressExpanded, setIsAddressExpanded] = useState(false)

    return (
        <div className="flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-300">
            {/* Header (Clickable) */}
            <div
                onClick={() => setIsAddressExpanded(!isAddressExpanded)}
                className="flex items-center gap-4 p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
                <div className={cn("flex items-center justify-center h-10 w-10 rounded-full bg-violet-500/10 text-violet-500 transition-transform duration-300", isAddressExpanded && "rotate-180 bg-violet-500 text-white")}>
                    <Fingerprint className="h-6 w-6" />
                </div>
                <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Informação de Contato
                    </p>
                    {!isAddressExpanded && (
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5 animate-fade-in">
                            {[contato.endereco, contato.bairro].filter(Boolean).join(', ') || 'Sem endereço'}
                        </p>
                    )}
                </div>
                <ChevronDown className={cn("h-5 w-5 text-gray-400 transition-transform duration-300", isAddressExpanded && "rotate-180")} />
            </div>

            {/* Expanded Content */}
            <div className={cn(
                "grid transition-all duration-500 ease-in-out",
                isAddressExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
                <div className="overflow-hidden">
                    <div className="px-5 pb-5 pt-0 space-y-4">
                        {/* Map Preview (Tactical Style) */}
                        <div className="relative w-full h-48 bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-inner group">
                            {/* Tactical Overlay */}
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')] opacity-20 pointer-events-none z-10" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 pointer-events-none" />

                            {/* Map Iframe */}
                            <iframe
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                scrolling="no"
                                marginHeight={0}
                                marginWidth={0}
                                src={`https://maps.google.com/maps?q=${encodeURIComponent([contato.endereco, contato.bairro, 'São Paulo'].join(', '))}&t=m&z=15&ie=UTF8&iwloc=&output=embed&style=feature:all|element:all|saturation:-100|visibility:simplified`}
                                className="opacity-60 grayscale contrast-125 hover:opacity-80 hover:grayscale-0 transition-all duration-500"
                            />

                            {/* Center Pin */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                                <div className="relative">
                                    <div className="absolute -inset-4 bg-violet-500/30 rounded-full animate-ping" />
                                    <MapPin className="h-8 w-8 text-violet-500 drop-shadow-[0_0_10px_rgba(139,92,246,0.5)] fill-violet-950" />
                                </div>
                            </div>

                            {/* Lat/Long Badge */}
                            <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full">
                                <span className="text-[10px] font-mono text-violet-300">
                                    LAT: -23.5505 // LONG: -46.6333
                                </span>
                            </div>
                        </div>

                        {/* Contact Actions */}
                        <div className="grid gap-3">
                            {/* Address Row */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 group/addr">
                                <div className="flex items-center gap-3">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Localização</p>
                                        {[contato.endereco, contato.bairro].filter(Boolean).length > 0 ? (
                                            <p className="text-sm font-mono text-foreground tracking-wider line-clamp-1">
                                                {[contato.endereco, contato.bairro].filter(Boolean).join(', ')}
                                            </p>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-mono text-gray-400 italic">endereço não cadastrado</p>
                                                <span className="flex h-1.5 w-1.5 rounded-full bg-orange-500/50" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {[contato.endereco, contato.bairro].filter(Boolean).length > 0 && (
                                    <div className="flex items-center gap-2 opacity-0 group-hover/addr:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const fullAddress = [contato.endereco, contato.bairro, 'São Paulo'].filter(Boolean).join(', ');
                                                window.open(`https://www.google.com/maps/search/?api=1&query=${fullAddress}`, '_blank');
                                            }}
                                            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                            title="Abrir no Maps"
                                        >
                                            <MapPin className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText([contato.endereco, contato.bairro].filter(Boolean).join(', '));
                                                toast.success('Endereço copiado!');
                                            }}
                                            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                            title="Copiar Endereço"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Phone Row */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 group/phone">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-violet-500/10 rounded-full text-violet-500">
                                        <Phone className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Mobile Uplink</p>
                                        {contato.telefone ? (
                                            <p className="text-sm font-mono text-foreground tracking-wider">{contato.telefone}</p>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-mono text-gray-400 italic">sem telefone</p>
                                                <span className="flex h-1.5 w-1.5 rounded-full bg-orange-500/50" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {contato.telefone && (
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(contato.telefone);
                                            toast.success('Telefone copiado!');
                                        }}
                                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors opacity-0 group-hover/phone:opacity-100"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Email Row */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 group/email">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-full", contato.email ? "bg-violet-500/10 text-violet-500" : "bg-gray-500/10 text-gray-400")}>
                                        <Mail className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Secure Comms</p>
                                        {contato.email ? (
                                            <p className="text-sm font-mono text-foreground tracking-wider">{contato.email}</p>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-mono text-gray-400 italic">não possui email cadastrado</p>
                                                <span className="flex h-1.5 w-1.5 rounded-full bg-orange-500/50" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {contato.email && (
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(contato.email || '');
                                            toast.success('Email copiado!');
                                        }}
                                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors opacity-0 group-hover/email:opacity-100"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
