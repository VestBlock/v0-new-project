import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORY_LABELS } from '@/lib/lenders/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const dynamic = 'force-dynamic'

export default async function AdminLenderProgramsPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const { data: programs } = await admin
    .from('lender_programs')
    .select('*, lenders(name, category, lender_type)')
    .order('updated_at', { ascending: false })
    .limit(150)

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Lender network</p>
          <h1 className="text-2xl font-semibold text-white">Lender programs</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/lenders">Back to lenders</Link>
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Program inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead>Lender</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Eligibility</TableHead>
                  <TableHead>Range</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(programs || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-slate-400">
                      No lender programs saved yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (programs || []).map((program: any) => (
                    <TableRow key={program.id} className="border-slate-800">
                      <TableCell>
                        <Link href={`/admin/lenders/${program.lender_id}`} className="font-medium text-white hover:text-cyan-300">
                          {program.lenders?.name || 'Lender'}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {CATEGORY_LABELS[program.lenders?.category || ''] || program.lenders?.category || ''}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-200">
                        <div>{program.program_name}</div>
                        {program.description ? <div className="mt-1 text-xs text-slate-400">{program.description}</div> : null}
                      </TableCell>
                      <TableCell className="text-slate-300">{String(program.program_type || '').replaceAll('_', ' ')}</TableCell>
                      <TableCell className="text-slate-300">
                        {program.startup_allowed ? 'Startup' : 'Established'} · {program.low_doc ? 'Low doc' : 'Standard docs'}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        ${Math.round(Number(program.loan_amount_min || 0)).toLocaleString()} - ${Math.round(Number(program.loan_amount_max || 0)).toLocaleString()}
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
