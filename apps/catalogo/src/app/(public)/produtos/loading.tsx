export default function Loading() {
  return (
    <div className="min-h-[60vh] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-gray-100 animate-pulse aspect-[3/4]"
        />
      ))}
    </div>
  )
}
