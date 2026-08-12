import { createHash } from 'node:crypto'

import { upsertLead } from '@/lib/leads/repository'
import type { LeadRecord, NormalizedLeadInput } from '@/lib/leads/types'
import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'

type CsvRow = Record<string, string>

export type DealMachineContactExportResult = {
  rows: number
  withEmail: number
  withPhone: number
  ingested: number
  rejected: number
  leads: LeadRecord[]
  rejectionReasons: Record<string, number>
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export function parseCsvText(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') index += 1
      if (field || row.length) {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      }
    } else {
      field += char
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }

  const headers = (rows[0] || []).map(normalizeHeader)
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, String(values[index] || '').trim()]))
  ) as CsvRow[]
}

function first(row: CsvRow, keys: string[]) {
  for (const key of keys) {
    const value = String(row[normalizeHeader(key)] || '').trim()
    if (value) return value
  }
  return ''
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizePhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits.length === 10 ? digits : ''
}

function splitStructuredValues(value: string) {
  const normalized = String(value || '').trim()
  if (!normalized) return []
  if (normalized.startsWith('[') || normalized.startsWith('{')) {
    try {
      const parsed = JSON.parse(normalized)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      // Some CSV providers serialize multiple values with delimiters instead of JSON.
    }
  }
  return normalized.split(/[;|]/).map((entry) => entry.trim()).filter(Boolean)
}

function structuredValue(entry: unknown, keys: string[]) {
  if (typeof entry === 'string' || typeof entry === 'number') return String(entry).trim()
  if (!entry || typeof entry !== 'object') return ''
  const row = entry as Record<string, unknown>
  for (const key of keys) {
    const value = String(row[key] || '').trim()
    if (value) return value
  }
  return ''
}

function structuredDnc(entry: unknown) {
  if (!entry || typeof entry !== 'object') return false
  const row = entry as Record<string, unknown>
  return row.do_not_call === true || row.dnc === true || /do not call|\bdnc\b|excluded/i.test(
    String(row.status || row.phone_status || '')
  )
}

function phoneIsBlocked(row: CsvRow, index: number) {
  const value = first(row, [
    `phone_${index}_do_not_call`,
    `phone_${index}_dnc`,
    `phone_${index}_status`,
  ])
  const phone = first(row, [`phone_${index}`, `phone${index}`])
  return /do not call|\bdnc\b|excluded/i.test(`${value} ${phone}`)
}

function rowEmails(row: CsvRow) {
  const direct = ['email', 'email_address', 'emails', 'email_addresses']
    .flatMap((key) => splitStructuredValues(first(row, [key])))
    .map((entry) => structuredValue(entry, ['address', 'email', 'email_address', 'value']))
  const numbered = Array.from({ length: 20 }, (_, offset) => offset + 1)
    .map((index) => first(row, [`email_address_${index}`, `email_${index}`, `email${index}`]))
  return unique([...direct, ...numbered].map(normalizeEmailAddress).filter(isUsableContactEmail))
}

function rowPhones(row: CsvRow) {
  const directStatus = first(row, ['do_not_call', 'phone_do_not_call', 'phone_dnc', 'dnc', 'phone_status'])
  const directBlocked = /^(1|true|yes)$/i.test(directStatus) || /do not call|\bdnc\b|excluded/i.test(directStatus)
  const direct = ['phone', 'phone_number', 'phones', 'phone_numbers']
    .flatMap((key) => splitStructuredValues(first(row, [key])))
    .filter((entry) => !directBlocked && !structuredDnc(entry))
    .map((entry) => structuredValue(entry, ['number', 'phone', 'phone_number', 'value']))
  const numbered = Array.from({ length: 20 }, (_, offset) => offset + 1)
    .filter((index) => !phoneIsBlocked(row, index))
    .map((index) => first(row, [`phone_${index}`, `phone${index}`, `phone_number_${index}`]))
  return unique([...direct, ...numbered].map(normalizePhone))
}

