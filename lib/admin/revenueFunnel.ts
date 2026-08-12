export type RevenueFunnelStatus = 'green' | 'yellow' | 'red'

export type RevenueFunnelStage = {
  key: string
  label: string
  count: number
  conversionFromPrevious: number | null
  evidence: string
  status: RevenueFunnelStatus
  href: string
}

export type CommandCenterRevenueFunnel = {
  status: RevenueFunnelStatus
  headline: string
  proofStandard: string
  lastVerifiedAt: string | null
  stages: RevenueFunnelStage[]
  blockers: { key: string; detail: string; severity: 'critical' | 'warning' }[]
}

type Row = Record<string, any>

const ACCEPTED = new Set(['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied'])
const DELIVERED = new Set(['delivered', 'opened', 'clicked', 'replied'])
const PACKET_ACCEPTED = new Set(['accepted', 'sent', 'delivered', 'opened', 'replied', 'interested'])
const PACKET_REPLIED = new Set(['replied', 'interested'])
const OFFER_OR_FURTHER = new Set([
  'offer_sent',
  'under_contract',
  'buyer_packet_sent',
  'buyer_interested',
  'assignment_drafted',
  'closed_won',
])
const CONTRACT_OR_FURTHER = new Set([
  'under_contract',
  'buyer_packet_sent',
  'buyer_interested',
  'assignment_drafted',
  'closed_won',
])

