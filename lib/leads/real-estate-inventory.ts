import type { PropertyBuyerMatchInput } from '@/lib/buyers/types'
import type { NormalizedLeadInput, CsvLeadImportRow } from '@/lib/leads/types'

function normalizeText(value?: string | null) {
  return String(value || '').trim()
}

function parseNumber(value?: string | null) {
  const cleaned = normalizeText(value).replace(/[^0-9.-]/g, '')
  if (!cleaned) return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parseInteger(value?: string | null) {
  const parsed = parseNumber(value)
  return Number.isFinite(parsed) ? Math.round(parsed as number) : null
}

function parseBooleanLike(value?: string | null) {
  const normalized = normalizeText(value).toLowerCase()
  if (!normalized) return false
  if (['1', 'true', 'yes', 'y', 'price reduced', 'reduced', 'cut'].includes(normalized)) return true
  const numeric = parseNumber(value)
  return numeric !== null && numeric > 0
}

function normalizeWebsiteCandidate(value?: string | null) {
  const candidate = normalizeText(value)
  if (!candidate) return null
  if (/zillow\.com|redfin\.com|realtor\.com|trulia\.com/i.test(candidate)) return null
  return candidate
}

function inferSource(row: CsvLeadImportRow) {
  const source = normalizeText(row.source).toLowerCase()
  const listingUrl = normalizeText(row.listing_url || row.website).toLowerCase()
  const listingStatus = normalizeText(row.listing_status).toLowerCase()
  const absenteeOwner = parseBooleanLike(row.absentee_owner) || normalizeText(row.owner_occupied).toLowerCase() === 'no'
  const vacant = parseBooleanLike(row.vacant_flag)
  const probate = parseBooleanLike(row.probate_flag) || parseBooleanLike(row.deceased_owner)
  const preforeclosure = parseBooleanLike(row.preforeclosure_flag)
  const taxDelinquentAmount = parseNumber(row.tax_delinquent_amount) || 0

  if (
    source.includes('failed') ||
    source.includes('expired') ||
    source.includes('withdrawn') ||
    source.includes('cancelled') ||
    source.includes('canceled') ||
    /expired|withdrawn|cancelled|canceled|failed/.test(listingStatus)
  ) {
    return 'failed_listing_import'
  }
  if (source.includes('zillow') || listingUrl.includes('zillow.com')) return 'zillow_stale_listing_import'
  if (listingUrl.includes('redfin.com') || listingUrl.includes('realtor.com')) return 'real_estate_listing_import'
  if (source.includes('preforeclosure') || preforeclosure) return 'preforeclosure_import'
  if (source.includes('probate') || source.includes('inherited') || probate) return 'probate_inherited_import'
  if (source.includes('tax') || taxDelinquentAmount > 0) return 'tax_delinquent_import'
  if (source.includes('vacant') || source.includes('distress') || vacant) return 'vacant_distress_import'
  if (source.includes('landlord')) return 'tired_landlord_import'
  if (source.includes('absentee') || absenteeOwner) return 'absentee_owner_import'
  return row.source || 'real_estate_listing_import'
}

function inferInventoryType(row: CsvLeadImportRow) {
  const source = inferSource(row)
  if (source === 'failed_listing_import') return 'failed_listing'
  if (source === 'absentee_owner_import') return 'absentee_owner'
  if (source === 'tired_landlord_import') return 'tired_landlord'
  if (source === 'tax_delinquent_import') return 'tax_delinquent'
  if (source === 'probate_inherited_import') return 'probate_inherited'
  if (source === 'vacant_distress_import') return 'vacant_distress'
  if (source === 'preforeclosure_import') return 'preforeclosure'
  return source === 'zillow_stale_listing_import' ? 'zillow_stale_listing' : 'listing_inventory'
}

export type RealEstateInventoryStrategy =
  | 'fast_cash'
  | 'novation'
  | 'creative_finance'
  | 'failed_listing'
  | 'stale_listing_followup'

export function classifyRealEstateInventoryStrategy(row: CsvLeadImportRow): RealEstateInventoryStrategy {
  const daysOnMarket = parseInteger(row.days_on_market) || 0
  const priceReduced = parseBooleanLike(row.price_reduced)
  const listingStatus = normalizeText(row.listing_status).toLowerCase()
  const vacant = parseBooleanLike(row.vacant_flag)
  const absenteeOwner = parseBooleanLike(row.absentee_owner) || normalizeText(row.owner_occupied).toLowerCase() === 'no'
  const probate = parseBooleanLike(row.probate_flag) || parseBooleanLike(row.deceased_owner)
  const preforeclosure = parseBooleanLike(row.preforeclosure_flag)
  const taxDelinquentAmount = parseNumber(row.tax_delinquent_amount) || 0
  const yearsOwned = parseInteger(row.years_owned) || 0
  const notes = [
    normalizeText(row.notes),
    normalizeText(row.reason_for_selling),
    normalizeText(row.occupancy_status),
    normalizeText(row.property_type),
    listingStatus,
    vacant ? 'vacant' : '',
    absenteeOwner ? 'absentee owner' : '',
    probate ? 'probate' : '',
    preforeclosure ? 'preforeclosure' : '',
    taxDelinquentAmount > 0 ? 'tax delinquent' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (
    vacant ||
    preforeclosure ||
    taxDelinquentAmount >= 1000 ||
    /vacant|fire|hoarder|major repair|distress|code violation|condemned|as[- ]is|lien|foreclosure/i.test(notes)
  ) {
    return 'fast_cash'
  }
  if (/expired|withdrawn|cancelled|canceled|failed/i.test(listingStatus)) {
    return 'failed_listing'
  }
  if (
    /subject to|seller finance|creative|carry|lease option|tenant|rental|landlord/i.test(notes) ||
    daysOnMarket >= 120 ||
    absenteeOwner ||
    yearsOwned >= 10
  ) {
    return 'creative_finance'
  }
  if (probate) {
    return 'novation'
  }
  if (daysOnMarket >= 90 && (priceReduced || /clean|retail|updated|good condition|showing|estate/i.test(notes))) {
    return 'novation'
  }
  return 'stale_listing_followup'
}

export function strategyOutreachAngle(strategy: RealEstateInventoryStrategy) {
  switch (strategy) {
    case 'fast_cash':
      return 'Fast-cash and as-is seller outreach for higher-distress properties'
    case 'failed_listing':
      return 'Failed-listing outreach for owners who already tried the market and need a different path'
    case 'novation':
      return 'Novation-style outreach for cleaner properties that may need a higher-price path'
    case 'creative_finance':
      return 'Creative finance and flexible seller-terms outreach for stale inventory'
    default:
      return 'Stale-listing seller follow-up and practical exit-path outreach'
  }
}

export function isRealEstateInventoryRow(row: CsvLeadImportRow) {
  const source = normalizeText(row.source).toLowerCase()
  const niche = normalizeText(row.niche).toLowerCase()
  return Boolean(
    normalizeText(row.property_address) ||
      normalizeText(row.listing_url) ||
      normalizeText(row.days_on_market) ||
      source.includes('zillow') ||
      source.includes('listing') ||
      source.includes('absentee') ||
      source.includes('landlord') ||
      source.includes('tax') ||
      source.includes('probate') ||
      source.includes('vacant') ||
      source.includes('preforeclosure') ||
      niche.includes('real estate') ||
      niche.includes('seller') ||
      niche.includes('novation') ||
      niche.includes('creative') ||
      parseBooleanLike(row.absentee_owner) ||
      parseBooleanLike(row.vacant_flag) ||
      parseBooleanLike(row.probate_flag) ||
      parseBooleanLike(row.preforeclosure_flag) ||
      Boolean(parseNumber(row.tax_delinquent_amount))
  )
}

export function buildRealEstateInventoryLead(row: CsvLeadImportRow, campaignName: string | null): NormalizedLeadInput {
  const propertyAddress = normalizeText(row.property_address)
  const city = normalizeText(row.city)
  const state = normalizeText(row.state)
  const daysOnMarket = parseInteger(row.days_on_market)
  const listPrice = parseNumber(row.list_price)
  const estimatedValue = parseNumber(row.estimated_value)
  const equityEstimate = parseNumber(row.equity_estimate)
  const taxDelinquentAmount = parseNumber(row.tax_delinquent_amount)
  const lienAmount = parseNumber(row.lien_amount)
  const priceReduced = parseBooleanLike(row.price_reduced)
  const vacantFlag = parseBooleanLike(row.vacant_flag)
  const absenteeOwner = parseBooleanLike(row.absentee_owner) || normalizeText(row.owner_occupied).toLowerCase() === 'no'
  const probateFlag = parseBooleanLike(row.probate_flag) || parseBooleanLike(row.deceased_owner)
  const preforeclosureFlag = parseBooleanLike(row.preforeclosure_flag)
  const yearsOwned = parseInteger(row.years_owned)
  const occupancy = normalizeText(row.occupancy_status)
  const propertyType = normalizeText(row.property_type)
  const notes = normalizeText(row.notes)
  const reasonForSelling = normalizeText(row.reason_for_selling)
  const stale = (daysOnMarket || 0) >= 90
  const veryStale = (daysOnMarket || 0) >= 120
  const strategy = classifyRealEstateInventoryStrategy(row)
  const creativeCandidate =
    strategy === 'fast_cash' ||
    strategy === 'creative_finance' ||
    strategy === 'novation' ||
    strategy === 'failed_listing' ||
    veryStale ||
    priceReduced
  const inventoryType = inferInventoryType(row)

  const marketSegment = creativeCandidate
    ? strategy === 'fast_cash'
      ? 'fast_cash_candidate'
      : strategy === 'creative_finance'
      ? 'creative_finance_candidate'
      : strategy === 'novation'
        ? 'novation_candidate'
        : strategy === 'failed_listing'
          ? 'failed_listing'
        : 'seller_inventory'
    : stale
      ? 'stale_listing'
      : 'seller_inventory'

  const signals = [
    stale ? `${daysOnMarket} days on market` : null,
    priceReduced ? 'price reduced' : null,
    vacantFlag ? 'vacant' : null,
    absenteeOwner ? 'absentee owner' : null,
    probateFlag ? 'probate/inherited' : null,
    preforeclosureFlag ? 'preforeclosure' : null,
    taxDelinquentAmount ? `tax delinquent ${Math.round(taxDelinquentAmount)}` : null,
    lienAmount ? `lien amount ${Math.round(lienAmount)}` : null,
    yearsOwned ? `${yearsOwned} years owned` : null,
    equityEstimate ? `estimated equity ${Math.round(equityEstimate)}` : null,
    propertyType ? `type ${propertyType}` : null,
    occupancy ? `occupancy ${occupancy}` : null,
    listPrice ? `list price ${Math.round(listPrice)}` : null,
    estimatedValue ? `estimated value ${Math.round(estimatedValue)}` : null,
    reasonForSelling || notes || null,
  ].filter(Boolean)

  return {
    leadType: 'sell_house',
    source: inferSource(row),
    sourceUrl: row.listing_url || row.website || null,
    category: 'seller_lead',
    name: row.contact_name || row.owner_name || null,
    businessName: propertyAddress || row.business_name || null,
    propertyAddress: propertyAddress || null,
    mailingAddress: row.mailing_address || null,
    phone: row.phone || null,
    email: row.email || null,
    website: normalizeWebsiteCandidate(row.website),
    city: city || null,
    state: state || null,
    zip: row.zip || null,
    painSignal: signals.join('; ') || 'Stale listing imported for seller follow-up and buyer matching.',
    notes: notes || reasonForSelling || null,
    bestOffer: 'Real Estate Seller Lead',
    marketSegment,
    niche: row.niche || 'real_estate_inventory',
    campaignName,
    emailValid: row.email ? true : null,
    bounceRiskScore: row.email ? 20 : 55,
    outreachAngle: strategyOutreachAngle(strategy),
    formData: {
      importedFromCsv: true,
      importProfile: 'real_estate_inventory',
      ownerName: row.owner_name || null,
      ownerOccupied: row.owner_occupied || null,
      ownerState: row.owner_state || null,
      yearsOwned,
      equityEstimate: row.equity_estimate || null,
      taxDelinquentAmount: row.tax_delinquent_amount || null,
      lienAmount: row.lien_amount || null,
      vacantFlag,
      absenteeOwner,
      probateFlag,
      deceasedOwner: parseBooleanLike(row.deceased_owner),
      preforeclosureFlag,
      propertyType: row.property_type || null,
      bedrooms: row.bedrooms || null,
      bathrooms: row.bathrooms || null,
      squareFeet: row.square_feet || null,
      yearBuilt: row.year_built || null,
      listPrice: row.list_price || null,
      estimatedValue: row.estimated_value || null,
      rentEstimate: row.rent_estimate || null,
      daysOnMarket: daysOnMarket,
      priceReduced,
      occupancyStatus: row.occupancy_status || null,
      listingStatus: row.listing_status || null,
      reasonForSelling: row.reason_for_selling || null,
      realEstateStrategy: strategy,
    },
    metadata: {
      importedFromCsv: true,
      inventoryType,
      originalSource: inferSource(row),
      listingUrl: row.listing_url || row.website || null,
      daysOnMarket,
      priceReduced,
      vacantFlag,
      absenteeOwner,
      probateFlag,
      preforeclosureFlag,
      listPrice,
      estimatedValue,
      equityEstimate,
      taxDelinquentAmount,
      lienAmount,
      yearsOwned,
      rentEstimate: parseNumber(row.rent_estimate),
      bedrooms: parseInteger(row.bedrooms),
      bathrooms: parseNumber(row.bathrooms),
      squareFeet: parseInteger(row.square_feet),
      yearBuilt: parseInteger(row.year_built),
      occupancyStatus: row.occupancy_status || null,
      listingStatus: row.listing_status || null,
      propertyType: row.property_type || null,
      creativeFinanceCandidate: creativeCandidate,
      staleListing: stale,
      realEstateStrategy: strategy,
    },
  }
}

export function buildPropertyMatchInputFromRealEstateRow(
  leadId: string,
  row: CsvLeadImportRow
): PropertyBuyerMatchInput {
  const daysOnMarket = parseInteger(row.days_on_market)
  const priceReduced = parseBooleanLike(row.price_reduced)
  const vacantFlag = parseBooleanLike(row.vacant_flag)
  const absenteeOwner = parseBooleanLike(row.absentee_owner) || normalizeText(row.owner_occupied).toLowerCase() === 'no'
  const probateFlag = parseBooleanLike(row.probate_flag) || parseBooleanLike(row.deceased_owner)
  const preforeclosureFlag = parseBooleanLike(row.preforeclosure_flag)
  const taxDelinquentAmount = parseNumber(row.tax_delinquent_amount) || 0
  const occupancy = normalizeText(row.occupancy_status).toLowerCase()
  const notes = `${normalizeText(row.notes)} ${normalizeText(row.reason_for_selling)} ${vacantFlag ? 'vacant' : ''} ${
    probateFlag ? 'probate' : ''
  } ${preforeclosureFlag ? 'preforeclosure' : ''} ${taxDelinquentAmount > 0 ? 'tax delinquent' : ''}`
  const creativeFinanceOpen =
    (daysOnMarket || 0) >= 90 ||
    priceReduced ||
    absenteeOwner ||
    /subject to|seller finance|creative|novation|lease option|carry/i.test(notes)

  const distressLevel =
    vacantFlag || preforeclosureFlag || taxDelinquentAmount >= 1000 || /poor|distress|fire|hoarder|vacant|condemned|foreclosure/i.test(notes)
      ? 8
      : probateFlag || (daysOnMarket || 0) >= 120 || priceReduced
        ? 6
        : (daysOnMarket || 0) >= 90
          ? 5
          : 3

  return {
    leadId,
    serviceType: 'sell_house',
    propertyAddress: row.property_address || null,
    city: row.city || null,
    state: row.state || null,
    zipCode: row.zip || null,
    assetType: row.property_type || 'single_family',
    occupancy: row.occupancy_status || null,
    distressLevel,
    rehabLevel: distressLevel,
    askingPrice: parseNumber(row.list_price),
    estimatedValue: parseNumber(row.estimated_value),
    landlordSignal: absenteeOwner || /tenant|occupied|rental|leased/i.test(occupancy),
    absenteeOwner,
    sellerMotivation:
      normalizeText(row.reason_for_selling) ||
      (preforeclosureFlag
        ? 'preforeclosure signal'
        : probateFlag
          ? 'probate or inherited property'
          : taxDelinquentAmount > 0
            ? `tax delinquent balance ${Math.round(taxDelinquentAmount)}`
            : null) ||
      ((daysOnMarket || 0) >= 90 ? `${daysOnMarket} days on market` : null),
    timelineDays: (daysOnMarket || 0) >= 120 ? 30 : null,
    creativeFinanceOpen,
    languagePreference: 'en',
    marketTag: [normalizeText(row.city), normalizeText(row.state)].filter(Boolean).join(', ') || null,
  }
}
