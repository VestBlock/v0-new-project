'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCopy, Compass, Search, TerminalSquare, X } from 'lucide-react'

import { adminNavGroups, adminNavItems } from '@/lib/admin/navigation'
import { cn } from '@/lib/utils'

const OPERATOR_COMMANDS = [
  { label: 'Ingest latest DealMachine export', command: 'npm run distress:dealmachine:ingest-export:apply' },
  { label: 'Prepare skip-trace upload', command: 'npm run distress:skiptrace-prep' },
  { label: 'Run distress stack (daily)', command: 'npm run distress:stack:daily' },
  { label: 'Outreach scorecard', command: 'npm run outreach:scorecard' },
  { label: 'AEO visibility scorecard', command: 'npm run visibility:aeo-scorecard' },
]

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [copied, setCopied] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const closePalette = useCallback(() => {
    setCopied(null)
    setQuery("")
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePalette()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [closePalette, open])

  const go = useCallback(
    (href: string) => {
      closePalette()
      router.push(href)
    },
    [closePalette, router]
  )

  const copy = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(command)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      // clipboard unavailable — ignore
    }
  }, [])

  const normalizedQuery = query.trim().toLowerCase()
  const groupedMatches = useMemo(
    () =>
      adminNavGroups
        .map((group) => ({
          ...group,
          items: adminNavItems
            .filter((item) => item.group === group.id)
            .filter((item) => {
              if (!normalizedQuery) return true
              return `${group.title} ${item.title} ${item.description}`.toLowerCase().includes(normalizedQuery)
            }),
        }))
        .filter((group) => group.items.length > 0),
    [normalizedQuery]
  )
  const operatorMatches = useMemo(
    () =>
      OPERATOR_COMMANDS.filter((item) => {
        if (!normalizedQuery) return true
        return `${item.label} ${item.command}`.toLowerCase().includes(normalizedQuery)
      }),
    [normalizedQuery]
  )
  const hasMatches = groupedMatches.length > 0 || operatorMatches.length > 0

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center px-4 py-20"
      role="dialog"
      aria-modal="true"
      aria-label="Admin command palette"
    >
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
        onClick={closePalette}
      />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-4 w-4 text-cyan-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a workspace or copy an operator command..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            aria-label="Close command palette"
            onClick={closePalette}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-2 py-2">
          {!hasMatches ? (
            <div className="px-3 py-10 text-center text-sm text-slate-500">No matches.</div>
          ) : null}

          {groupedMatches.map((group) => (
            <div key={group.id} className="py-2">
              <p className="px-3 pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {group.title}
              </p>
              {group.items.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => go(item.href)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <Compass className="mr-2 h-4 w-4 text-cyan-300/70" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ))}

          {operatorMatches.length ? (
            <div className={cn("py-2", groupedMatches.length ? "border-t border-white/10" : "")}>
              <p className="px-3 pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Operator commands
              </p>
              {operatorMatches.map((item) => (
                <button
                  key={item.command}
                  type="button"
                  onClick={() => copy(item.command)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  {copied === item.command ? (
                    <ClipboardCopy className="mr-2 h-4 w-4 text-emerald-400" />
                  ) : (
                    <TerminalSquare className="mr-2 h-4 w-4 text-slate-400" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm">{copied === item.command ? 'Copied!' : item.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{item.command}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
