import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function AdminBuyerOutreachPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const { data: messages } = await admin
    .from('buyer_outreach_messages')
    .select('*, buyers(name, contact_email, relationship_stage)')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(200)

  const queue = messages || []
  const counts = {
    needsReview: queue.filter((message: any) => message.status === 'needs_review').length,
    approved: queue.filter((message: any) => message.status === 'approved').length,
    sent: queue.filter((message: any) => message.status === 'sent').length,
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Buyer network</p>
          <h1 className="text-2xl font-semibold text-white">Buyer outreach queue</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/buyers">Back to buyers</Link>
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Drafts, approvals, and sends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Needs review</p>
              <p className="mt-1 text-2xl font-semibold text-white">{counts.needsReview}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Approved</p>
              <p className="mt-1 text-2xl font-semibold text-white">{counts.approved}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Sent</p>
              <p className="mt-1 text-2xl font-semibold text-white">{counts.sent}</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead>Buyer</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Subject / angle</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-slate-400">
                      No buyer outreach has been generated yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  queue.map((message: any) => (
                    <TableRow key={message.id} className="border-slate-800">
                      <TableCell>
                        <Link href={`/admin/buyers/${message.buyer_id}`} className="font-medium text-white hover:text-cyan-300">
                          {message.buyers?.name || 'Buyer'}
                        </Link>
                        <div className="text-xs text-slate-400">{message.buyers?.relationship_stage?.replaceAll('_', ' ') || ''}</div>
                      </TableCell>
                      <TableCell className="text-slate-300">{message.channel.replaceAll('_', ' ')}</TableCell>
                      <TableCell><Badge variant="secondary">{message.status}</Badge></TableCell>
                      <TableCell className="max-w-[340px] text-slate-300">
                        <div className="line-clamp-2 text-sm text-white">{message.subject || 'Non-email channel'}</div>
                        {message.cta ? <div className="mt-1 line-clamp-2 text-xs text-slate-500">{message.cta}</div> : null}
                      </TableCell>
                      <TableCell className="text-slate-300">{message.buyers?.contact_email || 'No email'}</TableCell>
                      <TableCell className="text-slate-300">
                        {message.updated_at ? new Date(message.updated_at).toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
