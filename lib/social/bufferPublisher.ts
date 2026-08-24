import { logEvent } from '@/lib/system/logEvent'
import { createAdminClient } from '@/lib/supabase/admin'
import { absoluteUrl } from '@/lib/seo/site'

type BufferService = 'facebook' | 'linkedin' | 'twitter' | 'x'

type BufferChannel = {
  id: string
  name: string | null
  displayName: string | null
  service: string
  isQueuePaused: boolean | null
}

type BufferOrganization = {
  id: string
  name: string | null
}

type ContentPillar = {
  key: string
  title: string
  serviceKey: string
  audience: string
  path: string
  facebook: string
  linkedin: string
  x: string
  hashtags: string[]
}

export type BufferPostDraft = {
  title: string
  text: string
  slug: string
  serviceKey: string
  audience: string
  path: string
  platform: BufferService
  pillarKey: string
}

export type BufferPublisherResult = {
  ok: boolean
  dryRun: boolean
  sendEnabled: boolean
  scheduledFor: string
  channels: Array<{
    service: string
    status: 'planned' | 'scheduled' | 'skipped' | 'failed'
    reason?: string
    bufferPostId?: string
  }>
  errors: string[]
}

const SUPPORTED_SERVICES = new Set<BufferService>(['facebook', 'linkedin', 'twitter', 'x'])

