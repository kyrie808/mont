import { Navbar, Footer } from '@/components/catalog'

export default function SobrePage() {
    return (
        <div className="min-h-screen flex flex-col bg-mont-cream text-mont-espresso">
            <Navbar />

            <main className="flex-1 flex flex-col items-center justify-center container-mont section-padding text-center">
                <h1 className="font-display text-display text-mont-gold mb-4">
                    Em breve
                </h1>
                <p className="font-body text-heading text-mont-warm-gray">
                    A página sobre a nossa história está em desenvolvimento.
                </p>
            </main>

            <Footer />
        </div>
    )
}
