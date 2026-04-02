import Link from 'next/link'

export function Footer() {
    const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5511934417085'
    const whatsappMessage = encodeURIComponent('Olá! Vim pelo site e gostaria de saber mais sobre os produtos.')

    return (
        <footer className="bg-mont-espresso text-mont-cream">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Brand */}
                    <div>
                        <h3 className="font-display text-2xl font-bold mb-4">Mont Distribuidora</h3>
                        <p className="text-mont-warm-gray font-body text-sm">
                            Pão de queijo artesanal feito com alma. Massas naturais congeladas e refrigeradas direto pra sua casa.
                        </p>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="font-body font-semibold mb-4">Contato</h4>
                        <ul className="space-y-2 text-sm text-mont-warm-gray font-body">
                            <li>
                                <a
                                    href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-mont-gold transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                    WhatsApp
                                </a>
                            </li>
                            <li>📍 Região do ABC Paulista</li>
                            <li>🕐 Seg-Sex: 8h às 18h | Sáb: 8h às 12h</li>
                        </ul>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-body font-semibold mb-4">Links Rápidos</h4>
                        <ul className="space-y-2 text-sm text-mont-warm-gray font-body">
                            <li>
                                <Link href="/produtos" className="hover:text-mont-gold transition-colors">
                                    Produtos
                                </Link>
                            </li>
                            <li>
                                <Link href="/sobre" className="hover:text-mont-gold transition-colors">
                                    Sobre Nós
                                </Link>
                            </li>
                            <li>
                                <Link href="/carrinho" className="hover:text-mont-gold transition-colors">
                                    Carrinho
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-8 pt-8 border-t border-mont-warm-gray/20 text-center text-sm text-mont-warm-gray font-body">
                    <p>© {new Date().getFullYear()} Mont Distribuidora. Todos os direitos reservados.</p>
                </div>
            </div>
        </footer>
    )
}