function lower(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function withinDays(value: unknown, days: number) {
  const timestamp = Date.parse(String(value || ''))
  return Number.isFinite(timestamp) && Date.now() - timestamp <= days * 24 * 60 * 60 * 1000
}

function uniqueCount(rows: Row[], key: string, predicate: (row: Row) => boolean) {
  return new Set(rows.filter(predicate).map((row, index) => String(row[key] || row.id || index))).size
}

function latestTimestamp(rows: Row[]) {
  return rows
    .flatMap((row) => [row.updated_at, row.created_at, row.sent_at, row.replied_at, row.received_at])
    .filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null
}

function conversion(previous: number, current: number) {
  if (previous <= 0) return null
  return Math.round((current / previous) * 1000) / 10
}

function stageStatus(count: number, previous: number, key: string): RevenueFunnelStatus {
  if (count > 0) return 'green'
  if (previous > 0 && ['delivered', 'replied', 'qualified', 'under_contract', 'buyer_replied', 'closed'].includes(key)) return 'red'
  return 'yellow'
}

export function buildRevenueFunnelSnapshot(input: {
  leads: Row[]
  outreachMessages: Row[]
  outreachSendEvents: Row[]
  buyerPackets: Row[]
  buyerPacketSends: Row[]
  dealPipelineItems: Row[]
  mailboxReady: boolean
  outboundReady: boolean
}) : CommandCenterRevenueFunnel {
  const leadIds = new Set(input.leads.map((lead) => String(lead.id)))
  const fresh = input.leads.filter((lead) => withinDays(lead.created_at, 7))
  const contactable = input.leads.filter((lead) => {
    const email = String(lead.email || '').trim()
    const phone = String(lead.phone || '').trim()
    return (
      (email && lead.email_valid !== false && !['bounced', 'complained', 'suppressed', 'failed'].includes(lower(lead.delivery_status))) ||
      Boolean(phone)
    )
  })
  const drafted = uniqueCount(input.outreachMessages, 'lead_id', (row) =>
    leadIds.has(String(row.lead_id)) && ['draft', 'needs_review', 'approved', 'queued', 'accepted', 'sent'].includes(lower(row.status))
  )
  const providerAccepted = uniqueCount(input.outreachSendEvents, 'lead_id', (row) =>
    leadIds.has(String(row.lead_id)) && ACCEPTED.has(lower(row.status))
  )
  const delivered = uniqueCount(input.outreachSendEvents, 'lead_id', (row) =>
    leadIds.has(String(row.lead_id)) && DELIVERED.has(lower(row.status))
  )
  const replied = uniqueCount(input.leads, 'id', (lead) =>
    ['replied', 'interested', 'qualified', 'closed_won'].includes(lower(lead.status)) || lower(lead.delivery_status) === 'replied'
  )
  const qualified = uniqueCount(input.leads, 'id', (lead) =>
    ['qualified', 'closed_won'].includes(lower(lead.status))
  )
  const offers = uniqueCount(input.dealPipelineItems, 'id', (row) => OFFER_OR_FURTHER.has(lower(row.current_stage)))
  const contracts = uniqueCount(input.dealPipelineItems, 'id', (row) => CONTRACT_OR_FURTHER.has(lower(row.current_stage)))
  const packetsReady = uniqueCount(input.buyerPackets, 'id', (row) =>
    !['draft', 'failed', 'archived'].includes(lower(row.status))
  )
  const packetsAccepted = uniqueCount(input.buyerPacketSends, 'buyer_packet_id', (row) =>
    PACKET_ACCEPTED.has(lower(row.status))
  )
  const buyerReplies = uniqueCount(input.buyerPacketSends, 'buyer_packet_id', (row) =>
    PACKET_REPLIED.has(lower(row.status))
  )
  const closed = uniqueCount(input.dealPipelineItems, 'id', (row) => lower(row.current_stage) === 'closed_won')

  const rawStages = [
    { key: 'fresh', label: 'Fresh seller leads', count: fresh.length, evidence: 'Lead rows created in the last 7 days', href: '/admin/leads' },
    { key: 'contactable', label: 'Contactable', count: contactable.length, evidence: 'Usable email or phone on current seller leads', href: '/admin/leads?contactable_only=1' },
    { key: 'drafted', label: 'Strategy drafts', count: drafted, evidence: 'Stored strategy-specific outreach message', href: '/admin/leads?outreachStatus=needs_review' },
    { key: 'accepted', label: 'Provider accepted', count: providerAccepted, evidence: 'Provider acceptance event with a lead ID', href: '/admin/command-center#outreach-command' },
    { key: 'delivered', label: 'Delivered', count: delivered, evidence: 'Provider delivery/open/click/reply webhook evidence', href: '/admin/command-center#outreach-command' },
    { key: 'replied', label: 'Seller replies', count: replied, evidence: 'Mailbox reply or seller reply status', href: '/admin/command-center#inbox-command' },
    { key: 'qualified', label: 'Qualified sellers', count: qualified, evidence: 'Operator-qualified seller record', href: '/admin/leads?status=qualified' },
    { key: 'offer_sent', label: 'Offers sent', count: offers, evidence: 'Deal pipeline at offer sent or further', href: '/admin/command-center#lane-diagnostics' },
    { key: 'under_contract', label: 'Under contract', count: contracts, evidence: 'Deal pipeline at under contract or further', href: '/admin/command-center#lane-diagnostics' },
    { key: 'packet_ready', label: 'Buyer packets ready', count: packetsReady, evidence: 'Prepared buyer packet record', href: '/admin/command-center#lane-diagnostics' },
    { key: 'packet_accepted', label: 'Buyer packet accepted', count: packetsAccepted, evidence: 'Buyer packet provider acceptance or later evidence', href: '/admin/command-center#lane-diagnostics' },
    { key: 'buyer_replied', label: 'Buyer replies', count: buyerReplies, evidence: 'Buyer packet reply or interest event', href: '/admin/command-center#inbox-command' },
    { key: 'closed', label: 'Closed won', count: closed, evidence: 'Deal pipeline closed-won record', href: '/admin/command-center#lane-diagnostics' },
  ]

  const stages: RevenueFunnelStage[] = rawStages.map((stage, index) => {
    const previous = index === 0 ? stage.count : rawStages[index - 1].count
    return {
      ...stage,
      conversionFromPrevious: index === 0 ? null : conversion(previous, stage.count),
      status: stageStatus(stage.count, previous, stage.key),
    }
  })

  const blockers: CommandCenterRevenueFunnel['blockers'] = []
  if (!input.outboundReady) blockers.push({ key: 'outbound_provider', detail: 'No verified outbound provider is ready.', severity: 'critical' })
  if (!input.mailboxReady) blockers.push({ key: 'reply_capture', detail: 'Reply capture is disconnected, so automation cannot safely send or prove replies.', severity: 'critical' })
  if (!fresh.length) blockers.push({ key: 'fresh_supply', detail: 'No fresh seller leads were created in the last 7 days.', severity: 'warning' })
  if (providerAccepted > 0 && delivered === 0) blockers.push({ key: 'delivery_evidence', detail: 'Messages were accepted by a provider, but no delivery evidence is recorded.', severity: 'critical' })
  if (delivered > 0 && replied === 0) blockers.push({ key: 'reply_rate', detail: 'Delivered outreach has not produced a recorded seller reply.', severity: 'warning' })
  if (replied > 0 && qualified === 0) blockers.push({ key: 'qualification', detail: 'Seller replies exist, but none are recorded as qualified.', severity: 'warning' })
  if (qualified > 0 && contracts === 0) blockers.push({ key: 'contract_conversion', detail: 'Qualified sellers exist, but no deal is under contract.', severity: 'warning' })

  const status: RevenueFunnelStatus = blockers.some((item) => item.severity === 'critical')
    ? 'red'
    : closed > 0 || buyerReplies > 0
      ? 'green'
      : 'yellow'

  return {
    status,
    headline: closed > 0
      ? `${closed} closed-won deal${closed === 1 ? '' : 's'} recorded.`
      : qualified > 0
        ? `${qualified} qualified seller${qualified === 1 ? '' : 's'} need conversion into offers and contracts.`
        : replied > 0
          ? `${replied} seller repl${replied === 1 ? 'y is' : 'ies are'} waiting for qualification.`
          : 'No qualified seller conversion is proven yet.',
    proofStandard: 'Drafts are not sends. Provider acceptance is not delivery. Revenue is counted only from recorded paid or closed-won evidence.',
    lastVerifiedAt: latestTimestamp([
      ...input.outreachSendEvents,
      ...input.buyerPacketSends,
      ...input.dealPipelineItems,
    ]),
    stages,
    blockers,
  }
}
