import 'server-only'

import { upsertLead } from '@/lib/leads/repository'
import type { LeadRecord, NormalizedLeadInput } from '@/lib/leads/types'
import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import {
  createDealMachineV2Client,
  dealMachineApiKey,
  hasDealMachineCredentials,
} from '@/lib/dealmachine/v2-client.mjs'
import {
  DEALMACHINE_STRATEGY_FIELDS,
  buildDailyStrategyPlans,
  hydrateStrategyPlan,
} from '@/lib/dealmachine/v2-strategy-catalog.mjs'

type RawRecord = Record<string, any>

export type DealMachineSyncResult = {
  configured: boolean
  ok: boolean
  blockedReason: string | null
  fetched: number
  contactable: number
  contactless: number
  mailReady: number
  queuedForExport: number
  ingested: number
  startAfter: number
  nextAfter: number
  wrapped: boolean
  creditsReserved: number
  strategyRuns: Array<{
    strategyKey: string
    market: string
    lowball: boolean
    requestedRows: number
    estimatedCredits: number
    fetched: number
    status: string
    error: string | null
  }>
  leads: LeadRecord[]
}

function envInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function labelValue(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return String(record.label || record.value || record.name || '').trim()
  }
  return String(value ?? '').trim()
}

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits.length === 10 ? digits : ''
}

function contactEmails(contact: RawRecord) {
  const rows = Array.isArray(contact?.emails)
    ? contact.emails
    : Array.isArray(contact?.email_addresses)
      ? contact.email_addresses
      : [contact?.email, contact?.email_address]
  return Array.from(new Set(
    rows
      .map((entry) => normalizeEmailAddress(
        typeof entry === 'string' ? entry : entry?.address || entry?.email || entry?.email_address || entry?.value
      ))
      .filter(isUsableContactEmail)
  ))
}

function contactPhones(contact: RawRecord) {
  const rows = Array.isArray(contact?.phones)
    ? contact.phones
    : Array.isArray(contact?.phone_numbers)
      ? contact.phone_numbers
      : [contact?.phone, contact?.phone_number]
  return Array.from(new Set(
    rows
      .filter((entry) => {
        if (!entry || typeof entry !== 'object') return true
        return entry.do_not_call !== true && entry.dnc !== true && !/do not call|\bdnc\b/i.test(String(entry.status || ''))
      })
      .map((entry) => normalizePhone(
        typeof entry === 'string' ? entry : entry?.number || entry?.phone || entry?.phone_number || entry?.value
      ))
      .filter(Boolean)
  ))
}

