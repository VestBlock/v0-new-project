import { createClient } from '@supabase/supabase-js'

const OWN_DOMAINS = new Set(['vestblock.io'])
const BOUNCE_QUERY =
  'newer_than:30d (from:mailer-daemon OR from:postmaster OR subject:Undeliverable OR subject:"Delivery Status Notification")'

function argValue(name, fallback = null) {
  const prefix = `${name}=`
  const match = process.argv.find((value) => value.startsWith(prefix))
  return match ? match.slice(prefix.length) : fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function decodeBase64Url(value) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function collectPayloadText(payload, output = []) {
  if (!payload) return output
  if (payload.body?.data) output.push(decodeBase64Url(payload.body.data))
  for (const part of payload.parts || []) collectPayloadText(part, output)
  return output
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function extractBouncedEmails(text) {
  const candidates = []
  const patterns = [
    /message to\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\s+couldn'?t be delivered/gi,
    /recipient(?: address)?(?: not found| unknown)?\s*(?:to address)?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
    /final-recipient:\s*rfc822;\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
    /original-recipient:\s*rfc822;\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
  ]

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) candidates.push(match[1]?.toLowerCase())
  }

  return unique(
    candidates.filter((email) => {
      const domain = email.split('@')[1]
      return domain && !OWN_DOMAINS.has(domain)
    })
  )
}

async function getGoogleAccessToken() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length) {
    throw new Error(`Missing Gmail OAuth env vars: ${missing.join(', ')}`)
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) throw new Error(`Google token refresh failed with ${response.status}`)
  const data = await response.json()
  if (!data.access_token) throw new Error('Google token refresh did not return an access token.')
  return data.access_token
}

async function gmailFetch(accessToken, path) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || `Gmail request failed with ${response.status}`
    if (/insufficient authentication scopes/i.test(message)) {
      throw new Error(
        'Gmail bounce processing needs a refresh token with Gmail read scope. Reconnect Google Workspace with gmail.readonly or gmail.modify scope, then rerun this script.'
      )
    }
    throw new Error(message)
  }
  return data
}

async function listBounceMessages(accessToken, query, maxResults) {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) })
  const data = await gmailFetch(accessToken, `messages?${params.toString()}`)
  return data.messages || []
}

async function readMessage(accessToken, id) {
  const params = new URLSearchParams({ format: 'full' })
  return gmailFetch(accessToken, `messages/${id}?${params.toString()}`)
}

async function processBouncedEmail(admin, email, gmailMessageId, apply) {
  const { data: leads, error } = await admin
    .from('leads')
    .select('id,email,business_name,status,outreach_status,delivery_status')
    .eq('email', email)

  if (error) throw error
  if (!leads?.length) return { email, matchedLeads: 0, updated: false }

  if (!apply) {
    return {
      email,
      matchedLeads: leads.length,
      updated: false,
      leadIds: leads.map((lead) => lead.id),
    }
  }

  const leadIds = leads.map((lead) => lead.id)
  await admin
    .from('leads')
    .update({
      email_valid: false,
      delivery_status: 'bounced',
      outreach_status: 'failed',
      suppression_reason: 'gmail_bounce',
      updated_at: new Date().toISOString(),
    })
    .in('id', leadIds)
    .throwOnError()

  await admin
    .from('outreach_messages')
    .update({
      status: 'failed',
      send_error: `Gmail bounce detected from message ${gmailMessageId}`,
      updated_at: new Date().toISOString(),
    })
    .in('lead_id', leadIds)
    .eq('channel', 'email')
    .in('status', ['approved', 'queued', 'sent', 'failed'])
    .throwOnError()

  const { data: existingSuppression } = await admin
    .from('lead_suppressions')
    .select('id')
    .eq('email', email)
    .eq('status', 'active')
    .maybeSingle()

  if (!existingSuppression) {
    await admin
      .from('lead_suppressions')
      .insert({
        email,
        reason: 'gmail_bounce',
        status: 'active',
      })
      .throwOnError()
  }

  for (const lead of leads) {
    await admin
      .from('outreach_send_events')
      .insert({
        lead_id: lead.id,
        channel: 'email',
        status: 'failed',
        recipient: email,
        error_message: 'Gmail bounce detected.',
        metadata_json: {
          action: 'gmail_bounce_processed',
          gmailMessageId,
        },
      })
      .throwOnError()
  }

  return {
    email,
    matchedLeads: leads.length,
    updated: true,
    leadIds,
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials in environment.')
  }

  const apply = hasFlag('--apply')
  const maxResults = Number.parseInt(argValue('--max', '25'), 10) || 25
  const query = argValue('--query', BOUNCE_QUERY)
  const accessToken = await getGoogleAccessToken()
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const messages = await listBounceMessages(accessToken, query, maxResults)
  const foundEmails = new Map()

  for (const message of messages) {
    const detail = await readMessage(accessToken, message.id)
    const text = [detail.snippet || '', ...collectPayloadText(detail.payload)].join('\n')
    for (const email of extractBouncedEmails(text)) {
      if (!foundEmails.has(email)) foundEmails.set(email, message.id)
    }
  }

  const results = []
  for (const [email, gmailMessageId] of foundEmails.entries()) {
    results.push(await processBouncedEmail(admin, email, gmailMessageId, apply))
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        apply,
        searchedMessages: messages.length,
        bouncedEmails: foundEmails.size,
        matchedEmails: results.filter((row) => row.matchedLeads > 0).length,
        updatedEmails: results.filter((row) => row.updated).length,
        results,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  )
  process.exit(1)
})
