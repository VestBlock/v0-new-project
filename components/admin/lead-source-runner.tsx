"use client"

import { Terminal } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function LeadSourceRunner() {
  return (
    <Card className="border-slate-800 bg-slate-950/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Terminal className="h-5 w-5 text-cyan-300" />
          Outreach now runs off-platform
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-300">
        <p>
          Scraping, enrichment, draft generation, approval, and send preparation
          have been removed from the deployed website runtime.
        </p>
        <p>
          Use the Codex/operator workflow instead: <code>npm run outreach:v4-workflow</code>,
          then <code>npm run outreach:v4-scorecard</code>.
        </p>
      </CardContent>
    </Card>
  )
}
