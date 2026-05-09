import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function ScrapeRunsPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: runs } = await admin
    .from('scrape_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Lead intelligence</p>
          <h1 className="text-2xl font-semibold text-white">Scrape runs</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/leads">Back to leads</Link>
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader><CardTitle className="text-white">Recent scrape activity</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Run type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(runs || []).map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{run.source_key}</TableCell>
                  <TableCell>{run.run_type}</TableCell>
                  <TableCell><Badge variant="secondary">{run.status}</Badge></TableCell>
                  <TableCell>{run.result_count}</TableCell>
                  <TableCell>{new Date(run.started_at).toLocaleString()}</TableCell>
                  <TableCell>{run.completed_at ? new Date(run.completed_at).toLocaleString() : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
