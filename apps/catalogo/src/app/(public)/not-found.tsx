import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <p className="text-mont-espresso font-display text-2xl font-bold">
        Página não encontrada
      </p>
      <p className="text-mont-gray text-center max-w-sm">
        O produto ou página que você procura
        não existe ou foi removido.
      </p>
      <Link
        href="/produtos"
        className="bg-mont-gold text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
      >
        Ver produtos
      </Link>
    </div>
  )
}
