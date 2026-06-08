import { normalizeEmail, normalizeKey, normalizePhone, normalizeText, websiteHost } from './utils.mjs'

function identityKeys(lead) {
  const keys = []
  const email = normalizeEmail(lead.email)
  const host = websiteHost(lead.website)
  const phone = normalizePhone(lead.phone)
  const business = normalizeKey(lead.businessName)
  const city = normalizeKey(lead.city)
  const state = normalizeKey(lead.state)
  const property = normalizeKey(lead.propertyAddress)
  const parcel = normalizeKey(lead.parcelId || lead.apn || lead.metadata?.parcelId)
  const sourceUrl = normalizeText(lead.sourceUrl || lead.metadata?.sourceUrl)

  if (email) keys.push(`email:${email}`)
  if (host) keys.push(`domain:${host}`)
  if (phone) keys.push(`phone:${phone}`)
  if (business && city && state) keys.push(`business_place:${business}:${city}:${state}`)
  if (property) keys.push(`property:${property}`)
  if (parcel) keys.push(`parcel:${parcel}`)
  if (sourceUrl) keys.push(`source_url:${sourceUrl.toLowerCase()}`)

  return keys.length ? keys : [`fallback:${lead.source}:${city}:${state}:${normalizeKey(lead.id)}`]
}

function quarantineReason(lead, score) {
  if (lead.vertical === 'distressed_house' && lead.homeownerContact) {
    return {
      reason: 'manual_only_distressed_property',
      detail: 'Homeowner/property records are review/export only and blocked from automatic sending.',
      recommendedNextStep: 'Review manually for legality, source reliability, and partner/buyer fit before any contact.',
    }
  }
  if (score.status === 'blocked') {
    return {
      reason: score.blockReason || 'blocked_by_v4_quality_gate',
      detail: score.reasons.join('; '),
      recommendedNextStep: score.blockReason === 'missing_email'
        ? 'Export for offline research or contact-form review; do not hold active send capacity.'
        : 'Research or suppress before returning to automation.',
    }
  }
  return null
}

export function dedupeAndQuarantineV4(scoredLeads) {
  const seen = new Map()
  const accepted = []
  const quarantined = []
  const duplicates = []

  for (const row of scoredLeads) {
    const keys = identityKeys(row.lead)
    const duplicateKey = keys.find((key) => seen.has(key))
    if (duplicateKey) {
      const original = seen.get(duplicateKey)
      const duplicate = {
        ...row,
        quarantine: {
          reason: 'duplicate_identity',
          detail: `Matched ${duplicateKey} from ${original.lead.id}`,
          recommendedNextStep: 'Keep out of send queue; review only if the original record is stale or wrong.',
        },
      }
      duplicates.push(duplicate)
      quarantined.push(duplicate)
      continue
    }

    for (const key of keys) seen.set(key, row)

    const quarantine = quarantineReason(row.lead, row.score)
    if (quarantine) {
      quarantined.push({ ...row, quarantine })
      continue
    }

    accepted.push(row)
  }

  return {
    accepted,
    quarantined,
    duplicates,
    identityCount: seen.size,
  }
}

