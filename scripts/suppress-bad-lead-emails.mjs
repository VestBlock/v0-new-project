import { createClient } from '@supabase/supabase-js'
import { formatScriptError, getEmailQualityIssue, normalizeEmailAddress } from './shared-email-quality.mjs'

const PAGE_SIZE = 1000

function hasFlag(name) {
  return process.argv.includes(name)
}

function isBlockedLeadEmail(value) {
  return getEmailQualityIssue(value) !== null
}

async function listLeadsWithEmail(admin) {
  const rows = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await admin
      .from('leads')
      .select('id,email,email_valid,business_name,status,outreach_status')
      .not('email', 'is', null)
      .order('id', { ascending: true })
      .range(from, to)

    if (error) throw error
    if (!data?.length) break

    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials in environment.')
  }

  const apply = hasFlag('--apply')
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const data = await listLeadsWithEmail(admin)
  const blocked = data.filter((lead) => isBlockedLeadEmail(lead.email))
  const activeBlocked = blocked.filter(
    (lead) =>
      lead.email_valid !== false &&
      !['failed', 'do_not_contact'].includes(String(lead.outreach_status || '').toLowerCase())
  )
  const leadIds = activeBlocked.map((lead) => lead.id)
  const emails = Array.from(new Set(activeBlocked.map((lead) => normalizeEmailAddress(lead.email)).filter(Boolean)))

  if (apply && leadIds.length) {
    const { error: leadError } = await admin
      .from('leads')
      .update({
        email_valid: false,
        delivery_status: 'failed',
        outreach_status: 'failed',
        suppression_reason: 'placeholder_or_platform_email',
        updated_at: new Date().toISOString(),
      })
      .in('id', leadIds)

    if (leadError) throw leadError

    const { error: messageError } = await admin
      .from('outreach_messages')
      .update({
        status: 'failed',
        send_error: 'Placeholder or platform email blocked from outreach.',
        updated_at: new Date().toISOString(),
      })
      .in('lead_id', leadIds)
      .eq('channel', 'email')
      .in('status', ['approved', 'queued', 'needs_review', 'failed'])

    if (messageError) throw messageError

    for (const email of emails) {
      const { data: existing } = await admin
        .from('lead_suppressions')
        .select('id')
        .eq('email', email)
        .eq('status', 'active')
        .maybeSingle()

      if (!existing) {
        const { error: suppressionError } = await admin
          .from('lead_suppressions')
          .insert({ email, reason: 'placeholder_or_platform_email', status: 'active' })

        if (suppressionError) throw suppressionError
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        apply,
        inspectedLeadCount: data.length,
        activeBlockedLeadCount: leadIds.length,
        historicalBlockedLeadCount: blocked.length - activeBlocked.length,
        blockedEmailCount: emails.length,
        blockedEmails: emails,
        sample: activeBlocked.slice(0, 25).map((lead) => ({
          id: lead.id,
          email: lead.email,
          businessName: lead.business_name,
          status: lead.status,
          outreachStatus: lead.outreach_status,
        })),
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: formatScriptError(error) }, null, 2))
  process.exit(1)
})
