import type { Metadata, Viewport } from 'next'
import { Anton, DM_Sans, Instrument_Serif } from 'next/font/google'
import './globals.css'

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
            <body className="min-h-dvh antialiased">
                <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-creme">{children}</div>
            </body>
        </html>
    )
}