function normalizeSearchRecord(raw: RawRecord, plan: RawRecord, observedAt: string): NormalizedLeadInput | null {
  const peopleAnchor = plan.anchor === 'people'
  const property = peopleAnchor ? raw.property || {} : raw
  const contacts = peopleAnchor ? [raw] : Array.isArray(raw.contacts) ? raw.contacts : []
  const contact = contacts.find((row) => contactEmails(row).length || contactPhones(row).length) || contacts[0] || {}
  const emails = contactEmails(contact)
  const phones = contactPhones(contact)
  const propertyId = String(property.dm_property_id || property.property_id || '').trim()
  const personId = String(contact.dm_person_id || contact.person_id || '').trim()
  const propertyAddress = String(property.full_address || property.property_address_full || '').trim()
  if (!propertyId || !propertyAddress) return null

  const candidateOnly = Boolean(plan.candidateOnly)
  const strategyKey = String(plan.key)
  const signals = Array.from(new Set((plan.variant?.signals || []).map((value: unknown) => String(value))))
  const residence = peopleAnchor ? raw.residence || {} : {}
  const ownerName = String(
    contact.full_name ||
      [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
      property.owner_1_full_name ||
      property.owner_2_full_name ||
      ''
  ).trim()
  const mailingAddress = String(residence.full_address || contact.mailing_address || '').trim()
  const equityPercent = numberValue(property.estimated_equity_percentage ?? property.equity_percent)
  const mortgages = numberValue(property.num_mortgages)
  const market = String(plan.market)

  return {
    leadType: 'sell_house',
    source: 'dealmachine_v2_strategy_search',
    sourceUrl: 'https://app.dealmachine.com/',
    category: 'seller_lead',
    externalId: propertyId,
    name: ownerName || null,
    propertyAddress,
    mailingAddress: mailingAddress || null,
    phone: phones[0] || null,
    email: emails[0] || null,
    emailValid: null,
    city: String(property.city || '').trim() || null,
    state: String(property.state || '').trim().toUpperCase() || null,
    zip: String(property.zip || property.zip_code || '').trim() || null,
    painSignal: `Verified DealMachine v2 signals: ${signals.join(', ')}.`,
    status: 'new',
    bestOffer: 'Real Estate Seller Lead',
    niche: candidateOnly ? `dealmachine_v2_${strategyKey}_candidate` : `dealmachine_v2_${strategyKey}`,
    marketSegment: candidateOnly ? `${strategyKey}_candidate` : strategyKey,
    outreachAngle: candidateOnly
      ? `Hold until corroborating evidence is attached: ${plan.candidateReason || 'strategy contract incomplete'}.`
      : `Use the ${plan.label} lane; determine whether cash, seller finance, subject-to, hybrid, or novation best fits the verified facts.`,
    deliveryStatus: 'not_sent',
    importedAt: observedAt,
    contactInfo: {
      source: 'dealmachine_v2_strategy_search',
      ownerName,
      emails,
      phones,
      smsConsent: false,
      smsOutreachAllowed: false,
      phoneUse: 'manual_review_only',
    },
    formData: {
      market,
      estimatedValue: numberValue(property.estimated_value),
      equityAmount: numberValue(property.estimated_equity_amount),
      equityPercent,
      propertyType: labelValue(property.property_type),
      units: numberValue(property.num_units),
      yearBuilt: numberValue(property.year_built),
      mortgages,
      estimatedLoanToValuePercent: numberValue(property.estimated_loan_to_value_percentage),
      totalEstimatedLoanBalance: numberValue(property.total_estimated_loan_balance),
      totalEstimatedLoanPaymentMonthly: numberValue(property.total_estimated_loan_payment_monthly),
      firstMortgageBalance: numberValue(property.mortgage_1_loan_balance),
      firstMortgageInterestRate: numberValue(property.mortgage_1_loan_interest_rate),
      firstMortgagePayment: numberValue(property.mortgage_1_estimated_payment_amount),
      firstMortgageDueDate: labelValue(property.mortgage_1_loan_due_date) || null,
      mlsDaysOnMarket: numberValue(property.mls_days_on_market),
      mlsListingPrice: numberValue(property.mls_current_listing_price),
      marketStatus: labelValue(property.market_status) || null,
      foreclosureAuctionDate: labelValue(property.foreclosure_auction_date) || null,
      foreclosureDefaultDate: labelValue(property.foreclosure_default_date) || null,
      foreclosureStatus: labelValue(property.foreclosure_status || property.property_preforeclosure_status) || null,
      taxDelinquentYear: numberValue(property.tax_delinquent_year),
      activeLiens: numberValue(property.num_total_active_liens),
      lotSizeAcres: numberValue(property.lot_size_acres),
      zoning: labelValue(property.zoning) || null,
      parcelNumber: labelValue(property.parcel_number_raw) || null,
      buildingCondition: labelValue(property.building_condition) || null,
    },
    metadata: {
      sourceAdapter: 'dealmachine_v2_official',
      dealmachinePropertyId: propertyId,
      dealmachinePersonId: personId || null,
      strategy: strategyKey,
      strategyCandidate: candidateOnly ? strategyKey : null,
      strategyCandidateReason: candidateOnly ? plan.candidateReason || null : null,
      strategyPrimary: candidateOnly ? null : strategyKey,
      strategyStackMatches: candidateOnly ? [] : [strategyKey],
      strategySignals: signals,
      strategySourceFamilies: ['dealmachine'],
      strategySourceRecordId: propertyId,
      strategySourceContractVersion: 2,
      sourceObservedAt: observedAt,
      strategyReviewOnly: Boolean(plan.reviewOnly || candidateOnly),
      strategyVariant: plan.variant?.key || null,
      strategySourceFilters: plan.filters,
      strategyMarket: market,
      contactExportNeeded: !emails.length && !phones.length,
      creditMode: 'official_v2_search',
    },
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor
        cursor += 1
        results[index] = await task(items[index])
      }
    })
  )
  return results
}

