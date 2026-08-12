import type { PropertyBuyerMatchInput } from '@/lib/buyers/types'
import type { LeadRecord } from '@/lib/leads/types'

const SELLER_STATUSES = new Set(['interested', 'qualified'])
const LEGAL_SENSITIVITY = /\b(bankrupt(?:cy)?|probate|deceased|estate of|guardianship|minor owner|litigation|lis pendens)\b/i

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parsed = Number(value.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value
  return ['1', 'true', 'yes', 'y', 'on'].includes(textValue(value).toLowerCase())
}

function firstValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

function timelineDays(value: unknown) {
  const text = textValue(value).toLowerCase()
  if (!text) return null
  const numeric = numberValue(value)
  if (numeric) return numeric
  if (/asap|immediate|urgent/.test(text)) return 7
  if (/30\s*-\s*60/.test(text)) return 45
  if (/60\s*-\s*90/.test(text)) return 75
  if (/90\+|more than 90/.test(text)) return 120
  if (/30/.test(text)) return 30
  return null
}

function distressLevel(value: unknown) {
  const text = textValue(value).toLowerCase()
  if (/severe|fire|uninhabitable|condemn|demolition/.test(text)) return 9
  if (/poor|distress|major|vacant|boarded/.test(text)) return 8
  if (/fair|moderate|repair/.test(text)) return 6
  return text ? 4 : null
}

function sellerSignal(lead: LeadRecord) {
  return [lead.lead_type, lead.category, lead.market_segment, lead.source, lead.best_offer]
    .map((value) => String(value || '').toLowerCase())
    .some((value) => /sell_house|seller|real estate|property|dealmachine|preforeclosure|landlord|vacant|tax|probate/.test(value))
}

function combinedLeadText(lead: LeadRecord) {
  return [
    lead.notes,
    lead.pain_signal,
    lead.status_detail,
    JSON.stringify(lead.form_data || {}),
    JSON.stringify(lead.metadata_json || {}),
  ].filter(Boolean).join(' ')
}

export function evaluateQualifiedSellerRouting(lead: LeadRecord) {
  if (!SELLER_STATUSES.has(String(lead.status || '').toLowerCase())) {
    return { eligible: false, reason: 'seller_not_interested_or_qualified', legalSensitivity: false }
  }
  if (!lead.property_address) {
    return { eligible: false, reason: 'missing_property_address', legalSensitivity: false }
  }
  if (!lead.state) {
    return { eligible: false, reason: 'missing_property_state', legalSensitivity: false }
  }
  if (!sellerSignal(lead)) {
    return { eligible: false, reason: 'not_a_seller_property_lead', legalSensitivity: false }
  }
  const legalSensitivity = LEGAL_SENSITIVITY.test(combinedLeadText(lead))
  return { eligible: true, reason: legalSensitivity ? 'legal_sensitivity_review' : 'eligible', legalSensitivity }
}

export function buildPropertyBuyerMatchInputFromLead(lead: LeadRecord): PropertyBuyerMatchInput {
  const form = (lead.form_data || {}) as Record<string, unknown>
  const metadata = (lead.metadata_json || {}) as Record<string, unknown>
  const condition = firstValue(form, ['propertyCondition', 'property_condition', 'condition'])
  const timeline = firstValue(form, ['timelineToSell', 'timeline_to_sell', 'timelineDays', 'timeline_days'])
  const preferredPath = textValue(firstValue(form, ['preferredSalePath', 'preferred_sale_path']))
  const context = combinedLeadText(lead)

  return {
    leadId: lead.id,
    serviceType: lead.lead_type || 'seller_property',
    propertyAddress: lead.property_address,
    city: lead.city,
    state: lead.state,
    zipCode: lead.zip,
    assetType: textValue(firstValue(form, ['propertyType', 'property_type', 'assetType', 'asset_type'])) || null,
    occupancy: textValue(firstValue(form, ['occupancyStatus', 'occupancy_status', 'occupancy'])) || null,
    distressLevel: numberValue(firstValue(metadata, ['distressLevel', 'distress_level'])) ?? distressLevel(condition),
    codeViolationLevel: numberValue(firstValue(metadata, ['codeViolationLevel', 'code_violation_level'])),
    rehabLevel: numberValue(firstValue(metadata, ['rehabLevel', 'rehab_level'])) ?? distressLevel(condition),
    askingPrice: numberValue(firstValue(form, ['askingPrice', 'asking_price', 'sellerAsk', 'seller_ask'])),
    estimatedValue: numberValue(firstValue(form, ['estimatedValue', 'estimated_value', 'arv', 'value'])),
    landlordSignal:
      booleanValue(firstValue(metadata, ['landlordSignal', 'landlord_signal'])) ||
      /tenant|rental|landlord/i.test(context),
    absenteeOwner:
      booleanValue(firstValue(metadata, ['absenteeOwner', 'absentee_owner'])) ||
      lead.mailing_matches_property === false,
    sellerMotivation: lead.pain_signal || lead.notes || null,
    timelineDays: timelineDays(timeline),
    creativeFinanceOpen:
      /creative|subject.?to|seller.?financ|hybrid/i.test(`${preferredPath} ${context}`),
    languagePreference: /spanish|espa[nñ]ol/i.test(context) ? 'es' : 'en',
    marketTag: [lead.city, lead.state].filter(Boolean).join(', ') || lead.state,
  }
}
