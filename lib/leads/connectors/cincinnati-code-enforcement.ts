import type { NormalizedLeadInput } from '@/lib/leads/types'

type SearchCincinnatiCodeViolationsInput = {
  limit: number
  daysBack: number
}

export async function searchCincinnatiCodeViolations(
  input: SearchCincinnatiCodeViolationsInput
) {
  const since = new Date(Date.now() - input.daysBack * 24 * 60 * 60 * 1000)
  const sinceString = `${since.toISOString().slice(0, 10)}T00:00:00.000`
  const where = encodeURIComponent(
    `city_id='CINC' AND entered_date >= '${sinceString}'`
  )
  const url = `https://data.cincinnati-oh.gov/resource/cncm-znd6.json?$limit=${input.limit}&$where=${where}&$order=entered_date DESC`
  const response = await fetch(url, {
    headers: { 'user-agent': 'VestBlock Lead Intelligence/1.0 (+https://www.vestblock.io)' },
  })

  if (!response.ok) {
    throw new Error(`Cincinnati code violation search failed with ${response.status}.`)
  }

  const rows = (await response.json()) as Array<Record<string, string>>

  return rows.map<NormalizedLeadInput>((row) => ({
    leadType: 'code_violation',
    source: 'cincinnati_code_enforcement',
    sourceUrl: row.url || 'https://data.cincinnati-oh.gov',
    category: 'code_violation',
    externalId: row.number_key,
    propertyAddress: row.full_address || null,
    city: 'Cincinnati',
    state: 'OH',
    zip: null,
    languageSignal: 'english',
    painSignal: `${row.comp_type_desc || row.work_type || 'Code violation'}; status: ${row.data_status_display || row.status_class || 'Unknown'}; possible seller motivation or landlord distress signal`,
    bestOffer: 'Real Estate Seller Lead',
    marketSegment: 'distressed_property',
    outreachAngle: 'Property compliance pressure and direct-sale options',
    status: 'new',
    contactInfo: {
      agency: row.display_agency || null,
    },
    formData: {
      violationType: row.comp_type_desc || null,
      subtype: row.sub_type_desc || null,
      enteredDate: row.entered_date || null,
      statusDisplay: row.data_status_display || null,
      neighborhood: row.neighborhood || null,
    },
    metadata: {
      numberKey: row.number_key,
      workType: row.work_type,
      subtype: row.sub_type,
      subtypeDescription: row.sub_type_desc,
      enteredDate: row.entered_date,
      statusClass: row.status_class,
      statusDisplay: row.data_status_display,
      neighborhood: row.neighborhood,
      latitude: row.latitude,
      longitude: row.longitude,
      urbanMarket: true,
    },
  }))
}
