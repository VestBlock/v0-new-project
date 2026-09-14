import { generateLenderOutreach, LENDER_OUTREACH_TEMPLATE_VERSION } from '../lib/lenders/outreach'
import { createClient } from '@supabase/supabase-js'
import type { LenderOutreachChannel, LenderRecord } from '../lib/lenders/types'

const apply = process.argv.includes('--apply')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
}
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

type Candidate = {
  id: string
  channel: LenderOutreachChannel
  metadata_json: Record<string, unknown> | null
  lenders: LenderRecord | null
}

function replacementFor(candidate: Candidate) {
  const lender = candidate.lenders
  if (!lender) return null
  const bundle = generateLenderOutreach(lender)
  const content = {
    email_intro: bundle.emailIntro,
    email_followup: bundle.emailFollowup,
    spanish_email: bundle.spanishEmail,
  }[candidate.channel as 'email_intro' | 'email_followup' | 'spanish_email']
  if (!content) return null

  return {
    subject: content.subject,
    body: content.body,
    cta: content.cta,
    partnership_angle: content.partnershipAngle,
    borrower_referral_angle: content.borrowerReferralAngle,
    compliance_note: content.complianceNote,
    generated_with: bundle.generatedWith,
    last_generated_at: new Date().toISOString(),
    metadata_json: {
      ...(candidate.metadata_json || {}),
      templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
      qualificationQuestions: content.qualificationQuestions,
      economicsPrompt: content.economicsPrompt,
      copyRefreshedAt: new Date().toISOString(),
      copyRefreshReason: 'verified_lender_canary_recovery',
    },
    updated_at: new Date().toISOString(),
  }
}

async function main() {
  const { data, error } = await admin
    .from('lender_outreach_messages')
    .select('id,channel,metadata_json,lenders(*)')
    .in('channel', ['email_intro', 'email_followup', 'spanish_email'])
    .eq('status', 'approved')
    .is('sent_at', null)
    .order('approved_at', { ascending: true, nullsFirst: false })
    .limit(500)

  if (error) throw error
  const candidates = ((data || []) as unknown as Candidate[]).filter((candidate) => {
    const version = String(candidate.metadata_json?.templateVersion || '')
    return candidate.lenders && version !== LENDER_OUTREACH_TEMPLATE_VERSION && replacementFor(candidate)
  })

  const summary = {
    mode: apply ? 'apply' : 'dry_run',
    candidateCount: candidates.length,
    templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
    byChannel: candidates.reduce<Record<string, number>>((counts, candidate) => {
      counts[candidate.channel] = (counts[candidate.channel] || 0) + 1
      return counts
    }, {}),
  }

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  let updatedCount = 0
  for (const candidate of candidates) {
    const replacement = replacementFor(candidate)
    if (!replacement) continue
    const { data: updated, error: updateError } = await admin
      .from('lender_outreach_messages')
      .update(replacement)
      .eq('id', candidate.id)
      .eq('status', 'approved')
      .is('sent_at', null)
      .select('id')
      .maybeSingle()
    if (updateError) throw updateError
    if (updated?.id) updatedCount += 1
  }

  const { data: remainingRows, error: verifyError } = await admin
    .from('lender_outreach_messages')
    .select('metadata_json')
    .in('channel', ['email_intro', 'email_followup', 'spanish_email'])
    .eq('status', 'approved')
    .is('sent_at', null)
  if (verifyError) throw verifyError
  const remainingStaleApprovedCount = (remainingRows || []).filter(
    (row) => String((row.metadata_json as Record<string, unknown> | null)?.templateVersion || '') !== LENDER_OUTREACH_TEMPLATE_VERSION
  ).length

  console.log(JSON.stringify({ ...summary, updatedCount, remainingStaleApprovedCount }, null, 2))
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  )
  process.exitCode = 1
})