// These are deliberately product-led, specific posts—not a generic content spinner.
// The cadence rotates through VestBlock's current operating lanes so every channel
// explains a practical next step and does not collapse the company back into one niche.
const CONTENT_PILLARS: ContentPillar[] = [
  {
    key: 'capital-readiness',
    title: 'Capital readiness starts before the application',
    serviceKey: 'business_funding',
    audience: 'business owners and operators',
    path: '/funding',
    facebook:
      'Most funding problems are not solved by submitting more applications. They are solved by understanding the file first: revenue, banking, utilization, documentation, timing, and the actual use of capital. VestBlock helps people organize the next move before unnecessary inquiry pressure builds.',
    linkedin:
      'Capital decisions improve when the file is organized before the application. Revenue, documentation, banking behavior, current obligations, and the use of capital should be clear before a lender or funding partner is asked to assess fit. VestBlock is built to make that first conversation more disciplined.',
    x:
      'More applications are rarely the answer to a weak capital file. Start with readiness: documentation, revenue, banking, utilization, timing, and a clear use of funds.',
    hashtags: ['#BusinessFunding', '#CapitalReadiness', '#VestBlock'],
  },
  {
    key: 'real-estate-routing',
    title: 'A property needs the right path, not a forced one',
    serviceKey: 'sell_my_home',
    audience: 'property owners and real estate operators',
    path: '/sell',
    facebook:
      'A property with repairs, a tight timeline, taxes, a payoff issue, or a tenant situation does not automatically have one answer. The right first step is a clear review of the property, the seller’s goal, and the routes that may actually fit. VestBlock organizes that conversation before it is routed.',
    linkedin:
      'Real-estate opportunities are often lost when every situation is forced into one exit path. Better outcomes start with verified property context, seller priorities, capital constraints, and an honest view of what can be structured. VestBlock creates the routing layer for that work.',
    x:
      'A complicated property is not a one-path problem. Start with context: condition, timeline, payoff, seller goals, buyer demand, and capital fit.',
    hashtags: ['#RealEstate', '#PropertyStrategy', '#VestBlock'],
  },
  {
    key: 'buyer-criteria',
    title: 'A clear buy box creates better deal flow',
    serviceKey: 'real_estate_funding',
    audience: 'real estate buyers and investors',
    path: '/buyers',
    facebook:
      'If a buyer’s criteria lives across text messages, old spreadsheets, and memory, good opportunities are easy to miss. Markets, asset types, price range, rehab appetite, deal structures, funding path, and no-go items should be clear before the next deal shows up.',
    linkedin:
      'Deal flow is only useful when it matches a real acquisition mandate. A current buy box gives sellers, operators, lenders, and partners the information needed to decide whether a deal deserves a serious conversation. VestBlock turns that criteria into a usable routing signal.',
    x:
      'A buy box is not a note in your phone. Markets, asset type, price, rehab, structure, funding path, and no-go items should be clear before the next deal arrives.',
    hashtags: ['#BuyBox', '#RealEstateInvesting', '#DealFlow'],
  },
  {
    key: 'lender-network',
    title: 'Lenders need fit, not random files',
    serviceKey: 'real_estate_funding',
    audience: 'lenders and capital partners',
    path: '/lenders',
    facebook:
      'A better lender relationship starts with a real lending box: states served, product type, loan size, borrower profile, leverage, documentation needs, and hard no-go items. That is how VestBlock can route fewer mismatched conversations and more useful ones.',
    linkedin:
      'Capital partners do not need more unqualified files. They need a clear way to communicate the borrower and deal profiles that belong in their pipeline. VestBlock is building a lender network around fit, readiness, and truthful underwriting context.',
    x:
      'Lenders need fit, not file volume. Clear criteria—state, product, loan size, leverage, borrower profile, and no-go items—creates better routing.',
    hashtags: ['#PrivateLending', '#RealEstateFunding', '#CapitalPartners'],
  },
  {
    key: 'business-systems',
    title: 'Every missed call is a broken handoff',
    serviceKey: 'ai_receptionist',
    audience: 'service businesses and operators',
    path: '/ai-receptionist',
    facebook:
      'A business can spend money on marketing and still lose the opportunity after the phone rings. The handoff matters: fast answers, accurate routing, intake context, follow-up, and a clear next step. VestBlock helps operators make that front door work harder.',
    linkedin:
      'Lead generation and lead handling are different systems. When calls, web inquiries, and follow-up live in separate places, revenue leaks at the handoff. VestBlock helps businesses create a more consistent intake and routing layer without pretending that automation replaces judgment.',
    x:
      'Marketing is wasted when the handoff fails. Calls, web leads, routing, follow-up, and next steps need to work as one operating system.',
    hashtags: ['#AIReceptionist', '#BusinessSystems', '#LeadConversion'],
  },
  {
    key: 'financial-roadmap',
    title: 'A useful financial roadmap starts with the real picture',
    serviceKey: 'business_credit',
    audience: 'people building financial readiness',
    path: '/next-move',
    facebook:
      'Financial progress is easier when the next move is based on the real picture—not a generic checklist. Credit profile, income, debt, business goals, timing, and the options available today all matter. VestBlock’s free roadmap experience is built to turn that information into practical next steps.',
    linkedin:
      'Financial literacy is most useful when it changes the next decision. A good roadmap should connect current credit, cash flow, business readiness, risk, and opportunity—not hand everyone the same advice. VestBlock is building that decision layer in public.',
    x:
      'A financial roadmap should reflect the real picture: credit, cash flow, debt, timing, business goals, and the next decision—not generic advice.',
    hashtags: ['#FinancialLiteracy', '#CreditReadiness', '#NextMove'],
  },
  {
    key: 'dealvault-proof',
    title: 'Clear records make stronger partnerships',
    serviceKey: 'visibility_expansion',
    audience: 'deal partners and operators',
    path: '/dealvault',
    facebook:
      'When a deal has multiple people involved, clarity matters. Who introduced the opportunity? What was agreed? Which milestone was completed? What is the next action? DealVault is the VestBlock proof layer for relationships that should not depend on memory and screenshots.',
    linkedin:
      'Partnership quality is not just about intent. It is also about an accurate record of roles, introductions, milestones, documents, and decisions. DealVault gives VestBlock’s network a clearer operating layer when real opportunities involve more than one party.',
    x:
      'Strong partnerships need more than good intentions. Clear roles, introductions, milestones, documents, and decisions create cleaner deal relationships.',
    hashtags: ['#DealVault', '#Partnerships', '#DealOperations'],
  },
]

