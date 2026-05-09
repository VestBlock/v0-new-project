import type { CsvLeadImportRow } from '@/lib/leads/types'

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function isValidLeadEmail(value: string | null | undefined) {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function parseCsvText(text: string) {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(current.trim())
      current = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(current.trim())
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      current = ''
      continue
    }

    current += char
  }

  if (current.length || row.length) {
    row.push(current.trim())
    if (row.some((cell) => cell.length > 0)) rows.push(row)
  }

  return rows
}

export function mapCsvLeadRows(text: string): CsvLeadImportRow[] {
  const rows = parseCsvText(text)
  if (rows.length === 0) return []

  const headers = rows[0].map(normalizeHeader)
  return rows.slice(1).map((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() || '']))
    return {
      business_name:
        record.business_name ||
        record.company ||
        record.business ||
        record.owner_name ||
        record.agent_name ||
        record.property_address ||
        record.address ||
        '',
      contact_name: record.contact_name || record.name || record.owner_name || record.agent_name || '',
      email: record.email || '',
      phone: record.phone || '',
      website: record.website || record.listing_url || record.url || '',
      city: record.city || record.property_city || '',
      state: record.state || record.property_state || '',
      zip: record.zip || record.zip_code || record.postal_code || '',
      niche: record.niche || record.category || record.strategy || '',
      source: record.source || 'csv_import',
      owner_name: record.owner_name || record.owner || record.full_name || '',
      owner_occupied: record.owner_occupied || record.owner_occ || record.homestead || '',
      owner_state: record.owner_state || record.owner_mail_state || record.mailing_state || '',
      years_owned: record.years_owned || record.years_of_ownership || record.ownership_length || '',
      equity_estimate: record.equity_estimate || record.equity || record.estimated_equity || '',
      tax_delinquent_amount: record.tax_delinquent_amount || record.tax_delinquent || record.tax_balance || '',
      lien_amount: record.lien_amount || record.liens || record.total_liens || '',
      vacant_flag: record.vacant_flag || record.vacant || record.is_vacant || '',
      absentee_owner: record.absentee_owner || record.absentee || record.non_owner_occupied || '',
      probate_flag: record.probate_flag || record.probate || record.inherited_flag || '',
      deceased_owner: record.deceased_owner || record.deceased || '',
      preforeclosure_flag: record.preforeclosure_flag || record.pre_foreclosure || record.preforeclosure || record.default_flag || '',
      property_address:
        record.property_address ||
        record.address ||
        record.street_address ||
        record.street ||
        '',
      mailing_address: record.mailing_address || '',
      property_type: record.property_type || record.home_type || record.asset_type || '',
      bedrooms: record.bedrooms || record.beds || '',
      bathrooms: record.bathrooms || record.baths || '',
      square_feet: record.square_feet || record.sqft || record.living_area || '',
      year_built: record.year_built || '',
      list_price: record.list_price || record.price || record.asking_price || '',
      estimated_value: record.estimated_value || record.zestimate || record.arv || '',
      rent_estimate: record.rent_estimate || record.rent_zestimate || '',
      days_on_market: record.days_on_market || record.dom || record.days_on_zillow || '',
      price_reduced: record.price_reduced || record.price_cut || record.price_cut_amount || '',
      occupancy_status: record.occupancy_status || record.occupancy || '',
      listing_status: record.listing_status || record.status || record.mls_status || '',
      listing_url: record.listing_url || record.url || '',
      reason_for_selling: record.reason_for_selling || '',
      notes: record.notes || record.description || record.situation || '',
    }
  })
}
