'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { adminNavGroups, adminNavItems } from '@/lib/admin/navigation'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:self-start lg:overflow-y-auto lg:pr-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="border-b border-slate-800 pb-4">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
                VestBlock Admin
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white">Operator Workspace</h1>
              <p className="mt-2 text-sm text-slate-400">
                One place to move between the command center, pipeline tools, partner
                networks, and growth ops.
              </p>
            </div>

            <div className="mt-4 space-y-5">
              {adminNavGroups.map((group) => {
                const links = adminNavItems.filter((item) => item.group === group.id)
                if (!links.length) return null

                return (
                  <div key={group.id} className="space-y-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {group.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{group.description}</p>
                    </div>
                    <div className="space-y-2">
                      {links.map((item) => {
                        const isActive =
                          item.href === '/admin-panel'
                            ? pathname === item.href
                            : pathname === item.href || pathname.startsWith(`${item.href}/`)

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'block rounded-2xl border px-3 py-3 transition-colors',
                              isActive
                                ? 'border-cyan-400/40 bg-cyan-400/10 text-white'
                                : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                            )}
                          >
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