function numberValue(value: string) {
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function boolValue(value: string) {
  return /^(1|true|yes|y)$/i.test(String(value || '').trim())
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

function parsePropertyLocation(row: CsvRow, address: string) {
  let city = first(row, ['property_city', 'associated_property_city', 'city'])
  let state = first(row, ['property_state', 'associated_property_state', 'state'])
  let zip = first(row, ['property_zip', 'property_zipcode', 'associated_property_zip', 'zip'])

  if ((!city || !state) && address) {
    const parts = address.split(',').map((part) => part.trim()).filter(Boolean)
    const stateZip = parts.at(-1)?.match(/^([a-z]{2})\s+(\d{5}(?:-\d{4})?)$/i)
    if (!city && parts.length >= 2) city = parts.at(-2) || ''
    if (!state && stateZip) state = stateZip[1]
    if (!zip && stateZip) zip = stateZip[2]
  }

  return {
    city: city ? titleCase(city) : null,
    state: state ? state.toUpperCase() : null,
    zip: zip || null,
  }
}

function marketFromSlug(value: string | null | undefined) {
  const normalized = String(value || '').trim()
  if (!normalized || normalized.includes(',')) return normalized || null
  const match = normalized.match(/^(.+)-([a-z]{2})$/i)
  if (!match) return normalized
  return `${titleCase(match[1].replace(/-/g, ' '))}, ${match[2].toUpperCase()}`
}

function strategySignals(strategyKey: string | null | undefined) {
  const signals: Record<string, string> = {
    'preforeclosure-equity': 'preforeclosure notice of default creative options',
    'tax-code-stack': 'tax delinquent code violation',
    'tax-remote-equity-rotation': 'tax delinquent absentee out of state owner equity',
    'lien-equity': 'active lien equity',
    'probate-vacant-equity': 'probate inherited vacant property equity',
    'portfolio-landlord': 'portfolio landlord multiple properties',
    'small-multifamily-portfolio': 'small multifamily portfolio landlord',
    'builder-infill-teardown': 'builder infill teardown',
    'land-wholesale': 'land vacant lot buildable parcel',
    'vacant-equity': 'vacant property equity',
    'seller-finance-free-clear': 'free and clear seller finance',
    'subject-to-low-equity': 'active mortgage low equity subject-to review',
    'hybrid-equity-bridge': 'active mortgage equity hybrid cash and terms',
    'novation-retail-equity': 'stale retail listing with equity',
    'absentee-equity-creative': 'absentee owner equity creative options',
    'active-stale-creative': 'stale active listing creative finance',
    'active-stale-lowball': 'stale distressed listing conditional cash review',
  }
  return signals[String(strategyKey || '').trim().toLowerCase()] || String(strategyKey || '').trim()
}

function normalizeRow(
  row: CsvRow,
  input: {
    strategyKey?: string | null
    matchedStrategyKeys?: string[]
    strategySignals?: string[]
    candidateOnly?: boolean
    candidateReason?: string | null
    reviewOnly?: boolean
    strategyVariant?: string | null
    sourceObservedAt?: string | null
    sourceFilters?: unknown[]
    market?: string | null
    listId?: string | null
    exportId?: string | null
  }
): { lead: NormalizedLeadInput | null; hasEmail: boolean; hasPhone: boolean; reason: string | null } {
  const address = first(row, [
    'associated_property_address_full',
    'property_address_full',
    'full_address',
    'property_address',
  ])
  if (!address) return { lead: null, hasEmail: false, hasPhone: false, reason: 'missing_property_address' }

  const emails = rowEmails(row)
  const phones = rowPhones(row)
  if (!emails.length && !phones.length) {
    return { lead: null, hasEmail: false, hasPhone: false, reason: 'missing_usable_contact' }
  }

  const firstName = first(row, ['first_name', 'owner_first_name'])
  const lastName = first(row, ['last_name', 'owner_last_name'])
  const ownerName = first(row, ['contact_full_name', 'full_name', 'owner_name', 'likely_owner']) ||
    [firstName, lastName].filter(Boolean).join(' ')
  const location = parsePropertyLocation(row, address)
  const market = marketFromSlug(input.market) ||
    ([location.city, location.state].filter(Boolean).join(', ') || null)
  const mailingAddress = [
    first(row, ['primary_mailing_address', 'mailing_address']),
    first(row, ['primary_mailing_city', 'mailing_city']),
    first(row, ['primary_mailing_state', 'mailing_state']),
    first(row, ['primary_mailing_zip', 'mailing_zip']),
  ].filter(Boolean).join(', ')
  const propertyId = first(row, ['dm_property_id', 'property_id', 'associated_property_id'])
  const personId = first(row, ['dm_person_id', 'person_id', 'contact_id'])
  const contactId = personId || first(row, ['lead_id', 'dealmachine_id'])
  const strategyKey = String(input.strategyKey || '').trim().toLowerCase() || null
  const signal = strategySignals(strategyKey)
  const externalId = propertyId || contactId || createHash('sha256')
    .update(`${address.toLowerCase()}|${emails[0] || phones[0] || ownerName.toLowerCase()}`)
    .digest('hex')
  const sourceObservedAt = String(input.sourceObservedAt || '').trim() || new Date().toISOString()
  const matchedStrategyKeys = Array.from(new Set(
    (input.matchedStrategyKeys?.length ? input.matchedStrategyKeys : strategyKey ? [strategyKey] : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ))
  const verifiedSignals = Array.from(new Set(
    (input.strategySignals || []).map((value) => String(value || '').trim()).filter(Boolean)
  ))
  const candidateOnly = Boolean(input.candidateOnly)
  const propertyFacts = {
    estimatedValue: numberValue(first(row, ['estimated_value'])),
    equityAmount: numberValue(first(row, ['estimated_equity_amount', 'equity_amount'])),
    equityPercent: numberValue(first(row, ['estimated_equity_percentage', 'equity_percent'])),
    propertyType: first(row, ['property_type']),
    units: numberValue(first(row, ['num_units', 'units_count'])),
    mortgages: numberValue(first(row, ['num_mortgages'])),
    estimatedLoanToValuePercent: numberValue(first(row, ['estimated_loan_to_value_percentage'])),
    firstMortgageBalance: numberValue(first(row, ['mortgage_1_loan_balance'])),
    firstMortgageInterestRate: numberValue(first(row, ['mortgage_1_loan_interest_rate'])),
    firstMortgagePayment: numberValue(first(row, ['mortgage_1_estimated_payment_amount'])),
    mlsDaysOnMarket: numberValue(first(row, ['mls_days_on_market'])),
    mlsListingPrice: numberValue(first(row, ['mls_current_listing_price'])),
    foreclosureAuctionDate: first(row, ['foreclosure_auction_date']) || null,
    foreclosureDefaultDate: first(row, ['foreclosure_default_date']) || null,
    foreclosureStatus: first(row, ['foreclosure_status', 'property_preforeclosure_status']) || null,
    taxDelinquentYear: numberValue(first(row, ['tax_delinquent_year'])),
    activeLiens: numberValue(first(row, ['num_total_active_liens'])),
    lotSizeAcres: numberValue(first(row, ['lot_size_acres'])),
    buildingCondition: first(row, ['building_condition']) || null,
    ownerOccupied: boolValue(first(row, ['is_owner_occupied'])),
  }

  return {
    hasEmail: emails.length > 0,
    hasPhone: phones.length > 0,
    reason: null,
    lead: {
      leadType: 'sell_house',
      source: 'dealmachine_v2_strategy_export',
      sourceUrl: 'https://app.dealmachine.com/',
      category: 'seller_lead',
      externalId,
      name: ownerName || null,
      propertyAddress: address,
      mailingAddress: mailingAddress || null,
      phone: phones[0] || null,
      email: emails[0] || null,
      emailValid: null,
      city: location.city,
      state: location.state,
      zip: location.zip,
      painSignal: signal
        ? `DealMachine strategy list signal: ${signal}.`
        : 'DealMachine owner contact export; strategy qualification required.',
      status: 'new',
      bestOffer: 'Real Estate Seller Lead',
      niche: strategyKey ? `dealmachine_v2_${strategyKey}` : 'dealmachine_v2_contacts_export',
      marketSegment: candidateOnly ? `${strategyKey || 'seller'}_candidate` : strategyKey || 'seller_lead',
      outreachAngle: candidateOnly
        ? `Hold for corroborating source evidence: ${input.candidateReason || 'strategy contract incomplete'}.`
        : strategyKey ? `Use the ${strategyKey} strategy lane.` : 'Qualify before outreach.',
      deliveryStatus: 'not_sent',
      importedAt: new Date().toISOString(),
      contactInfo: {
        source: 'dealmachine_v2_strategy_export',
        emails,
        phones,
        smsConsent: false,
        smsOutreachAllowed: false,
        phoneUse: 'manual_review_only',
      },
      formData: {
        market,
        dealMachineListId: input.listId || null,
        dealMachineExportId: input.exportId || null,
        ...propertyFacts,
      },
      metadata: {
        sourceAdapter: 'dealmachine_v2_official',
        dealmachinePropertyId: propertyId || null,
        dealmachinePersonId: personId || null,
        dealmachineContactId: contactId || null,
        dealMachineListId: input.listId || null,
        dealMachineExportId: input.exportId || null,
        strategy: strategyKey,
        strategyCandidate: candidateOnly ? strategyKey : null,
        strategyCandidateReason: candidateOnly ? input.candidateReason || null : null,
        strategyPrimary: candidateOnly ? null : strategyKey,
        strategyStackMatches: candidateOnly ? [] : matchedStrategyKeys,
        strategySignals: verifiedSignals,
        strategySourceFamilies: ['dealmachine'],
        strategySourceRecordId: propertyId || contactId || externalId,
        strategySourceContractVersion: 2,
        sourceObservedAt,
        strategyReviewOnly: Boolean(input.reviewOnly || candidateOnly),
        strategyVariant: input.strategyVariant || null,
        strategySourceFilters: input.sourceFilters || [],
        strategyReason: verifiedSignals.join(' | ') || signal || null,
        market,
        contactFlags: first(row, ['contact_flags']) || null,
        smsConsent: false,
      },
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

export async function ingestDealMachineContactsCsv(input: {
  csvContent: string
  strategyKey?: string | null
  matchedStrategyKeys?: string[]
  strategySignals?: string[]
  candidateOnly?: boolean
  candidateReason?: string | null
  reviewOnly?: boolean
  strategyVariant?: string | null
  sourceObservedAt?: string | null
  sourceFilters?: unknown[]
  market?: string | null
  listId?: string | null
  exportId?: string | null
  dryRun?: boolean
}): Promise<DealMachineContactExportResult> {
  const rows = parseCsvText(input.csvContent)
  const rejectionReasons: Record<string, number> = {}
  const normalized = rows.map((row) => normalizeRow(row, input))
  for (const item of normalized) {
    if (!item.reason) continue
    rejectionReasons[item.reason] = (rejectionReasons[item.reason] || 0) + 1
  }
  const accepted = normalized.filter((item): item is typeof item & { lead: NormalizedLeadInput } => Boolean(item.lead))
  const leads = input.dryRun
    ? []
    : await mapWithConcurrency(accepted, 8, (item) => upsertLead(item.lead))

  return {
    rows: rows.length,
    withEmail: accepted.filter((item) => item.hasEmail).length,
    withPhone: accepted.filter((item) => item.hasPhone).length,
    ingested: leads.length,
    rejected: rows.length - accepted.length,
    leads,
    rejectionReasons,
  }
}