function estimatedPageCredits(payload: RawRecord) {
  return Math.max(0, Number(payload?.estimated_credits?.this_page || 0))
}

function remainingCredits(payload: RawRecord) {
  const candidates = [
    payload?.remaining,
    payload?.data?.remaining,
    payload?.credits?.remaining,
    payload?.data?.credits?.remaining,
    payload?.property_credits?.remaining,
    payload?.people_credits?.remaining,
  ].map(Number).filter(Number.isFinite)
  return candidates.length ? Math.min(...candidates) : null
}

export async function syncDealMachineLeadSource(options: {
  dryRun?: boolean
  maxPages?: number
  pageSize?: number
  timeoutMs?: number
  startAfter?: number
  maxCredits?: number
  includeLowball?: boolean
  maxLowballShare?: number
} = {}): Promise<DealMachineSyncResult> {
  const key = dealMachineApiKey()
  const startAfter = Math.max(0, Math.floor(options.startAfter || 0))
  if (!hasDealMachineCredentials()) {
    return {
      configured: false,
      ok: false,
      blockedReason: 'DEALMACHINE_API_KEY must contain a full official dm_sk_live_* or dm_at_live_* credential.',
      fetched: 0,
      contactable: 0,
      contactless: 0,
      mailReady: 0,
      queuedForExport: 0,
      ingested: 0,
      startAfter,
      nextAfter: startAfter,
      wrapped: false,
      creditsReserved: 0,
      strategyRuns: [],
      leads: [],
    }
  }

  const client = createDealMachineV2Client({
    apiKey: key,
    maxRetries: 3,
  })
  const pageSize = Math.min(100, Math.max(1, options.pageSize || envInt('DEALMACHINE_SYNC_PAGE_SIZE', 25)))
  const maxPlans = Math.min(17, Math.max(1, options.maxPages || 3))
  const maxCredits = Math.max(1, options.maxCredits || envInt('DEALMACHINE_SYNC_MAX_CREDITS', 75))
  const includeLowball = Boolean(options.includeLowball)
  const maxLowballShare = Math.max(0, Math.min(0.05, Number(options.maxLowballShare ?? 0.05)))
  const plans = buildDailyStrategyPlans({
    includeDisabled: includeLowball,
    includeLowball,
  })
  const selectedPlans = Array.from({ length: Math.min(maxPlans, plans.length) }, (_, offset) =>
    plans[(startAfter + offset) % plans.length]
  )
  const wrapped = startAfter + selectedPlans.length >= plans.length
  const nextAfter = wrapped ? (startAfter + selectedPlans.length) % plans.length : startAfter + selectedPlans.length
  const rawRows: Array<{ raw: RawRecord; plan: RawRecord }> = []
  const blockers: string[] = []
  const strategyRuns: DealMachineSyncResult['strategyRuns'] = []
  let creditsReserved = 0
  const selectedNonLowballCount = selectedPlans.filter((plan) => !plan.lowball).length
  const nonLowballCapacity = selectedNonLowballCount * pageSize
  const lowballPageSize = Math.max(
    1,
    Math.min(pageSize, Math.floor((nonLowballCapacity * maxLowballShare) / Math.max(0.01, 1 - maxLowballShare)))
  )

  try {
    const [, usage, propertyFilters, peopleFilters, propertyFields, peopleFields] = await Promise.all([
      client.account(),
      client.usage(),
      client.listFilters('properties'),
      client.listFilters('people'),
      client.listFields('properties'),
      client.listFields('people'),
    ])
    const filterMetadata = [...propertyFilters, ...peopleFilters]
    const availableFields = new Set([...propertyFields, ...peopleFields].map((row) => String(row.field_id || '')))
    const creditBalance = remainingCredits(usage)

    for (const plan of selectedPlans) {
      const requestedRows = plan.lowball ? lowballPageSize : pageSize
      const strategyRun: DealMachineSyncResult['strategyRuns'][number] = {
        strategyKey: plan.key,
        market: plan.market,
        lowball: Boolean(plan.lowball),
        requestedRows,
        estimatedCredits: 0,
        fetched: 0,
        status: 'planning',
        error: null,
      }
      strategyRuns.push(strategyRun)
      try {
        const hydrated = await hydrateStrategyPlan(client, plan, filterMetadata)
        const fields = DEALMACHINE_STRATEGY_FIELDS.filter((field) => availableFields.has(field))
        hydrated.searchBody.fields = fields
        hydrated.exportBody.fields = fields
        const requestBody = { ...hydrated.searchBody, page: 1, per_page: requestedRows }
        const estimate = await client.estimatePropertySearch(requestBody)
        const cost = estimatedPageCredits(estimate)
        strategyRun.estimatedCredits = cost
        const wouldExceedRunBudget = creditsReserved + cost > maxCredits
        const wouldExceedBalance = creditBalance !== null && creditsReserved + cost > creditBalance
        if (wouldExceedRunBudget || wouldExceedBalance) {
          blockers.push(
            `${plan.key}/${plan.market} skipped: estimated ${cost} credits would exceed ${
              wouldExceedBalance ? 'the reported balance' : `the ${maxCredits}-credit run budget`
            }.`
          )
          strategyRun.status = 'skipped_budget'
          continue
        }
        if (options.dryRun !== false) {
          strategyRun.status = 'estimated'
          continue
        }

        const payload = await client.searchProperties(requestBody)
        creditsReserved += Number(payload?.credits?.used || cost)
        const rows = Array.isArray(payload?.data) ? payload.data : []
        strategyRun.fetched = rows.length
        strategyRun.status = 'searched'
        for (const raw of rows) rawRows.push({ raw, plan: hydrated })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        strategyRun.status = 'failed'
        strategyRun.error = message
        blockers.push(`${plan.key}/${plan.market}: ${message}`)
      }
    }

    const observedAt = new Date().toISOString()
    const normalized = rawRows
      .map(({ raw, plan }) => normalizeSearchRecord(raw, plan, observedAt))
      .filter((lead): lead is NormalizedLeadInput => Boolean(lead))
    const ingested = options.dryRun === false
      ? await mapWithConcurrency(normalized, 6, (lead) => upsertLead(lead))
      : []
    const contactable = normalized.filter((lead) => isUsableContactEmail(lead.email) || Boolean(lead.phone)).length
    const contactless = normalized.length - contactable

    return {
      configured: true,
      ok: blockers.length === 0,
      blockedReason: blockers.length ? blockers.join(' ') : null,
      fetched: normalized.length,
      contactable,
      contactless,
      mailReady: normalized.filter((lead) => !lead.email && !lead.phone && Boolean(lead.mailingAddress)).length,
      queuedForExport: 0,
      ingested: ingested.length,
      startAfter,
      nextAfter,
      wrapped,
      creditsReserved,
      strategyRuns,
      leads: ingested,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      blockedReason: error instanceof Error ? error.message : String(error),
      fetched: 0,
      contactable: 0,
      contactless: 0,
      mailReady: 0,
      queuedForExport: 0,
      ingested: 0,
      startAfter,
      nextAfter: startAfter,
      wrapped: false,
      creditsReserved,
      strategyRuns,
      leads: [],
    }
  }
}
