export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-black text-white" aria-busy="true" aria-live="polite">
      <div className="container mx-auto px-6 py-12 max-w-4xl space-y-6 animate-pulse">
        <div className="h-48 rounded-xl bg-[#141414] border border-[#262626]" />
        <div className="h-14 rounded-xl bg-[#141414] border border-[#262626]" />
        <div className="space-y-3">
          <div className="h-20 rounded-xl bg-[#141414] border border-[#262626]" />
          <div className="h-20 rounded-xl bg-[#141414] border border-[#262626]" />
          <div className="h-20 rounded-xl bg-[#141414] border border-[#262626]" />
        </div>
      </div>
    </div>
  )
}
