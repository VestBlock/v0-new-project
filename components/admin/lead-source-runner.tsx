"use client"

import { Terminal } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function LeadSourceRunner() {
  return (
    <Card className="border-slate-800 bg-slate-950/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Terminal className="h-5 w-5 text-cyan-300" />
          Source runtime follows the approved VestBlock platform lanes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-300">
        <p>
          The source layer supports capital, real estate, opportunity, roadmap,
          partner, and DealVault journeys. Each source must retain provenance,
          route through the CRM, and pass its lane-specific qualification rules.
        </p>
        <p>
          Same-market partner discovery now respects cooldown windows, so we do
          not keep scraping the same source and market every day just to burn usage.
        </p>
        <p>
          DealMachine export automation is retired. Its native API adapter remains
          intentionally inactive until a new key is verified; use{' '}
          <code>npm run dealmachine:health</code> to check the connection without
          starting acquisition or outreach.
        </p>
      </CardContent>
    </Card>
  )
}
