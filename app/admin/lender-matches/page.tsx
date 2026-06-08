import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { scoreDealVaultConversion } from '@/lib/dealflow/criteria'

export const dynamic = 'force-dynamic'

function fitStatus(value: unknown) {
  const confidence = Number(value || 0)
  if (confidence >= 80) return 'Strong fit'
  if (confidence >= 65) return 'Usable fit'
  if (confidence >= 45) return 'Review fit'
  return 'Needs context'
}

export default async function AdminLenderMatchesPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const { data: matches } = await admin
    .from('lender_matches')
    .select('*, lenders(name, category, contact_email)')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Lender network</p>
          <h1 className="text-2xl font-semibold text-white">Borrower to lender matches</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/lenders">Back to lenders</Link>
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="text-white">Recent lender matches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead>Lender</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Deal type</TableHead>
                  <TableHead>Fit status</TableHead>
                  <TableHead>DealVault recommendation</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(matches || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-slate-400">
                      No borrower-lender matches have been stored yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (matches || []).map((match: any) => {
                    const dealVault = scoreDealVaultConversion({
                      partnerCount: 2,
                      hasReferralPayout: false,
                      hasMilestones: ['reviewed', 'shared', 'active'].includes(match.status),
                      needsProof: Number(match.confidence_score || 0) >= 70,
                      hasBuyerOrLenderRouting: true,
                      dealValue: match.funding_goal_amount || null,
                      relationshipStage: match.status,
                    })

                    return (
                      <TableRow key={match.id} className="border-slate-800">
                        <TableCell>
                          <Link href={`/admin/lenders/${match.lender_id}`} className="font-medium text-white hover:text-cyan-300">
                            {match.lenders?.name || 'Lender'}
                          </Link>
                          <div className="text-xs text-slate-400">{match.lenders?.contact_email || 'No email'}</div>
                        </TableCell>
                        <TableCell className="text-slate-300">{match.service_type || 'Funding path'}</TableCell>
                        <TableCell className="text-slate-300">{match.deal_type || '-'}</TableCell>
                        <TableCell><Badge variant="secondary">{fitStatus(match.confidence_score)}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={dealVault.shouldPitchDealVault ? 'default' : 'outline'}>
                            {dealVault.shouldPitchDealVault ? 'Recommended' : 'Watch'}
                          </Badge>
                          <div className="mt-1 text-xs text-slate-400">{dealVault.nextStep}</div>
                        </TableCell>
                        <TableCell className="text-slate-300">{match.fit_summary || '-'}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
