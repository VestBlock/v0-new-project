import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  MailCheck,
  Network,
  ShieldCheck,
  Target,
} from 'lucide-react'
import { checkAdminAccess } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  dealFlowRevenueTargets,
  scoreBuyerCriteria,
  scoreDealVaultConversion,
  scoreLenderCriteria,
  scoreManualOutreachReadiness,
} from '@/lib/dealflow/criteria'
import type { BuyerBuyBoxRecord, BuyerMatchRecord, BuyerRecord } from '@/lib/buyers/types'
import type { LenderProductRecord, LenderProgramRecord, LenderRecord } from '@/lib/lenders/types'

export const dynamic = 'force-dynamic'

function currency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function groupById<T extends Record<string, any>>(items: T[] | null | undefined, idKey: string) {
  const grouped = new Map<string, T[]>()
  for (const item of items || []) {
    const id = String(item[idKey] || '')
    if (!id) continue
    grouped.set(id, [...(grouped.get(id) || []), item])
  }
  return grouped
}

function humanize(value: string) {
  return value.replaceAll('_', ' ')
}

function passportLabel(label: string) {
  if (label === 'priority') return 'Verified passport'
  if (label === 'strong') return 'Usable passport'
  if (label === 'usable') return 'Needs refresh'
  return 'Needs criteria'
}

function outreachLabel(outreach: { readyForManualSend: boolean; blockers: string[]; nextActions: string[] }) {
  if (outreach.readyForManualSend) return 'Manual approved'
  if (outreach.blockers.length) return outreach.blockers[0]
  return outreach.nextActions[0] || 'Needs review'
}

