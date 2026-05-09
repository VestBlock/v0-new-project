import type { LeadOffer } from '@/lib/leads/types'

export const DEFAULT_GOOGLE_PLACES_NICHES = [
  'property management companies',
  'real estate investors',
  'contractors',
  'roofing contractors',
  'home health agencies',
  'barbershops',
  'beauty salons',
  'restaurants',
  'food trucks',
  'trucking companies',
  'cleaning companies',
  'tax services',
  'daycare centers',
  'auto repair shops',
  'immigration services',
  'spanish-speaking businesses',
]

export const GOOGLE_MAPS_PROVIDER_LABELS: Record<string, string> = {
  auto: 'Auto',
  google: 'Google Places',
  outscraper: 'Outscraper Maps',
}

export const OFFER_PRIORITY: LeadOffer[] = [
  'DealVault / Operator Accountability',
  'AI Receptionist Launch',
  'AI Appointment Booking System',
  'Website Upgrade Sprint',
  'Business Funding',
  'Business Credit Builder',
  'Gov Contract Readiness',
  'Real Estate Seller Lead',
  'Business Setup / Compliance Help',
  'Spanish Funding Assistance',
  'Grant/Funding Roadmap',
  'New Business Formation',
  'Credit Repair',
  'AI Receptionist',
  'Website Upgrade',
]

export const OUTREACH_UNSUBSCRIBE_NOTES = {
  sms: 'Reply STOP to opt out of future text outreach.',
  email: 'If this is not relevant, reply and let us know or ask to opt out of future outreach.',
  facebook_dm: 'If you do not want follow-up messages, reply and we will close the conversation.',
  phone_script: 'If they are not interested, thank them, mark the lead closed, and do not continue follow-up.',
}
