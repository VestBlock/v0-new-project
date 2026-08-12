import { normalizePropertyRow } from '@/lib/property-intelligence/import'
import type { PropertyProviderResult } from '@/lib/property-intelligence/adapters'

export function isDealMachineConfigured() {
  return Boolean(process.env.DEALMACHINE_API_KEY)
}

export function mapDealMachineLead(raw: Record<string, unknown>): PropertyProviderResult {
  const row = {
    parcel_id: raw.parcel_id || raw.property_id || raw.id,
    property_address: raw.property_address || raw.address || raw.propertyAddress,
    city: raw.city || raw.property_city,
    state: raw.state || raw.property_state,
    zip: raw.zip || raw.zip_code || raw.postal_code,
    owner_name: raw.owner_name || raw.owner || raw.ownerName,
    mailing_address: raw.mailing_address || raw.owner_mailing_address,
    mailing_city: raw.mailing_city,
    mailing_state: raw.mailing_state,
    mailing_zip: raw.mailing_zip,
    phone: raw.phone || raw.phone_number,
    email: raw.email,
    tags: raw.tags || raw.list_name || raw.campaign,
    notes: raw.notes,
    lead_status: raw.lead_status || raw.status,
    last_updated: raw.updated_at || raw.last_updated,
    latitude: raw.latitude,
    longitude: raw.longitude,
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

export async function fetchDealMachineLeads() {
  if (!isDealMachineConfigured()) {
    return { configured: false, leads: [], error: 'DEALMACHINE_API_KEY is not configured.' }
  }

  return {
    configured: true,
    leads: [] as PropertyProviderResult[],
    error: 'Live DealMachine API sync is adapter-ready but disabled until the endpoint contract is confirmed and DEALMACHINE_SYNC_ENABLED=true.',
  }
}
