import { z } from 'zod'

export const leadStatusSchema = z.enum([
  'new',
  'scored',
  'outreach_ready',
  'contacted',
  'replied',
  'interested',
  'qualified',
  'nurturing',
  'closed',
  'closed_won',
  'closed_lost',
  'disqualified',
  'do_not_contact',
])

export const leadOutreachStatusSchema = z.enum([
  'not_started',
  'draft_ready',
  'needs_review',
  'approved',
  'queued',
  'sent',
  'followup_due',
  'failed',
  'do_not_contact',
])

export const scrapeSourceSchema = z.enum([
  'wisconsin_dfi_new_businesses',
  'cincinnati_code_enforcement',
  'milwaukee_accela_enforcement',
  'google_places_businesses',
  'outscraper_google_maps_businesses',
  'weak_web_presence_businesses',
  'apify_yelp_businesses',
  'sam_contract_opportunities',
  'zillow_stale_listing_import',
  'failed_listing_import',
  'real_estate_listing_import',
  'absentee_owner_import',
  'tired_landlord_import',
  'tax_delinquent_import',
  'probate_inherited_import',
  'vacant_distress_import',
  'preforeclosure_import',
])

export const newBusinessScrapeSchema = z.object({
  query: z.string().min(1).default('LLC'),
  limit: z.coerce.number().int().min(1).max(25).default(10),
  daysBack: z.coerce.number().int().min(1).max(365).default(45),
})

export const codeViolationScrapeSchema = z.object({
  provider: z.enum(['cincinnati', 'milwaukee', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  daysBack: z.coerce.number().int().min(1).max(365).default(120),
  city: z.string().optional(),
  state: z.string().optional(),
  street: z.string().optional(),
  zip: z.string().optional(),
})

export const googlePlacesScrapeSchema = z.object({
  city: z.string().min(1),
  state: z.string().min(2).optional(),
  niches: z.array(z.string().min(1)).min(1).max(12),
  limitPerNiche: z.coerce.number().int().min(1).max(20).default(8),
  provider: z.enum(['auto', 'google', 'outscraper']).default('auto'),
  language: z.string().min(2).max(8).default('en'),
  region: z.string().min(2).max(2).optional(),
})

export const samScrapeSchema = z.object({
  keyword: z.string().min(1).default('construction'),
  naicsCodes: z.array(z.string().min(2)).max(10).default([]),
  solicitationTypes: z.array(z.string().min(1)).max(10).default([]),
  setAsideCodes: z.array(z.string().min(1)).max(10).default([]),
  agencyCodes: z.array(z.string().min(1)).max(10).default([]),
  city: z.string().min(1).optional(),
  state: z.string().min(2).optional(),
  zip: z.string().min(3).max(10).optional(),
  postedFrom: z.string().optional(),
  postedTo: z.string().optional(),
  responseDeadlineFrom: z.string().optional(),
  responseDeadlineTo: z.string().optional(),
  daysBack: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const leadScoreRequestSchema = z.object({
  leadIds: z.array(z.string().uuid()).max(200).optional(),
  rescoreAll: z.boolean().optional().default(false),
})

export const generateOutreachSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(100),
  regenerate: z.boolean().optional().default(false),
})

export const exportLeadsSchema = z.object({
  source: z.string().optional(),
  offer: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  niche: z.string().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  status: z.string().optional(),
  outreachStatus: z.string().optional(),
  deliveryStatus: z.string().optional(),
  emailReady: z.coerce.boolean().optional(),
  preset: z.enum(['all', 'filtered', 'contacted', 'bounced', 'high_score', 'selected', 'no_email']).optional(),
  selectedIds: z.array(z.string().uuid()).max(500).optional(),
})

export const addLeadNoteSchema = z.object({
  note: z.string().min(1).max(4000),
  isInternal: z.boolean().optional().default(true),
})

export const updateLeadSchema = z.object({
  status: leadStatusSchema.optional(),
  outreachStatus: leadOutreachStatusSchema.optional(),
  notes: z.string().max(4000).optional(),
  bestOffer: z.string().max(120).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  campaignName: z.string().max(160).nullable().optional(),
})

export const updateOutreachMessageSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(['draft', 'needs_review', 'approved', 'queued', 'sent', 'failed', 'archived']).optional(),
  sendNow: z.boolean().optional().default(false),
})

export const bulkLeadActionSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum([
    'approve_outreach',
    'archive_outreach',
    'pause',
    'delete',
    'mark_contacted',
    'mark_replied',
    'mark_interested',
    'mark_closed_won',
    'mark_closed_lost',
    'mark_do_not_contact',
    'generate_outreach',
    'assign_campaign',
  ]),
  campaignName: z.string().max(160).optional(),
})

export const marketStatusSchema = z.enum(['queued', 'active', 'scraped', 'paused', 'exhausted'])

export const csvImportLeadSchema = z.object({
  business_name: z.string().min(1),
  contact_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  niche: z.string().optional(),
  source: z.string().optional(),
  owner_name: z.string().optional(),
  owner_occupied: z.string().optional(),
  owner_state: z.string().optional(),
  years_owned: z.string().optional(),
  equity_estimate: z.string().optional(),
  tax_delinquent_amount: z.string().optional(),
  lien_amount: z.string().optional(),
  vacant_flag: z.string().optional(),
  absentee_owner: z.string().optional(),
  probate_flag: z.string().optional(),
  deceased_owner: z.string().optional(),
  preforeclosure_flag: z.string().optional(),
  property_address: z.string().optional(),
  mailing_address: z.string().optional(),
  property_type: z.string().optional(),
  bedrooms: z.string().optional(),
  bathrooms: z.string().optional(),
  square_feet: z.string().optional(),
  year_built: z.string().optional(),
  list_price: z.string().optional(),
  estimated_value: z.string().optional(),
  rent_estimate: z.string().optional(),
  days_on_market: z.string().optional(),
  price_reduced: z.string().optional(),
  occupancy_status: z.string().optional(),
  listing_status: z.string().optional(),
  listing_url: z.string().url().optional().or(z.literal('')),
  reason_for_selling: z.string().optional(),
  notes: z.string().optional(),
})
