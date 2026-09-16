import 'server-only'

import { upsertLead } from '@/lib/leads/repository'
import type { LeadRecord, NormalizedLeadInput } from '@/lib/leads/types'
import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import {
  createDealMachineV2Client,
  dealMachineApiKey,
  formatDealMachineThrownError,
  hasDealMachineCredentials,
} from '@/lib/dealmachine/v2-client.mjs'
import {
  DEALMACHINE_STRATEGY_FIELDS,
  buildDailyStrategyPlans,
  hydrateStrategyPlan,
  mergeDealMachineCatalogMetadata,
} from '@/lib/dealmachine/v2-strategy-catalog.mjs'
import {
  addDealMachineCreditBreakdowns,
  advanceDealMachineCursor,
  dealMachineContactRevealLimit,
  decideDealMachineSearchBudget,
  emptyDealMachineCreditBreakdown,
  readDealMachineCreditBreakdown,
  type DealMachineCreditBreakdown,
} from '@/lib/dealmachine/budget'
import {
  extractDealMachinePhoneRecords,
  usableDealMachinePhoneRecords,
} from '@/lib/dealmachine/phoneEvidence'

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
  creditUsage: DealMachineCreditBreakdown & {
    discovery: DealMachineCreditBreakdown
    contactEnrichment: DealMachineCreditBreakdown
  }
  contactEnriched: number
  strategyRuns: Array<{
    strategyKey: string
    market: string
    lowball: boolean
    requestedRows: number
    estimatedCredits: number
    discoveryEstimatedCredits: number
    contactEstimatedCredits: number
    creditUsage: DealMachineCreditBreakdown
    fetched: number
    contactEnriched: number
    contactStatus: 'not_requested' | 'skipped_candidate' | 'skipped_budget' | 'enriched' | 'failed'
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
  return usableDealMachinePhoneRecords(extractDealMachinePhoneRecords(contact)).map((record) => record.number)
}

