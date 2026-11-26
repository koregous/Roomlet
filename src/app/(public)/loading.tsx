// Shown instantly while a public page's server data resolves, so navigation never feels frozen.
export default function PublicLoading() {
  return (
    <div className="min-h-[60vh] bg-black" aria-busy="true" aria-live="polite">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-[#141414]" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-48 rounded bg-[#141414]" />
            <div className="h-3 w-72 max-w-full rounded bg-[#141414]" />
          </div>
        </div>
        <div className="h-40 rounded-xl bg-[#141414]" />
        <div className="h-40 rounded-xl bg-[#141414]" />
      </div>
    </div>
  )
}
