import { z } from 'zod'
import {
  lenderCategories,
  lenderOutreachChannels,
  lenderOutreachStatuses,
  lenderRelationshipStages,
  lenderTypes,
} from '@/lib/lenders/types'

export const lenderTypeSchema = z.enum(lenderTypes)
export const lenderCategorySchema = z.enum(lenderCategories)
export const lenderRelationshipStageSchema = z.enum(lenderRelationshipStages)
export const lenderOutreachStatusSchema = z.enum(lenderOutreachStatuses)
export const lenderOutreachChannelSchema = z.enum(lenderOutreachChannels)

export const lenderDiscoverySchema = z.object({
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  metroArea: z.string().optional(),
  niches: z.array(z.string().min(1)).min(1).max(20).default(['credit union', 'community bank', 'mortgage lender']),
  limitPerNiche: z.coerce.number().int().min(1).max(15).default(6),
})

export const lenderMatchRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  fundingProfileId: z.string().uuid().optional(),
  fundingRecommendationId: z.string().uuid().optional(),
  serviceType: z.string().max(120).optional(),
  mode: z.enum(['business', 'personal', 'hybrid']).optional(),
  borrowerState: z.string().max(2).optional(),
  businessIndustry: z.string().max(120).optional(),
  businessRevenue: z.coerce.number().min(0).max(100000000).optional(),
  timeInBusinessMonths: z.coerce.number().int().min(0).max(1200).optional(),
  ficoEstimate: z.coerce.number().int().min(300).max(850).optional(),
  fundingGoalAmount: z.coerce.number().min(0).max(100000000).optional(),
  dealType: z.string().max(120).optional(),
  languagePreference: z.enum(['en', 'es', 'bilingual']).optional(),
  investorExperience: z.enum(['none', 'beginner', 'experienced']).optional(),
  dscr: z.coerce.number().min(0).max(10).optional(),
  ownerOccupied: z.boolean().optional(),
  wantsCashOut: z.boolean().optional(),
  urgencyDays: z.coerce.number().int().min(0).max(365).optional(),
  docsReady: z.boolean().optional(),
})

export const generateLenderOutreachSchema = z.object({
  lenderIds: z.array(z.string().uuid()).min(1).max(100),
  regenerate: z.boolean().optional().default(false),
})

export const updateLenderSchema = z.object({
  relationshipStage: lenderRelationshipStageSchema.optional(),
  outreachStatus: lenderOutreachStatusSchema.optional(),
  notes: z.string().max(4000).optional(),
  fitSummary: z.string().max(2000).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().max(320).nullable().optional(),
  contactPhone: z.string().max(60).nullable().optional(),
  statesServed: z.array(z.string().trim().min(2).max(32)).max(60).optional(),
  minCreditScore: z.coerce.number().int().min(300).max(850).nullable().optional(),
  minRevenue: z.coerce.number().min(0).max(1000000000).nullable().optional(),
  minTimeInBusiness: z.coerce.number().int().min(0).max(2400).nullable().optional(),
  loanAmountMin: z.coerce.number().min(0).max(1000000000).nullable().optional(),
  loanAmountMax: z.coerce.number().min(0).max(1000000000).nullable().optional(),
  dscrMin: z.coerce.number().min(0).max(10).nullable().optional(),
  speedToClose: z.string().max(120).nullable().optional(),
  startupAllowed: z.boolean().optional(),
  investorAllowed: z.boolean().optional(),
  ownerOccupiedAllowed: z.boolean().optional(),
  lowDoc: z.boolean().optional(),
  cashOutAllowed: z.boolean().optional(),
  bilingualSupport: z.boolean().optional(),
  spanishSupport: z.boolean().optional(),
  partnerProfile: z
    .object({
      preferredBorrowers: z.string().max(2000).nullable().optional(),
      noGoItems: z.string().max(2000).nullable().optional(),
      submissionNotes: z.string().max(2000).nullable().optional(),
      partnerProcessOwner: z.string().max(300).nullable().optional(),
      referralProgramStatus: z.string().max(500).nullable().optional(),
      referralCompensationNotes: z.string().max(1000).nullable().optional(),
    })
    .optional(),
})

export const addLenderNoteSchema = z.object({
  note: z.string().min(1).max(4000),
  isInternal: z.boolean().optional().default(true),
})

export const updateLenderOutreachMessageSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(['draft', 'needs_review', 'approved', 'queued', 'sent', 'failed', 'archived']).optional(),
  sendNow: z.boolean().optional().default(false),
})

export const bulkLenderActionSchema = z.object({
  lenderIds: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum([
    'approve_outreach',
    'archive_outreach',
    'pause',
    'mark_contacted',
    'mark_responded',
    'mark_active_partner',
    'mark_not_a_fit',
    'generate_outreach',
  ]),
})
