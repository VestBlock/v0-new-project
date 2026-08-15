import { normalizePropertyRow } from '@/lib/property-intelligence/import'
import type { PropertyProviderResult } from '@/lib/property-intelligence/adapters'
import {
  getDealMachineConnectionHealth,
  hasDealMachineCredentials,
} from '@/lib/dealmachine/v2-client.mjs'

export function isDealMachineConfigured() {
  return hasDealMachineCredentials()
}

export function mapDealMachineLead(raw: Record<string, unknown>): PropertyProviderResult {
  const property = raw.property && typeof raw.property === 'object'
    ? raw.property as Record<string, unknown>
    : raw
  const residence = raw.residence && typeof raw.residence === 'object'
    ? raw.residence as Record<string, unknown>
    : {}
  const phones = Array.isArray(raw.phones) ? raw.phones : []
  const emails = Array.isArray(raw.emails) ? raw.emails : []
  const allowedPhone = phones.find((entry) =>
    entry &&
    typeof entry === 'object' &&
    (entry as Record<string, unknown>).do_not_call !== true
  ) as Record<string, unknown> | undefined
  const primaryEmail = emails.find((entry) => entry && typeof entry === 'object') as
    | Record<string, unknown>
    | undefined
  const row = {
    parcel_id: property.dm_property_id || property.parcel_id || property.property_id || property.id,
    property_address: property.full_address || property.property_address || property.address,
    city: property.city || property.property_city,
    state: property.state || property.property_state,
    zip: property.zip || property.zip_code || property.postal_code,
    owner_name: raw.full_name || raw.owner_name || raw.owner,
    mailing_address: residence.full_address || raw.mailing_address,
    mailing_city: residence.city || raw.mailing_city,
    mailing_state: residence.state || raw.mailing_state,
    mailing_zip: residence.zip || raw.mailing_zip,
    phone: allowedPhone?.number || raw.phone || raw.phone_number,
    email: primaryEmail?.address || raw.email,
    tags: raw.tags || raw.list_name || raw.campaign,
    notes: raw.notes,
    lead_status: raw.lead_status || raw.status,
    last_updated: raw.updated_at || raw.last_updated || property.updated_at,
    latitude: property.latitude,
    longitude: property.longitude,
  }

  return {
    providerKey: 'dealmachine',
    sourceType: 'licensed_provider',
    complianceStatus: 'licensed',
    confidenceScore: 80,
    rawPayload: raw,
    normalized: normalizePropertyRow(row, {
      sourceName: 'DealMachine',
      sourceUrl: 'dealmachine-api',
      confidenceLevel: 80,
    }),
  }
}

export async function fetchDealMachineLeads(options: { verify?: boolean } = {}) {
  const health = await getDealMachineConnectionHealth({ verify: options.verify === true })
  return {
    configured: health.configured,
    health,
    leads: [] as PropertyProviderResult[],
    error: health.state === 'working'
      ? 'Use the authenticated admin sync route for cost-estimated, paginated ingestion.'
      : health.message,
  }
}
