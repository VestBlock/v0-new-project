import { z } from 'zod'
import {
  researchEntityTypes,
  researchOutreachStatuses,
  researchRecommendedLanes,
} from '@/lib/osint/types'

const optionalString = z.string().trim().optional().nullable()

const sourceLinkSchema = z.object({
  label: optionalString,
  url: z.string().trim().min(1),
  sourceType: optionalString,
  notes: optionalString,
})

const researchFlagSchema = z.object({
  label: z.string().trim().min(1),
  severity: z.enum(['low', 'medium', 'high', 'info']).optional(),
  notes: optionalString,
})

export const researchChecklistUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  entityType: z.enum(researchEntityTypes),
  entityId: z.string().uuid().optional().nullable(),
  sourceType: optionalString,
  sourceId: optionalString,
  propertyAddress: optionalString,
  city: optionalString,
  state: optionalString,
  zipCode: optionalString,
  ownerName: optionalString,
  companyName: optionalString,
  contactEmail: optionalString,
  contactPhone: optionalString,
  website: optionalString,
  checklist: z.record(z.string(), z.unknown()).optional(),
  sourceLinks: z.array(sourceLinkSchema).optional(),
  riskFlags: z.array(researchFlagSchema).optional(),
  opportunityFlags: z.array(researchFlagSchema).optional(),
  recommendedLane: z.enum(researchRecommendedLanes).optional().nullable(),
  outreachStatus: z.enum(researchOutreachStatuses).optional(),
  confidenceScore: z.coerce.number().min(0).max(100).optional().nullable(),
  researchSummary: optionalString,
  nextAction: optionalString,
  assignedOwner: optionalString,
  followUpAt: optionalString,
  reviewedAt: optionalString,
})

export const researchChecklistListSchema = z.object({
  search: optionalString,
  entityType: z.enum(researchEntityTypes).or(z.literal('all')).optional(),
  city: optionalString,
  state: optionalString,
  recommendedLane: z.enum(researchRecommendedLanes).or(z.literal('all')).optional(),
  outreachStatus: z.enum(researchOutreachStatuses).or(z.literal('all')).optional(),
  minConfidence: z.coerce.number().min(0).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

export const researchChecklistPatchSchema = researchChecklistUpsertSchema.extend({
  id: z.string().uuid(),
})

export const researchChecklistBulkSchema = z.object({
  checklistIds: z.array(z.string().uuid()).min(1),
  action: z.enum(['needs_review', 'ready', 'approved', 'do_not_contact', 'assign_owner']),
  assignedOwner: optionalString,
})

export const researchChecklistFromInvestorSchema = z.object({
  investorId: z.string().uuid(),
})

export const researchChecklistFromPropertySchema = z.object({
  entityId: z.string().uuid().optional().nullable(),
  sourceType: optionalString,
  sourceId: optionalString,
  propertyAddress: z.string().trim().min(1),
  city: optionalString,
  state: optionalString,
  zipCode: optionalString,
  ownerName: optionalString,
  companyName: optionalString,
  contactEmail: optionalString,
  contactPhone: optionalString,
  website: optionalString,
})
