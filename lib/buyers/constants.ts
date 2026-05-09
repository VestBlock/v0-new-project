import type { BuyerCategory, BuyerType, PropertyBuyerMatchInput } from '@/lib/buyers/types'

export const DEFAULT_BUYER_DISCOVERY_MARKETS = [
  { city: 'Milwaukee', state: 'WI', metroArea: 'Milwaukee' },
  { city: 'Chicago', state: 'IL', metroArea: 'Chicago' },
  { city: 'Detroit', state: 'MI', metroArea: 'Detroit' },
  { city: 'Columbus', state: 'OH', metroArea: 'Columbus' },
  { city: 'Atlanta', state: 'GA', metroArea: 'Atlanta' },
  { city: 'Houston', state: 'TX', metroArea: 'Houston' },
  { city: 'Phoenix', state: 'AZ', metroArea: 'Phoenix' },
  { city: 'Las Vegas', state: 'NV', metroArea: 'Las Vegas' },
] as const

export const DEFAULT_BUYER_DISCOVERY_NICHES = [
  'cash home buyer',
  'we buy houses',
  'real estate investor',
  'home buyer company',
  'fix and flip buyer',
  'land buyer',
  'commercial real estate investor',
  'hedge fund real estate',
] as const

export const BUYER_CATEGORY_TO_TYPE: Record<BuyerCategory, BuyerType> = {
  local_cash_buyer: 'local_operator',
  hedge_fund_buyer: 'institutional',
  sfr_aggregator: 'institutional',
  build_to_rent_buyer: 'institutional',
  landlord_buyer: 'local_operator',
  brrrr_buyer: 'local_operator',
  fix_and_flip_buyer: 'local_operator',
  small_multifamily_buyer: 'local_operator',
  wholesaler_buyer: 'local_operator',
  note_buyer: 'specialty',
  creative_finance_buyer: 'specialty',
  land_buyer: 'local_operator',
  commercial_buyer: 'institutional',
  mobile_home_park_buyer: 'specialty',
  self_storage_buyer: 'specialty',
  mixed_use_buyer: 'specialty',
}

export const CATEGORY_LABELS: Record<string, string> = {
  local_cash_buyer: 'Local Cash Buyer',
  hedge_fund_buyer: 'Hedge Fund Buyer',
  sfr_aggregator: 'SFR Aggregator',
  build_to_rent_buyer: 'Build-to-Rent Buyer',
  landlord_buyer: 'Landlord Buyer',
  brrrr_buyer: 'BRRRR Buyer',
  fix_and_flip_buyer: 'Fix-and-Flip Buyer',
  small_multifamily_buyer: 'Small Multifamily Buyer',
  wholesaler_buyer: 'Wholesaler Buyer',
  note_buyer: 'Note Buyer',
  creative_finance_buyer: 'Creative Finance Buyer',
  land_buyer: 'Land Buyer',
  commercial_buyer: 'Commercial Buyer',
  mobile_home_park_buyer: 'Mobile Home Park Buyer',
  self_storage_buyer: 'Self-Storage Buyer',
  mixed_use_buyer: 'Mixed-Use Buyer',
}

export function suggestBuyerDealType(input: PropertyBuyerMatchInput) {
  if (input.assetType) return input.assetType
  const service = String(input.serviceType || '').toLowerCase()
  if (/land/.test(service)) return 'land'
  if (/commercial|mixed use|office|retail/.test(service)) return 'commercial'
  if (/multifamily|apartment/.test(service)) return 'multifamily'
  return 'single_family'
}
