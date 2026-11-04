import type { Metadata, Viewport } from 'next'
import { Anton, DM_Sans, Instrument_Serif } from 'next/font/google'
import Script from 'next/script'
import { CapturaOrigem } from '@/components/medicao/CapturaOrigem'
import { DESCRICAO_LOJA, IMAGEM_LOJA, TITULO_LOJA, urlDoSite } from '@/lib/seo'
import './globals.css'

// Mesmo container do catálogo antigo: o pixel da Meta (1689731802148035), o GA4 e o Google Ads
// vivem lá. Eventos da loja em lib/medicao/dataLayer.ts.
const GTM_ID = 'GTM-W6CXZC3R'
/** Verificação do domínio montdistribuidora.com.br na Meta (a mesma do catálogo antigo). */
const VERIFICACAO_META = 'xalko0heebua28ly121mks89yy1t1z'

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-anton', display: 'swap' })
const dmSans = DM_Sans({ weight: ['400', '500', '700'], subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' })
const instrumentSerif = Instrument_Serif({
    weight: '400',
    style: 'italic',
    subsets: ['latin'],
    variable: '--font-instrument-serif',
    display: 'swap',
})

// Base dos endereços da prévia (og:url, og:image) e o padrão de toda página; home, produto e combo
// completam com a própria prévia e o canônico (lib/seo.ts).
export const metadata: Metadata = {
    metadataBase: urlDoSite(),
    title: TITULO_LOJA,
    description: DESCRICAO_LOJA,
    openGraph: { type: 'website', locale: 'pt_BR', siteName: 'Mont Distribuidora', images: [IMAGEM_LOJA] },
    twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#FAF7F2',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR" className={`${anton.variable} ${dmSans.variable} ${instrumentSerif.variable}`}>
            <head>
                <meta name="facebook-domain-verification" content={VERIFICACAO_META} />
            </head>
            <body className="min-h-dvh antialiased">
                {/* Depois que a página carrega (lazyOnload): o GTM e o pixel (~570 KB) disputavam a banda com a foto
                    principal e derrubavam o Lighthouse mobile de 91 para 69. Eventos empurrados antes ficam na fila do
                    dataLayer e o GTM lê todos ao carregar. */}
                <Script id="gtm" strategy="lazyOnload">
                    {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
                </Script>
                <noscript>
                    <iframe
                        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
                        height="0"
                        width="0"
                        style={{ display: 'none', visibility: 'hidden' }}
                    />
                </noscript>
                <CapturaOrigem />
                <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-creme">{children}</main>
            </body>
        </html>
    )
}
