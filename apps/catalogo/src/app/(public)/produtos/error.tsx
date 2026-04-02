'use client'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <p className="text-mont-espresso font-display text-2xl font-bold">
        Algo deu errado
      </p>
      <p className="text-mont-gray text-center max-w-sm">
        Não conseguimos carregar essa página.
        Tente novamente em alguns instantes.
      </p>
      <button
        onClick={reset}
        className="bg-mont-gold text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
      >
        Tentar novamente
      </button>
    </div>
  )
}