function dateKeyInCentral(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function centralDayIndex(date: Date) {
  const [year, month, day] = dateKeyInCentral(date).split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

function normalizeService(value: string): BufferService | null {
  const normalized = value.trim().toLowerCase()
  return SUPPORTED_SERVICES.has(normalized as BufferService) ? (normalized as BufferService) : null
}

function isVestBlockChannel(channel: BufferChannel) {
  return /vest\s*block/i.test(`${channel.displayName || ''} ${channel.name || ''}`)
}

function nextQuarterHour(date = new Date()) {
  const scheduled = new Date(date)
  scheduled.setUTCSeconds(0, 0)
  scheduled.setUTCMinutes(Math.ceil((scheduled.getUTCMinutes() + 10) / 15) * 15)
  if (scheduled.getTime() <= date.getTime()) scheduled.setUTCMinutes(scheduled.getUTCMinutes() + 15)
  return scheduled
}

function pillarForDate(date: Date) {
  return CONTENT_PILLARS[centralDayIndex(date) % CONTENT_PILLARS.length]
}

function clipForX(value: string) {
  return value.length <= 245 ? value : `${value.slice(0, 242).trimEnd()}…`
}

export function buildBufferPostDraft(input: {
  date?: Date
  service: BufferService
  channelId: string
  pillarOffset?: number
}): BufferPostDraft {
  const date = input.date || new Date()
  const offset = Number.isFinite(input.pillarOffset) ? Math.max(0, Math.floor(Number(input.pillarOffset))) : 0
  const pillar = CONTENT_PILLARS[(centralDayIndex(date) + offset) % CONTENT_PILLARS.length]
  const channelSegment = input.channelId.replace(/[^a-z0-9]/gi, '').slice(-28).toLowerCase()
  const slug = `buffer-${dateKeyInCentral(date)}-${input.service}-${channelSegment}`
  const path = pillar.path
  const link = absoluteUrl(path)
  const hashtags = pillar.hashtags.join(' ')
  const base = input.service === 'linkedin'
    ? pillar.linkedin
    : input.service === 'facebook'
      ? pillar.facebook
      : pillar.x
  const text = input.service === 'twitter' || input.service === 'x'
    ? clipForX(`${base}\n${link}\n${pillar.hashtags.slice(0, 2).join(' ')}`)
    : `${base}\n\n${link}\n\n${hashtags}`

  return {
    title: `${pillar.title} — ${input.service}`,
    text,
    slug,
    serviceKey: pillar.serviceKey,
    audience: pillar.audience,
    path,
    platform: input.service,
    pillarKey: pillar.key,
  }
}

async function selectNonDuplicateDraft(input: {
  admin: ReturnType<typeof createAdminClient>
  date: Date
  service: BufferService
  channelId: string
}) {
  const { data, error } = await input.admin
    .from('content_assets')
    .select('body_markdown,metadata_json')
    .eq('content_type', 'social_post')
    .eq('platform', input.service)
    .order('created_at', { ascending: false })
    .limit(CONTENT_PILLARS.length * 2)

  if (error) return buildBufferPostDraft(input)

  const recentlyScheduledText = new Set(
    (data || [])
      .filter((asset) => {
        const metadata = (asset.metadata_json || {}) as Record<string, unknown>
        return Boolean(metadata.bufferPostId) || metadata.bufferStatus === 'scheduled'
      })
      .map((asset) => String(asset.body_markdown || '').trim())
      .filter(Boolean)
  )

  for (let pillarOffset = 0; pillarOffset < CONTENT_PILLARS.length; pillarOffset += 1) {
    const candidate = buildBufferPostDraft({ ...input, pillarOffset })
    if (!recentlyScheduledText.has(candidate.text.trim())) return candidate
  }

  // The entire short rotation is already scheduled. Keep the deterministic
  // default and let Buffer return the provider-side reason rather than creating
  // novel copy outside the approved pillar set.
  return buildBufferPostDraft(input)
}

async function bufferGraphql<T>(apiKey: string, query: string): Promise<T> {
  const response = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  })
  const payload = await response.json().catch(() => null) as { data?: T; errors?: Array<{ message?: string }> } | null
  if (!response.ok || payload?.errors?.length || !payload?.data) {
    const message = payload?.errors?.map((item) => item.message).filter(Boolean).join('; ') || `Buffer returned HTTP ${response.status}.`
    throw new Error(message)
  }
  return payload.data
}

