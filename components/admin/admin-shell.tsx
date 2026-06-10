'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Command, Menu, Radar, Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import { adminNavGroups, adminNavItems } from '@/lib/admin/navigation'
import { CommandPalette } from '@/components/admin/command-palette'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <div className="space-y-4">
      {adminNavGroups.map((group) => {
        const links = adminNavItems.filter((item) => item.group === group.id)
        if (!links.length) return null
        const isCollapsed = collapsed[group.id]

        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left"
            >
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {group.title}
              </span>
              <ChevronDown
                className={cn('h-3 w-3 text-slate-600 transition-transform', isCollapsed && '-rotate-90')}
              />
            </button>
            {!isCollapsed ? (
              <div className="mt-1 space-y-0.5">
                {links.map((item) => {
                  const isActive =
                    item.href === '/admin-panel'
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(`${item.href}/`)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={item.description}
                      className={cn(
                        'block rounded-lg border border-transparent px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'border-cyan-400/30 bg-cyan-400/10 font-medium text-white'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                      )}
                    >
                      {item.title}
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const activeTitle = useMemo(() => {
    const exact = adminNavItems.find((item) =>
      item.href === '/admin-panel' ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    return exact?.title || 'Admin'
  }, [pathname])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Top command bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1700px] items-center gap-3 px-4 lg:px-6">
          {/* Mobile nav */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open navigation"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-white/10 bg-slate-950 p-4">
              <SheetTitle className="sr-only">Admin navigation</SheetTitle>
              <div className="mb-4 flex items-center gap-2">
                <Radar className="h-4 w-4 text-cyan-300" />
                <p className="text-sm font-semibold text-white">VestBlock Admin</p>
              </div>
              <div className="max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
                <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/admin/command-center" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10">
              <Radar className="h-3.5 w-3.5 text-cyan-300" />
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">VestBlock</span>
            <span className="vb-mono hidden text-[0.6rem] uppercase tracking-[0.2em] text-slate-500 md:block">
              / {activeTitle}
            </span>
          </Link>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-cyan-300/40 hover:text-slate-200"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Jump anywhere</span>
            <kbd className="vb-mono hidden items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[0.6rem] text-slate-500 sm:inline-flex">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          <Link
            href="/admin/command-center"
            className={cn(
              'hidden rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors md:block',
              pathname === '/admin/command-center'
                ? 'border-cyan-400/40 bg-cyan-400/10 text-white'
                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/40'
            )}
          >
            Command Center
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1700px] gap-6 px-4 py-6 lg:px-6">
        {/* Left rail */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur">
            <NavLinks pathname={pathname} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
