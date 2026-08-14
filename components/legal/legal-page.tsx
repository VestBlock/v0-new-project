import type { ReactNode } from 'react'

export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return (
    <article className="vb-legal-page min-h-screen bg-[#06090c] px-4 py-16 text-slate-200 sm:px-6 lg:py-24">
      <div className="mx-auto w-full max-w-4xl">
        <header className="border-b border-white/10 pb-10">
          <p className="vb-mono text-sm uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
          <p className="mt-4 text-sm text-slate-400">Last updated {updated}</p>
        </header>
        <div className="prose prose-invert mt-10 max-w-none prose-headings:scroll-mt-24 prose-headings:text-white prose-h2:mt-12 prose-h2:text-2xl prose-h3:text-lg prose-p:leading-7 prose-p:text-slate-300 prose-li:my-2 prose-li:text-slate-300 prose-a:text-cyan-200 prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-white prose-strong:text-slate-100">
          {children}
        </div>
      </div>
    </article>
  )
}
