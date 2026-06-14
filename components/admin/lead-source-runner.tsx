"use client"

import { Terminal } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function LeadSourceRunner() {
  return (
    <Card className="border-slate-800 bg-slate-950/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Terminal className="h-5 w-5 text-cyan-300" />
          Website runtime is now trimmed to current real estate sourcing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-300">
        <p>
          Legacy small-business scrape loops have been retired from the deployed app.
          What remains in runtime is the current VestBlock stack: buyer, lender,
          and investor discovery plus public-record signals that support real
          estate routing.
        </p>
        <p>
          Same-market partner discovery now respects cooldown windows, so we do
          not keep scraping the same source and market every day just to burn usage.
        </p>
        <p>
          DealMachine harvesting, export review, and high-volume outreach still
          run through the operator workflow. Use <code>npm run distress:dealmachine:market-harvest</code>,
          <code>npm run distress:dealmachine:ingest-export:apply</code>, and the
          export outreach scripts from Codex when you need fresh seller inventory.
        </p>
      </CardContent>
    </Card>
  )
}
