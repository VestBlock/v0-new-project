import fs from 'node:fs'
import path from 'node:path'

const present = (name) => Boolean(String(process.env[name] || '').trim())
const proof = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config', 'provider-verification.json'), 'utf8')).providers || {} }
  catch { return {} }
})()

const systems = [
  { priority: 'P0', lane: 'Core', name: 'Supabase', all: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] },
  { priority: 'P0', lane: 'AI', name: 'OpenAI generation', all: ['OPENAI_API_KEY'], provider: 'openai' },
  { priority: 'P0', lane: 'Email', name: 'Resend outbound', all: ['RESEND_API_KEY'], alternatives: [['FROM_EMAIL'], ['RESEND_EMAIL']] },
  { priority: 'P0', lane: 'Email', name: 'Resend inbound replies', all: ['RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET'] },
  { priority: 'P1', lane: 'Email', name: 'Google Workspace / Gmail OAuth', all: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_WORKSPACE_SENDER'] },
  { priority: 'P1', lane: 'Email', name: 'Outlook / Microsoft Graph', all: ['MICROSOFT_GRAPH_CLIENT_ID', 'MICROSOFT_GRAPH_CLIENT_SECRET', 'MICROSOFT_TENANT_ID', 'OUTLOOK_ACQUISITIONS_MAILBOX'] },
  { priority: 'P1', lane: 'SEO', name: 'Google Search Console', all: ['GOOGLE_SEARCH_CONSOLE_SITE_URL'], alternatives: [['GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], ['GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL', 'GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY']], provider: 'search_console' },
  { priority: 'P1', lane: 'Social', name: 'Buffer distribution', all: ['BUFFER_API_KEY', 'BUFFER_FACEBOOK_CHANNEL_ID'], provider: 'buffer' },
  { priority: 'P1', lane: 'Workflow', name: 'n8n signed bridge', all: ['N8N_WEBHOOK_URL', 'N8N_WEBHOOK_SECRET'], provider: 'n8n' },
  { priority: 'P1', lane: 'Ads', name: 'Google Ads reporting', all: ['GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_ADS_DEVELOPER_TOKEN'], provider: 'google_ads' },
  { priority: 'P1', lane: 'Ads', name: 'ChatGPT Ads reporting', all: ['OPENAI_ADS_API_KEY'], provider: 'chatgpt_ads' },
  { priority: 'P1', lane: 'Deals', name: 'DealMachine API', alternatives: [['DEALMACHINE_API_KEY'], ['DEALMACHINE_V2_API_KEY']] },
  { priority: 'P1', lane: 'Deals', name: 'DealMachine inbound webhook', all: ['DEALMACHINE_WEBHOOK_SECRET'] },
  { priority: 'P2', lane: 'Ads', name: 'ChatGPT Ads conversion measurement', all: ['OPENAI_ADS_PIXEL_ID', 'OPENAI_ADS_CONVERSIONS_API_KEY'] },
  { priority: 'P2', lane: 'Outreach', name: 'Instantly', all: ['INSTANTLY_API_KEY'] },
  { priority: 'P2', lane: 'Discovery', name: 'Outscraper', all: ['OUTSCRAPER_API_KEY'] },
  { priority: 'P2', lane: 'Discovery', name: 'Apify', all: ['APIFY_TOKEN'] },
  { priority: 'P2', lane: 'Discovery', name: 'Google Places', all: ['GOOGLE_PLACES_API_KEY'] },
  { priority: 'P2', lane: 'Discovery', name: 'Hunter', all: ['HUNTER_API_KEY'] },
  { priority: 'P2', lane: 'Discovery', name: 'RentCast', all: ['RENTCAST_API_KEY'] },
  { priority: 'P2', lane: 'Discovery', name: 'SAM.gov', all: ['SAM_GOV_API_KEY'] },
  { priority: 'P2', lane: 'Discovery', name: 'ATTOM', all: ['ATTOM_API_KEY'] },
  { priority: 'P2', lane: 'Payments', name: 'PayPal', all: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'] },
  { priority: 'P2', lane: 'Analytics', name: 'PostHog', all: ['NEXT_PUBLIC_POSTHOG_KEY', 'POSTHOG_API_KEY'] },
  { priority: 'P2', lane: 'Observability', name: 'Sentry', alternatives: [['NEXT_PUBLIC_SENTRY_DSN'], ['SENTRY_DSN']], all: ['SENTRY_AUTH_TOKEN'] },
]

function evaluate(system) {
  const missingAll = (system.all || []).filter((name) => !present(name))
  const alternativesReady = !system.alternatives || system.alternatives.some((group) => group.every(present))
  const missingAlternative = alternativesReady ? [] : [`one of: ${system.alternatives.map((group) => group.join(' + ')).join(' OR ')}`]
  const configured = missingAll.length === 0 && alternativesReady
  const anyPresent = (system.all || []).some(present) || (system.alternatives || []).some((group) => group.some(present))
  const provider = system.provider ? proof[system.provider] : null
  let state = configured ? 'CONFIGURED' : anyPresent ? 'PARTIAL' : 'MISSING'
  if (provider?.status === 'blocked') state = configured ? 'BLOCKED' : state
  if (provider?.status === 'partial' && configured) state = 'PARTIAL'
  return { ...system, state, missing: [...missingAll, ...missingAlternative], proof: provider?.detail || null }
}

const results = systems.map(evaluate)

async function requestJson(url, init = {}) {
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    })
    let body = null
    try { body = await response.json() } catch { body = null }
    return { ok: response.ok, status: response.status, body }
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.name : 'RequestError' }
  }
}