export default async function AdminDealFlowCommandPage() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const [
    buyersResult,
    buyBoxesResult,
    lendersResult,
    lenderProductsResult,
    lenderProgramsResult,
    buyerMatchesResult,
    lenderMatchesResult,
  ] = await Promise.all([
    admin.from('buyers').select('*').order('updated_at', { ascending: false }).limit(500),
    admin.from('buyer_buy_boxes').select('*').eq('active', true).limit(1000),
    admin.from('lenders').select('*').order('updated_at', { ascending: false }).limit(500),
    admin.from('lender_products').select('*').eq('active', true).limit(1000),
    admin.from('lender_programs').select('*').eq('active', true).limit(1000),
    admin.from('buyer_matches').select('*').order('created_at', { ascending: false }).limit(200),
    admin.from('lender_matches').select('*').order('created_at', { ascending: false }).limit(200),
  ])

  const buyers = (buyersResult.data || []) as BuyerRecord[]
  const buyBoxesByBuyer = groupById((buyBoxesResult.data || []) as BuyerBuyBoxRecord[], 'buyer_id')
  const lenders = (lendersResult.data || []) as LenderRecord[]
  const productsByLender = groupById((lenderProductsResult.data || []) as LenderProductRecord[], 'lender_id')
  const programsByLender = groupById((lenderProgramsResult.data || []) as LenderProgramRecord[], 'lender_id')
  const buyerMatches = (buyerMatchesResult.data || []) as BuyerMatchRecord[]
  const lenderMatches = (lenderMatchesResult.data || []) as Array<Record<string, any>>

  const buyerCriteria = buyers.map((buyer) => ({
    buyer,
    criteria: scoreBuyerCriteria(buyer, buyBoxesByBuyer.get(buyer.id) || []),
    outreach: scoreManualOutreachReadiness(buyer),
  }))
  const lenderCriteria = lenders.map((lender) => ({
    lender,
    criteria: scoreLenderCriteria(
      lender,
      productsByLender.get(lender.id) || [],
      programsByLender.get(lender.id) || []
    ),
    outreach: scoreManualOutreachReadiness(lender),
  }))

  const priorityBuyers = buyerCriteria
    .filter((item) => item.criteria.score >= 68 || item.outreach.readyForManualSend)
    .sort((a, b) => b.criteria.score + b.outreach.score - (a.criteria.score + a.outreach.score))
    .slice(0, 8)
  const priorityLenders = lenderCriteria
    .filter((item) => item.criteria.score >= 68 || item.outreach.readyForManualSend)
    .sort((a, b) => b.criteria.score + b.outreach.score - (a.criteria.score + a.outreach.score))
    .slice(0, 8)

  const dealVaultSignals = [
    ...buyerMatches.slice(0, 12).map((match) => {
      const signal = scoreDealVaultConversion({
        partnerCount: 2,
        hasReferralPayout: true,
        hasMilestones: Boolean(match.status && ['shared', 'active', 'reviewed'].includes(match.status)),
        needsProof: (match.confidence_score || 0) >= 70,
        hasBuyerOrLenderRouting: true,
        dealValue: null,
        relationshipStage: match.status,
      })
      return {
        id: match.id,
        title: [match.property_address, match.city, match.state].filter(Boolean).join(', ') || 'Buyer match',
        type: 'Buyer match',
        score: signal.score,
        shouldPitch: signal.shouldPitchDealVault,
        reasons: signal.reasons,
        nextStep: signal.nextStep,
        href: '/admin/buyer-matches',
      }
    }),
    ...lenderMatches.slice(0, 12).map((match) => {
      const signal = scoreDealVaultConversion({
        partnerCount: 2,
        hasReferralPayout: false,
        hasMilestones: Boolean(match.status && ['shared', 'active', 'reviewed'].includes(match.status)),
        needsProof: (match.confidence_score || 0) >= 70,
        hasBuyerOrLenderRouting: true,
        dealValue: match.funding_goal_amount || null,
        relationshipStage: match.status,
      })
      return {
        id: match.id,
        title: match.service_type || match.deal_type || 'Lender match',
        type: 'Lender match',
        score: signal.score,
        shouldPitch: signal.shouldPitchDealVault,
        reasons: signal.reasons,
        nextStep: signal.nextStep,
        href: '/admin/lender-matches',
      }
    }),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  const monthlyRevenueTarget = dealFlowRevenueTargets.reduce(
    (sum, target) => sum + target.target * target.unitRevenue,
    0
  )

  const stats = [
    { label: 'Buyer passports usable', value: `${buyerCriteria.filter((item) => ['strong', 'priority'].includes(item.criteria.label)).length} / ${buyerCriteria.length}` },
    { label: 'Lender passports usable', value: `${lenderCriteria.filter((item) => ['strong', 'priority'].includes(item.criteria.label)).length} / ${lenderCriteria.length}` },
    { label: 'Manual approved', value: buyerCriteria.filter((item) => item.outreach.readyForManualSend).length + lenderCriteria.filter((item) => item.outreach.readyForManualSend).length },
    { label: 'DealVault recommended', value: dealVaultSignals.filter((signal) => signal.shouldPitch).length },
    { label: 'Buyer matches', value: buyerMatches.length },
    { label: 'Lender matches', value: lenderMatches.length },
  ]

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Board operating system</p>
          <h1 className="text-2xl font-semibold text-white">DealFlow Command</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            This is the daily control room for turning seller intake, buyer trust passports, lender
            fit passports, manual-approved outreach, and DealVault recommendations into one revenue system.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dealflow-growth-system">Public system page</Link>
          </Button>
          <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
            <Link href="/admin/buyer-matches">
              Review matches
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-800 bg-slate-950/70">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">{stat.label}</div>
              <div className="mt-2 text-2xl font-semibold text-white">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="border-cyan-500/20 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BadgeDollarSign className="h-5 w-5 text-cyan-300" />
              Multi-million revenue model
            </CardTitle>
            <CardDescription>
              A board-level target mix that points the team toward recurring and high-ticket revenue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <p className="text-sm text-slate-400">Monthly target at plan maturity</p>
              <p className="mt-1 text-3xl font-semibold text-white">{currency(monthlyRevenueTarget)}</p>
              <p className="mt-2 text-sm text-slate-400">
                Annualized run-rate: {currency(monthlyRevenueTarget * 12)} before custom network buildouts.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {dealFlowRevenueTargets.map((target) => (
                <div key={target.label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-white">{target.label}</p>
                    <Badge variant="outline">{currency(target.target * target.unitRevenue)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {target.target} x {currency(target.unitRevenue)} {target.cadence}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{target.note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              Board rules for daily execution
            </CardTitle>
            <CardDescription>
              These are the rules that keep the product from drifting back into scattered services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            {[
              'Push qualified operators toward DealVault demo or DealFlow Growth review.',
              'Capture buyer and lender trust passports before sending outreach.',
              'Send only manual-approved outreach while deliverability is being protected.',
              'Recommend DealVault when a deal has partners, payouts, milestones, proof needs, or routing risk.',
              'Keep AI, visibility, credit, and funding prep as support services around real estate deal flow.',
            ].map((rule) => (
              <div key={rule} className="flex gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <span>{rule}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Network className="h-5 w-5 text-cyan-300" />
              Buyer trust passports
            </CardTitle>
            <CardDescription>Buyers with usable criteria, clear missing-info notes, and manual-approved outreach readiness.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {priorityBuyers.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
                No usable buyer passports yet. Add buy boxes, proof-of-funds status, closing speed, last-confirmed notes, and direct contacts.
              </p>
            ) : (
              priorityBuyers.map(({ buyer, criteria, outreach }) => (
                <Link
                  key={buyer.id}
                  href={`/admin/buyers/${buyer.id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition-colors hover:border-cyan-400/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{buyer.name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {[buyer.category, buyer.headquarters_state, buyer.contact_email || 'no email'].filter(Boolean).join(' | ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{passportLabel(criteria.label)}</Badge>
                      <Badge variant={outreach.readyForManualSend ? 'default' : 'outline'}>
                        {outreachLabel(outreach)}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    {criteria.strengths.slice(0, 2).join('. ') || criteria.gaps.slice(0, 2).join('. ')}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Target className="h-5 w-5 text-cyan-300" />
              Lender fit passports
            </CardTitle>
            <CardDescription>Lenders with usable product criteria, coverage notes, direct contacts, and manual outreach readiness.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {priorityLenders.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
                No usable lender passports yet. Add loan range, state coverage, minimum criteria, speed to close, last-confirmed notes, and direct contacts.
              </p>
            ) : (
              priorityLenders.map(({ lender, criteria, outreach }) => (
                <Link
                  key={lender.id}
                  href={`/admin/lenders/${lender.id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition-colors hover:border-cyan-400/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{lender.name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {[lender.category, lender.states_served?.slice(0, 3).join(', '), lender.contact_email || 'no email'].filter(Boolean).join(' | ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{passportLabel(criteria.label)}</Badge>
                      <Badge variant={outreach.readyForManualSend ? 'default' : 'outline'}>
                        {outreachLabel(outreach)}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    {criteria.strengths.slice(0, 2).join('. ') || criteria.gaps.slice(0, 2).join('. ')}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-slate-800 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <MailCheck className="h-5 w-5 text-cyan-300" />
            DealVault recommendations
          </CardTitle>
          <CardDescription>
            These are the matches where proof records, payout clarity, or milestone tracking should be introduced.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {dealVaultSignals.length === 0 ? (
            <p className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400 md:col-span-2">
              No stored matches yet. Generate buyer and lender matches, then recommend DealVault when routing risk appears.
            </p>
          ) : (
            dealVaultSignals.map((signal) => (
              <Link
                key={`${signal.type}-${signal.id}`}
                href={signal.href}
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition-colors hover:border-cyan-400/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{signal.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{signal.type}</p>
                  </div>
                  <Badge variant={signal.shouldPitch ? 'default' : 'outline'}>
                    {signal.shouldPitch ? 'DealVault recommended' : 'Watch for proof risk'}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-slate-300">{signal.nextStep}</p>
                <p className="mt-2 text-xs text-slate-500">{signal.reasons.slice(0, 2).map(humanize).join('. ')}</p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