function normalizeSearchRecord(raw: RawRecord, plan: RawRecord, observedAt: string): NormalizedLeadInput | null {
  const peopleAnchor = plan.anchor === 'people'
  const property = peopleAnchor
    ? raw.property || (Array.isArray(raw.properties) ? raw.properties[0] : null) || {}
    : raw
  const contacts = peopleAnchor ? [raw] : Array.isArray(raw.contacts) ? raw.contacts : []
  const contact = contacts.find((row) => contactEmails(row).length || contactPhones(row).length) || contacts[0] || {}
  const emails = contactEmails(contact)
  const phoneRecords = extractDealMachinePhoneRecords(contact)
  const usablePhoneRecords = usableDealMachinePhoneRecords(phoneRecords)
  const phones = usablePhoneRecords.map((record) => record.number)
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
      phoneRecords,
      dncClearPhones: usablePhoneRecords
        .filter((record) => record.doNotCall === false)
        .map((record) => record.number),
      mobilePhones: usablePhoneRecords
        .filter((record) => record.type === 'mobile')
        .map((record) => record.number),
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
    payload?.total_available,
    payload?.data?.total_available,
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
  contactRowsPerStrategy?: number
  contactCreditReservationPerProperty?: number
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
      creditUsage: {
        ...emptyDealMachineCreditBreakdown(),
        discovery: emptyDealMachineCreditBreakdown(),
        contactEnrichment: emptyDealMachineCreditBreakdown(),
      },
      contactEnriched: 0,
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
  const contactRowsPerStrategy = Math.min(
    pageSize,
    Math.max(0, Math.floor(options.contactRowsPerStrategy ?? envInt('DEALMACHINE_CONTACT_REVEAL_ROWS_PER_STRATEGY', 3)))
  )
  const contactCreditReservationPerProperty = Math.min(
    10,
    Math.max(
      2,
      Math.floor(
        options.contactCreditReservationPerProperty ??
          envInt('DEALMACHINE_CONTACT_CREDIT_RESERVATION_PER_PROPERTY', 3)
      )
    )
  )
  const includeLowball = Boolean(options.includeLowball)
  const maxLowballShare = Math.max(0, Math.min(0.05, Number(options.maxLowballShare ?? 0.05)))
  const plans = buildDailyStrategyPlans({
    includeDisabled: includeLowball,
    includeLowball,
  })
  const selectedPlans = Array.from({ length: Math.min(maxPlans, plans.length) }, (_, offset) =>
    plans[(startAfter + offset) % plans.length]
  )
  let advancedPlanCount = 0
  const rawRows: Array<{ raw: RawRecord; plan: RawRecord }> = []
  const blockers: string[] = []
  const strategyRuns: DealMachineSyncResult['strategyRuns'] = []
  let creditsReserved = 0
  let discoveryCredits = emptyDealMachineCreditBreakdown()
  let contactEnrichmentCredits = emptyDealMachineCreditBreakdown()
  let contactEnriched = 0
  const selectedNonLowballCount = selectedPlans.filter((plan) => !plan.lowball).length
  const nonLowballCapacity = selectedNonLowballCount * pageSize
  const lowballPageSize = Math.max(
    1,
    Math.min(pageSize, Math.floor((nonLowballCapacity * maxLowballShare) / Math.max(0.01, 1 - maxLowballShare)))
  )

  try {
    const [, usage, propertyFilters, peopleFilters, propertyFields] = await Promise.all([
      client.account(),
      client.usage(),
      client.listFilters('properties'),
      client.listFilters('people'),
      client.listFields('properties'),
    ])
    const filterMetadata = mergeDealMachineCatalogMetadata(propertyFilters, peopleFilters)
    const availablePropertyFields = new Set(propertyFields.map((row) => String(row.field_id || '')))
    const creditBalance = remainingCredits(usage)

    for (const plan of selectedPlans) {
      const requestedRows = plan.lowball ? lowballPageSize : pageSize
      const strategyRun: DealMachineSyncResult['strategyRuns'][number] = {
        strategyKey: plan.key,
        market: plan.market,
        lowball: Boolean(plan.lowball),
        requestedRows,
        estimatedCredits: 0,
        discoveryEstimatedCredits: 0,
        contactEstimatedCredits: 0,
        creditUsage: emptyDealMachineCreditBreakdown(),
        fetched: 0,
        contactEnriched: 0,
        contactStatus: plan.candidateOnly ? 'skipped_candidate' : 'not_requested',
        status: 'planning',
        error: null,
      }
      strategyRuns.push(strategyRun)
      try {
        const hydrated = await hydrateStrategyPlan(client, plan, filterMetadata)
        const fields = DEALMACHINE_STRATEGY_FIELDS.filter((field) => availablePropertyFields.has(field))
        hydrated.searchBody.fields = fields
        hydrated.exportBody.fields = fields
        if (hydrated.searchSourceType !== 'properties') {
          strategyRun.status = 'failed'
          strategyRun.error = 'Autonomous discovery requires a property-anchored, contact-free DealMachine query.'
          blockers.push(`${plan.key}/${plan.market}: ${strategyRun.error}`)
          advancedPlanCount += 1
          continue
        }
        const requestBody = { ...hydrated.searchBody, page: 1, per_page: requestedRows }
        const estimate = await client.estimateRecordSearch(hydrated.searchSourceType, requestBody)
        const cost = estimatedPageCredits(estimate)
        strategyRun.estimatedCredits = cost
        strategyRun.discoveryEstimatedCredits = cost
        const budgetDecision = decideDealMachineSearchBudget({
          estimatedCost: cost,
          creditsReserved,
          maxCredits,
          creditBalance,
        })
        if (budgetDecision === 'block_balance') {
          strategyRun.status = 'skipped_budget'
          blockers.push(
            `${plan.key}/${plan.market} requires an estimated ${cost} credits, but the reported DealMachine balance cannot cover this run.`
          )
          break
        }
        if (budgetDecision === 'defer_run_cap') {
          strategyRun.status = 'skipped_budget'
          // Preserve the first unrun strategy as the next cursor. Reaching the
          // per-run ceiling after useful work is a normal deferral, not a
          // provider failure.
          break
        }
        if (budgetDecision === 'block_run_cap') {
          strategyRun.status = 'skipped_budget'
          // A first plan that can never fit the configured cap is advanced and
          // reported as a blocker so it cannot deadlock the rotation.
          blockers.push(
            `${plan.key}/${plan.market} requires an estimated ${cost} credits, above the ${maxCredits}-credit run budget.`
          )
          advancedPlanCount += 1
          continue
        }
        if (options.dryRun !== false) {
          strategyRun.status = 'estimated'
          advancedPlanCount += 1
          continue
        }

        const payload = await client.searchRecords(hydrated.searchSourceType, requestBody)
        const discoveryUsage = readDealMachineCreditBreakdown(payload, cost)
        creditsReserved += discoveryUsage.used
        discoveryCredits = addDealMachineCreditBreakdowns(discoveryCredits, discoveryUsage)
        strategyRun.creditUsage = addDealMachineCreditBreakdowns(strategyRun.creditUsage, discoveryUsage)
        const rows = Array.isArray(payload?.data) ? payload.data : []
        strategyRun.fetched = rows.length
        strategyRun.status = 'searched'
        const enrichedByPropertyId = new Map<string, RawRecord>()
        const revealRows = dealMachineContactRevealLimit({
          requestedRows: rows.length,
          configuredRows: contactRowsPerStrategy,
          candidateOnly: Boolean(plan.candidateOnly),
          sourceType: hydrated.searchSourceType,
        })
        if (revealRows > 0) {
          try {
            for (const raw of rows.slice(0, revealRows)) {
              const propertyId = String(raw?.dm_property_id || raw?.property_id || '').trim()
              if (!propertyId) continue
              const contactCost = contactCreditReservationPerProperty
              const contactBudgetDecision = decideDealMachineSearchBudget({
                estimatedCost: contactCost,
                creditsReserved,
                maxCredits,
                creditBalance,
              })
              if (contactBudgetDecision !== 'search') {
                strategyRun.contactStatus = 'skipped_budget'
                break
              }
              strategyRun.contactEstimatedCredits += contactCost
              strategyRun.estimatedCredits += contactCost
              const contactPayload = await client.getProperty(propertyId, {
                contact_audience: 'owners',
              })
              const contactUsage = readDealMachineCreditBreakdown(contactPayload, contactCost)
              creditsReserved += contactUsage.used
              contactEnrichmentCredits = addDealMachineCreditBreakdowns(contactEnrichmentCredits, contactUsage)
              strategyRun.creditUsage = addDealMachineCreditBreakdowns(strategyRun.creditUsage, contactUsage)
              const enriched = contactPayload?.data && typeof contactPayload.data === 'object'
                ? contactPayload.data as RawRecord
                : null
              const returnedPropertyId = String(enriched?.dm_property_id || enriched?.property_id || '').trim()
              if (enriched && returnedPropertyId === propertyId) {
                enrichedByPropertyId.set(propertyId, enriched)
              }
              strategyRun.contactStatus = 'enriched'
            }
            strategyRun.contactEnriched = enrichedByPropertyId.size
            contactEnriched += enrichedByPropertyId.size
          } catch (error) {
            const message = formatDealMachineThrownError(error)
            strategyRun.contactStatus = 'failed'
            strategyRun.error = `Contact enrichment failed: ${message}`
            blockers.push(`${plan.key}/${plan.market} contact enrichment: ${message}`)
          }
        }
        for (const raw of rows) {
          const propertyId = String(raw?.dm_property_id || raw?.property_id || '').trim()
          const enriched = enrichedByPropertyId.get(propertyId)
          rawRows.push({
            raw: enriched ? { ...raw, ...enriched, contacts: enriched.contacts } : raw,
            plan: hydrated,
          })
        }
        advancedPlanCount += 1
      } catch (error) {
        const message = formatDealMachineThrownError(error)
        strategyRun.status = 'failed'
        strategyRun.error = message
        blockers.push(`${plan.key}/${plan.market}: ${message}`)
        advancedPlanCount += 1
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

    const { nextAfter, wrapped } = advanceDealMachineCursor({
      startAfter,
      advancedPlanCount,
      planCount: plans.length,
    })

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
      creditUsage: {
        ...addDealMachineCreditBreakdowns(discoveryCredits, contactEnrichmentCredits),
        discovery: discoveryCredits,
        contactEnrichment: contactEnrichmentCredits,
      },
      contactEnriched,
      strategyRuns,
      leads: ingested,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      blockedReason: formatDealMachineThrownError(error),
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
      creditUsage: {
        ...addDealMachineCreditBreakdowns(discoveryCredits, contactEnrichmentCredits),
        discovery: discoveryCredits,
        contactEnrichment: contactEnrichmentCredits,
      },
      contactEnriched,
      strategyRuns,
      leads: [],
    }
  }
}
