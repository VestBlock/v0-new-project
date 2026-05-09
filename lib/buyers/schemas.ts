import { z } from 'zod'
import {
  buyerCategories,
  buyerOutreachChannels,
  buyerOutreachStatuses,
  buyerRelationshipStages,
  buyerTypes,
} from '@/lib/buyers/types'

export const buyerTypeSchema = z.enum(buyerTypes)
export const buyerCategorySchema = z.enum(buyerCategories)
export const buyerRelationshipStageSchema = z.enum(buyerRelationshipStages)
export const buyerOutreachStatusSchema = z.enum(buyerOutreachStatuses)
export const buyerOutreachChannelSchema = z.enum(buyerOutreachChannels)

export const buyerDiscoverySchema = z.object({
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  metroArea: z.string().optional(),
  niches: z.array(z.string().min(1)).min(1).max(20).default(['cash home buyer', 'real estate investor', 'we buy houses']),
  limitPerNiche: z.coerce.number().int().min(1).max(15).default(6),
})

export const buyerMatchRequestSchema = z.object({
  leadId: z.string().uuid().optional(),
  serviceType: z.string().max(120).optional(),
  propertyAddress: z.string().max(240).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(2).optional(),
  zipCode: z.string().max(20).optional(),
  assetType: z.string().max(120).optional(),
  occupancy: z.string().max(120).optional(),
  distressLevel: z.coerce.number().min(0).max(10).optional(),
  codeViolationLevel: z.coerce.number().min(0).max(10).optional(),
  rehabLevel: z.coerce.number().min(0).max(10).optional(),
  askingPrice: z.coerce.number().min(0).max(100000000).optional(),
  estimatedValue: z.coerce.number().min(0).max(100000000).optional(),
  landlordSignal: z.boolean().optional(),
  absenteeOwner: z.boolean().optional(),
  sellerMotivation: z.string().max(2000).optional(),
  timelineDays: z.coerce.number().int().min(0).max(3650).optional(),
  creativeFinanceOpen: z.boolean().optional(),
  languagePreference: z.enum(['en', 'es', 'bilingual']).optional(),
  marketTag: z.string().max(120).optional(),
})

export const generateBuyerOutreachSchema = z.object({
  buyerIds: z.array(z.string().uuid()).min(1).max(100),
  regenerate: z.boolean().optional().default(false),
})

export const updateBuyerSchema = z.object({
  relationshipStage: buyerRelationshipStageSchema.optional(),
  outreachStatus: buyerOutreachStatusSchema.optional(),
  notes: z.string().max(4000).optional(),
  fitSummary: z.string().max(2000).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().max(320).nullable().optional(),
  contactPhone: z.string().max(60).nullable().optional(),
  marketsServed: z.array(z.string().trim().min(2).max(120)).max(100).optional(),
  closingSpeed: z.string().max(120).nullable().optional(),
  proofOfFundsStatus: z.string().max(200).nullable().optional(),
  bilingualSupport: z.boolean().optional(),
  spanishSupport: z.boolean().optional(),
  partnerProfile: z
    .object({
      assetTypes: z.array(z.string().min(1).max(120)).max(30).optional(),
      states: z.array(z.string().min(2).max(32)).max(60).optional(),
      cities: z.array(z.string().min(1).max(120)).max(120).optional(),
      zipCodes: z.array(z.string().min(1).max(20)).max(200).optional(),
      metros: z.array(z.string().min(1).max(120)).max(120).optional(),
      occupancyPreference: z.string().max(120).nullable().optional(),
      distressedTolerance: z.coerce.number().min(0).max(10).nullable().optional(),
      codeViolationTolerance: z.coerce.number().min(0).max(10).nullable().optional(),
      tenantOccupiedAllowed: z.boolean().optional(),
      section8Allowed: z.boolean().optional(),
      priceMin: z.coerce.number().min(0).max(100000000).nullable().optional(),
      priceMax: z.coerce.number().min(0).max(100000000).nullable().optional(),
      arvMin: z.coerce.number().min(0).max(100000000).nullable().optional(),
      arvMax: z.coerce.number().min(0).max(100000000).nullable().optional(),
      rehabBudgetMax: z.coerce.number().min(0).max(100000000).nullable().optional(),
      minimumEquityPercent: z.coerce.number().min(0).max(100).nullable().optional(),
      minimumDiscountPercent: z.coerce.number().min(0).max(100).nullable().optional(),
      preferredDealTypes: z.array(z.string().min(1).max(120)).max(30).optional(),
      creativeFinanceOpen: z.boolean().optional(),
      portfolioSizePreference: z.string().max(200).nullable().optional(),
      institutionalCriteria: z.string().max(2000).nullable().optional(),
      buyBoxName: z.string().max(200).nullable().optional(),
      acquisitionProcessOwner: z.string().max(300).nullable().optional(),
      referralProgramStatus: z.string().max(500).nullable().optional(),
      referralCompensationNotes: z.string().max(1000).nullable().optional(),
      buyBoxNotes: z.string().max(2000).nullable().optional(),
    })
    .optional(),
})

export const addBuyerNoteSchema = z.object({
  note: z.string().min(1).max(4000),
  isInternal: z.boolean().optional().default(true),
})

export const updateBuyerOutreachMessageSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(['draft', 'needs_review', 'approved', 'queued', 'sent', 'failed', 'archived']).optional(),
  sendNow: z.boolean().optional().default(false),
})

export const bulkBuyerActionSchema = z.object({
  buyerIds: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum([
    'approve_outreach',
    'archive_outreach',
    'pause',
    'mark_contacted',
    'mark_responded',
    'mark_active_buyer',
    'mark_not_a_fit',
    'generate_outreach',
  ]),
})
