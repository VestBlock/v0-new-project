import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function AdminLenderOutreachPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const { data: messages } = await admin
    .from('lender_outreach_messages')
    .select('*, lenders(name, contact_email, relationship_stage)')
    .order('updated_at', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Lender network</p>
          <h1 className="text-2xl font-semibold text-white">Lender outreach queue</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/lenders">Back to lenders</Link>
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Drafts, approvals, and sends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead>Lender</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(messages || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-slate-400">
                      No lender outreach has been generated yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (messages || []).map((message: any) => (
                    <TableRow key={message.id} className="border-slate-800">
                      <TableCell>
                        <Link href={`/admin/lenders/${message.lender_id}`} className="font-medium text-white hover:text-cyan-300">
                          {message.lenders?.name || 'Lender'}
                        </Link>
                        <div className="text-xs text-slate-400">{message.lenders?.relationship_stage?.replaceAll('_', ' ') || ''}</div>
                      </TableCell>
                      <TableCell className="text-slate-300">{message.channel.replaceAll('_', ' ')}</TableCell>
                      <TableCell><Badge variant="secondary">{message.status}</Badge></TableCell>
                      <TableCell className="text-slate-300">{message.lenders?.contact_email || 'No email'}</TableCell>
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