async function resolveVestBlockChannels(apiKey: string) {
  const account = await bufferGraphql<{ account?: { organizations?: BufferOrganization[] } }>(
    apiKey,
    'query { account { organizations { id name } } }'
  )
  const organizations = account.account?.organizations || []
  const channels: BufferChannel[] = []

  for (const organization of organizations) {
    const data = await bufferGraphql<{ channels?: BufferChannel[] }>(
      apiKey,
      `query { channels(input: { organizationId: ${JSON.stringify(organization.id)} }) { id name displayName service isQueuePaused } }`
    )
    channels.push(...(data.channels || []))
  }

  return channels
    .map((channel) => ({ channel, service: normalizeService(channel.service) }))
    .filter((item): item is { channel: BufferChannel; service: BufferService } => Boolean(item.service))
    .filter(({ channel }) => !channel.isQueuePaused && isVestBlockChannel(channel))
}

async function createBufferPost(input: { apiKey: string; channelId: string; service: BufferService; text: string; dueAt: string }) {
  // Buffer requires an explicit type for Facebook. Other supported channels
  // accept the common text/link payload without platform-specific metadata.
  const platformMetadata = input.service === 'facebook'
    ? 'metadata: { facebook: { type: post } }'
    : ''
  const data = await bufferGraphql<{
    createPost?: { post?: { id?: string; dueAt?: string }; message?: string }
  }>(
    input.apiKey,
    `mutation {
      createPost(input: {
        text: ${JSON.stringify(input.text)}
        channelId: ${JSON.stringify(input.channelId)}
        schedulingType: automatic
        mode: customScheduled
        dueAt: ${JSON.stringify(input.dueAt)}
        ${platformMetadata}
      }) {
        ... on PostActionSuccess { post { id dueAt } }
        ... on MutationError { message }
      }
    }`
  )
  const result = data.createPost
  if (!result?.post?.id) throw new Error(result?.message || 'Buffer did not return a scheduled post ID.')
  return result.post
}

function metadataWith(input: Record<string, unknown>, patch: Record<string, unknown>) {
  return { ...input, ...patch }
}

