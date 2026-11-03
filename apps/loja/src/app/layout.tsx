import type { Metadata, Viewport } from 'next'
import { Anton, DM_Sans, Instrument_Serif } from 'next/font/google'
import Script from 'next/script'
import { CapturaOrigem } from '@/components/medicao/CapturaOrigem'
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

export const metadata: Metadata = {
    title: 'Loja Mont',
    description: 'Massa de pão de queijo e doces Duas Irmãs, com entrega na rota.',
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
                {/* Depois da hidratação: eventos empurrados antes ficam na fila do dataLayer e o GTM lê ao carregar. */}
                <Script id="gtm" strategy="afterInteractive">
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