function failureDetail(result) {
  const providerCode = typeof result.body?.error === 'string'
    ? result.body.error
    : result.body?.error?.status || result.body?.error?.code || result.body?.name
  const reason = result.body?.error?.errors?.[0]?.reason
  const message = String(result.body?.error?.message || result.body?.error_description || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/https?:\/\/\S+/gi, '[url redacted]')
    .slice(0, 180)
  const detail = [...new Set([providerCode, reason, message].filter(Boolean))].join(': ')
  return detail ? `HTTP ${result.status}: ${detail}` : result.status ? `HTTP ${result.status}` : result.error || 'request_failed'
}

async function googleAccessToken(refreshToken) {
  if (!refreshToken || !present('GOOGLE_CLIENT_ID') || !present('GOOGLE_CLIENT_SECRET')) return null
  const result = await requestJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  return result.ok && result.body?.access_token
    ? { token: result.body.access_token }
    : { error: failureDetail(result) }
}

async function runLiveProbes() {
  const probes = []
  const add = (name, ok, detail) => probes.push({ name, ok, detail })

  if (present('OPENAI_API_KEY')) {
    const models = await requestJson('https://api.openai.com/v1/models', {
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    })
    add('OpenAI authentication', models.ok, models.ok
      ? `Authenticated; ${Array.isArray(models.body?.data) ? models.body.data.length : 0} models visible. Generation billing must be verified separately.`
      : failureDetail(models))
  }

  if (present('OPENAI_ADS_API_KEY')) {
    const account = await requestJson('https://api.ads.openai.com/v1/ad_account', {
      headers: { authorization: `Bearer ${process.env.OPENAI_ADS_API_KEY}`, accept: 'application/json' },
    })
    add('ChatGPT Ads authentication', account.ok, account.ok
      ? `Authenticated; account status ${String(account.body?.status || 'unknown')}; review ${String(account.body?.review?.status || 'unknown')}.`
      : failureDetail(account))
  }

  if (present('BUFFER_API_KEY') && present('BUFFER_FACEBOOK_CHANNEL_ID')) {
    const organizationResult = await requestJson('https://api.buffer.com', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.BUFFER_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: 'query GetOrganizations { account { organizations { id } } }',
      }),
    })
    const organizationIds = organizationResult.ok && !organizationResult.body?.errors
      ? (organizationResult.body?.data?.account?.organizations || []).map((organization) => organization?.id).filter(Boolean)
      : []
    let selectedChannel = null
    let lastChannelFailure = null
    for (const organizationId of organizationIds) {
      const channelResult = await requestJson('https://api.buffer.com', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.BUFFER_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query: `query GetChannels { channels(input: { organizationId: ${JSON.stringify(organizationId)} }) { id name displayName service isQueuePaused } }`,
        }),
      })
      if (!channelResult.ok || channelResult.body?.errors) {
        lastChannelFailure = channelResult.body?.errors?.[0]?.message || failureDetail(channelResult)
        continue
      }
      const channels = Array.isArray(channelResult.body?.data?.channels) ? channelResult.body.data.channels : []
      selectedChannel = channels.find((channel) => channel?.id === process.env.BUFFER_FACEBOOK_CHANNEL_ID) || null
      if (selectedChannel) break
    }
    const validFacebookChannel = selectedChannel?.service === 'facebook'
    add('Buffer authentication', organizationResult.ok && validFacebookChannel, validFacebookChannel
      ? 'Authenticated; the selected VestBlock Facebook channel is visible. Scheduling and publishing remain approval-gated.'
      : organizationResult.body?.errors?.[0]?.message || lastChannelFailure || 'The selected VestBlock Facebook channel was not visible to this key.')
  }

  if (present('RESEND_API_KEY')) {
    const domains = await requestJson('https://api.resend.com/domains', {
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    })
    const domainList = Array.isArray(domains.body?.data) ? domains.body.data : []
    const verified = domainList.filter((domain) => domain?.status === 'verified').length
    add('Resend authentication', domains.ok, domains.ok
      ? `Authenticated; ${domainList.length} domain(s), ${verified} verified.`
      : failureDetail(domains))
  }

  if (present('GOOGLE_REFRESH_TOKEN')) {
    const auth = await googleAccessToken(process.env.GOOGLE_REFRESH_TOKEN)
    if (auth?.token) {
      const profile = await requestJson('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { authorization: `Bearer ${auth.token}` },
      })
      add('Gmail OAuth', profile.ok, profile.ok
        ? `Authenticated; mailbox profile is readable (${Number(profile.body?.messagesTotal || 0)} messages reported).`
        : failureDetail(profile))
    } else {
      add('Gmail OAuth', false, auth?.error || 'OAuth inputs missing')
    }
  }

  const searchRefreshToken = process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN
  if (searchRefreshToken && present('GOOGLE_SEARCH_CONSOLE_SITE_URL')) {
    const auth = await googleAccessToken(searchRefreshToken)
    if (auth?.token) {
      const sites = await requestJson('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { authorization: `Bearer ${auth.token}` },
      })
      const entries = Array.isArray(sites.body?.siteEntry) ? sites.body.siteEntry : []
      const normalized = (value) => String(value || '').replace(/\/+$/, '')
      const matched = entries.some((entry) => normalized(entry?.siteUrl) === normalized(process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL))
      add('Google Search Console OAuth', sites.ok && matched, sites.ok
        ? `Authenticated; ${entries.length} properties visible; configured property match: ${matched ? 'yes' : 'no'}.`
        : failureDetail(sites))
    } else {
      add('Google Search Console OAuth', false, auth?.error || 'OAuth inputs missing')
    }
  }

  if (present('PAYPAL_CLIENT_ID') && present('PAYPAL_CLIENT_SECRET')) {
    const configuredMode = String(process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || '').toLowerCase()
    const modes = configuredMode
      ? [['live', 'production', 'prod'].includes(configuredMode) ? 'live' : 'sandbox']
      : ['sandbox', 'live']
    let authenticatedMode = null
    let lastFailure = null
    for (const mode of modes) {
      const paypal = await requestJson(`${mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }),
      })
      if (paypal.ok) {
        authenticatedMode = mode
        break
      }
      lastFailure = failureDetail(paypal)
    }
    add('PayPal OAuth', Boolean(authenticatedMode), authenticatedMode
      ? `Authenticated in ${authenticatedMode} mode${configuredMode ? '.' : '; set PAYPAL_MODE to this value.'}`
      : lastFailure || 'Authentication failed')
  }

  if (present('SENTRY_AUTH_TOKEN')) {
    const sentry = await requestJson('https://sentry.io/api/0/', {
      headers: { authorization: `Bearer ${process.env.SENTRY_AUTH_TOKEN}` },
    })
    add('Sentry authentication', sentry.ok, sentry.ok ? 'Authenticated; API root is readable.' : failureDetail(sentry))
  }

  if (present('MICROSOFT_GRAPH_CLIENT_ID') && present('MICROSOFT_GRAPH_CLIENT_SECRET') && present('MICROSOFT_TENANT_ID') && present('OUTLOOK_ACQUISITIONS_MAILBOX')) {
    const graphToken = await requestJson(`https://login.microsoftonline.com/${encodeURIComponent(process.env.MICROSOFT_TENANT_ID)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_GRAPH_CLIENT_ID,
        client_secret: process.env.MICROSOFT_GRAPH_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    })
    if (graphToken.ok && graphToken.body?.access_token) {
      const mailbox = encodeURIComponent(process.env.OUTLOOK_ACQUISITIONS_MAILBOX)
      const inbox = await requestJson(`https://graph.microsoft.com/v1.0/users/${mailbox}/mailFolders/inbox?$select=id,totalItemCount,unreadItemCount`, {
        headers: { authorization: `Bearer ${graphToken.body.access_token}` },
      })
      add('Outlook / Microsoft Graph', inbox.ok, inbox.ok
        ? `Authenticated; mailbox inbox metadata is readable (${Number(inbox.body?.totalItemCount || 0)} items reported).`
        : failureDetail(inbox))
    } else {
      add('Outlook / Microsoft Graph', false, failureDetail(graphToken))
    }
  }

  return probes
}

async function main() {
  const liveProbes = process.argv.includes('--live') ? await runLiveProbes() : []
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), valuesExposed: false, systems: results, liveProbes }, null, 2))
    return
  }

  console.log('| Priority | Lane | System | State | Missing / proof |')
  console.log('| --- | --- | --- | --- | --- |')
  for (const result of results) {
    const detail = result.missing.length ? result.missing.join(', ') : result.proof || 'Environment names present; run a provider proof before launch.'
    console.log(`| ${result.priority} | ${result.lane} | ${result.name} | ${result.state} | ${detail.replaceAll('|', '\\|')} |`)
  }

  if (liveProbes.length) {
    console.log('\nLive credential probes (no secret values):')
    for (const probe of liveProbes) console.log(`- ${probe.ok ? 'PASS' : 'FAIL'} ${probe.name}: ${probe.detail}`)
  }
  console.log('\nSecret values were not read or printed.')
}

await main()
