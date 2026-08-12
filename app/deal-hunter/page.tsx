import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicDealHunter } from '@/components/property-intelligence/public-deal-hunter'

export const dynamic = 'force-dynamic'

export default function DealHunterPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-cyan-200">VestBlock Deal Hunter</p>
            <h1 className="mt-1 text-3xl font-semibold">Public-record property intelligence</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Explore limited public-signal property opportunities. Admin-only owner intelligence, contact research, and OSINT review details are hidden from this view.
            </p>
          </div>
          <Button asChild variant="outline"><Link href="/sell">Submit a Property</Link></Button>
        </div>

        <PublicDealHunter />
      </div>
    </main>
  )
}
