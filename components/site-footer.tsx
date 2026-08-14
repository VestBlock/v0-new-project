import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#06090c] px-4 py-8 text-slate-400">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-200">VestBlock</p>
          <p className="mt-1 text-sm">A platform of Vestblock LLC.</p>
        </div>
        <nav aria-label="Legal and support" className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
          <Link className="min-h-11 min-w-11 content-center text-center hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" href="/privacy">Privacy</Link>
          <Link className="min-h-11 min-w-11 content-center text-center hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" href="/terms">Terms</Link>
          <Link className="min-h-11 min-w-11 content-center text-center hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" href="/next-move">Free roadmap</Link>
          <a className="min-h-11 min-w-11 content-center text-center hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" href="mailto:contact@vestblock.io">Contact</a>
        </nav>
        <p className="text-sm">© {new Date().getFullYear()} Vestblock LLC</p>
      </div>
    </footer>
  )
}
