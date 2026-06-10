'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCopy, Compass, TerminalSquare } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { adminNavGroups, adminNavItems } from '@/lib/admin/navigation'

const OPERATOR_COMMANDS = [
  { label: 'Ingest latest DealMachine export', command: 'npm run distress:dealmachine:ingest-export:apply' },
  { label: 'Prepare skip-trace upload', command: 'npm run distress:skiptrace-prep' },
  { label: 'Run distress stack (daily)', command: 'npm run distress:stack:daily' },
  { label: 'Outreach scorecard', command: 'npm run outreach:scorecard' },
  { label: 'Revenue command scorecard', command: 'npm run revenue:command' },
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

  useEffect(() => {
    if (!open) setCopied(null)
  }, [open])

  const go = useCallback(
    (href: string) => {
      onOpenChange(false)
      router.push(href)
    },
    [onOpenChange, router]
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

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a workspace or copy an operator command…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {adminNavGroups.map((group) => {
          const items = adminNavItems.filter((item) => item.group === group.id)
          if (!items.length) return null
          return (
            <CommandGroup key={group.id} heading={group.title}>
              {items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${group.title} ${item.title} ${item.description}`}
                  onSelect={() => go(item.href)}
                >
                  <Compass className="mr-2 h-4 w-4 text-cyan-300/70" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )
        })}
        <CommandSeparator />
        <CommandGroup heading="Operator commands (copies to clipboard)">
          {OPERATOR_COMMANDS.map((item) => (
            <CommandItem
              key={item.command}
              value={`${item.label} ${item.command}`}
              onSelect={() => copy(item.command)}
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
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