export async function runBufferPublisher(options: { dryRun?: boolean; send?: boolean; now?: Date } = {}): Promise<BufferPublisherResult> {
  const dryRun = Boolean(options.dryRun)
  const sendEnabled = Boolean(options.send && !dryRun && process.env.BUFFER_AUTOPILOT_ENABLE_SEND === 'true')
  const now = options.now || new Date()
  const scheduledFor = nextQuarterHour(now).toISOString()
  const apiKey = String(process.env.BUFFER_API_KEY || '').trim()
  if (!apiKey) {
    return { ok: false, dryRun, sendEnabled, scheduledFor, channels: [], errors: ['BUFFER_API_KEY is not configured.'] }
  }

  let connected: Array<{ channel: BufferChannel; service: BufferService }>
  try {
    connected = await resolveVestBlockChannels(apiKey)
  } catch (error) {
    return {
      ok: false,
      dryRun,
      sendEnabled,
      scheduledFor,
      channels: [],
      errors: [error instanceof Error ? error.message : String(error)],
    }
  }

  if (!connected.length) {
    return {
      ok: false,
      dryRun,
      sendEnabled,
      scheduledFor,
      channels: [],
      errors: ['No unpaused Buffer channels named VestBlock were found for Facebook, LinkedIn, or X.'],
    }
  }

  const results: BufferPublisherResult['channels'] = []
  const errors: string[] = []
  const admin = createAdminClient()

  for (const { channel, service } of connected) {
    const draft = await selectNonDuplicateDraft({ admin, date: now, service, channelId: channel.id })
    if (!sendEnabled) {
      results.push({ service, status: 'planned', reason: dryRun ? 'dry_run' : 'live_send_disabled' })
      continue
    }

    const { data: existing, error: existingError } = await admin
      .from('content_assets')
      .select('id,status,metadata_json')
      .eq('slug', draft.slug)
      .maybeSingle()
    if (existingError) {
      errors.push(`${service}: ${existingError.message}`)
      results.push({ service, status: 'failed', reason: 'ledger_read_failed' })
      continue
    }

    const existingMetadata = (existing?.metadata_json || {}) as Record<string, unknown>
    if (existing?.status === 'published' || existingMetadata.bufferPostId) {
      results.push({ service, status: 'skipped', reason: 'already_scheduled', bufferPostId: String(existingMetadata.bufferPostId || '') || undefined })
      continue
    }

    let assetId = existing?.id as string | undefined
    if (!assetId) {
      const { data: created, error: createError } = await admin
        .from('content_assets')
        .insert({
          title: draft.title,
          slug: draft.slug,
          content_type: 'social_post',
          service_key: draft.serviceKey,
          language: 'en',
          audience: draft.audience,
          prompt: `Buffer ${service} publisher`,
          status: 'ready',
          platform: service,
          post_type: draft.pillarKey,
          body_markdown: draft.text,
          social_caption: draft.text,
          hashtags: [],
          cta_label: 'Explore VestBlock',
          cta_url: draft.path,
          publish_path: draft.path,
          metadata_json: {
            publisher: 'buffer',
            bufferChannelId: channel.id,
            bufferChannelName: channel.displayName || channel.name || null,
            bufferService: service,
            bufferStatus: 'pending',
            scheduledDateCentral: dateKeyInCentral(now),
          },
        })
        .select('id')
        .single()
      if (createError) {
        // A duplicate slug means another invocation claimed this exact channel/day.
        if (createError.code === '23505') {
          results.push({ service, status: 'skipped', reason: 'already_claimed' })
          continue
        }
        errors.push(`${service}: ${createError.message}`)
        results.push({ service, status: 'failed', reason: 'ledger_create_failed' })
        continue
      }
      assetId = created.id
    }

    const pendingMetadata = metadataWith(existingMetadata, {
      publisher: 'buffer',
      bufferChannelId: channel.id,
      bufferChannelName: channel.displayName || channel.name || null,
      bufferService: service,
      bufferStatus: 'sending',
      lastAttemptAt: new Date().toISOString(),
      scheduledDateCentral: dateKeyInCentral(now),
    })
    // A failed row may have been claimed by an earlier publisher version. Refresh
    // its draft before retrying so a time-zone/content-rotation fix is not blocked
    // by Buffer's duplicate-content protection. Rows with an accepted Buffer post
    // returned above and are never rewritten here.
    await admin
      .from('content_assets')
      .update({
        title: draft.title,
        service_key: draft.serviceKey,
        audience: draft.audience,
        platform: service,
        post_type: draft.pillarKey,
        body_markdown: draft.text,
        social_caption: draft.text,
        cta_url: draft.path,
        publish_path: draft.path,
        metadata_json: pendingMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId)

    try {
      const post = await createBufferPost({ apiKey, channelId: channel.id, service, text: draft.text, dueAt: scheduledFor })
      const scheduledAt = new Date().toISOString()
      await admin
        .from('content_assets')
        .update({
          // Buffer has accepted a future schedule at this point; it has not
          // necessarily published. Keep the asset out of published-content
          // analytics until provider delivery is confirmed.
          status: 'ready',
          published_at: null,
          updated_at: scheduledAt,
          metadata_json: metadataWith(pendingMetadata, {
            bufferStatus: 'scheduled',
            bufferPostId: post.id,
            bufferDueAt: post.dueAt || scheduledFor,
          }),
        })
        .eq('id', assetId)
      await logEvent({
        eventType: 'content_generated',
        entityType: 'content_asset',
        entityId: assetId,
        metadata: {
          source: 'buffer-autopilot',
          action: 'scheduled',
          service,
          bufferPostId: post.id,
          dueAt: post.dueAt || scheduledFor,
          pillar: draft.pillarKey,
        },
      })
      results.push({ service, status: 'scheduled', bufferPostId: post.id })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await admin
        .from('content_assets')
        .update({
          status: 'ready',
          updated_at: new Date().toISOString(),
          metadata_json: metadataWith(pendingMetadata, { bufferStatus: 'failed', bufferError: message.slice(0, 500) }),
        })
        .eq('id', assetId)
      errors.push(`${service}: ${message}`)
      results.push({ service, status: 'failed', reason: 'buffer_create_failed' })
    }
  }

  return { ok: errors.length === 0, dryRun, sendEnabled, scheduledFor, channels: results, errors }
}
