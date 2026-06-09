import { z } from 'zod'
import { investorOutreachStatuses, investorRelationshipStages, investorSourceTypes, investorTypes } from '@/lib/investors/types'

const optionalString = z.string().trim().optional().nullable()

const investorTransactionSchema = z.object({
  propertyAddress: optionalString,
  city: optionalString,
  state: optionalString,
  zipCode: optionalString,
  propertyType: optionalString,
  transactionType: optionalString,
  transactionDate: optionalString,
  purchasePrice: z.coerce.number().optional().nullable(),
  salePrice: z.coerce.number().optional().nullable(),
  estimatedRehab: z.coerce.number().optional().nullable(),
  estimatedProfit: z.coerce.number().optional().nullable(),
  financingType: optionalString,
  sourceType: optionalString,
  sourceUrl: optionalString,
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const investorEvidenceSchema = z.object({
  sourceType: z.enum(investorSourceTypes),
  sourceName: optionalString,
  sourceUrl: optionalString,
  externalId: optionalString,
  recordDate: optionalString,
  confidenceScore: z.coerce.number().optional().nullable(),
  evidenceSummary: optionalString,
  rawPayload: z.record(z.string(), z.unknown()).optional(),
})

export const investorImportSchema = z.object({
  displayName: z.string().trim().min(1),
  personName: optionalString,
  llcName: optionalString,
  companyName: optionalString,
  primaryInvestorType: z.enum(investorTypes).optional(),
  classificationTags: z.array(z.string().trim()).optional(),
  contactEmail: optionalString,
  contactPhone: optionalString,
  website: optionalString,
  linkedinUrl: optionalString,
  facebookUrl: optionalString,
  markets: z.array(z.string().trim()).optional(),
  propertyTypes: z.array(z.string().trim()).optional(),
  estimatedBuyBox: z.record(z.string(), z.unknown()).optional(),
  financingIndicators: z.array(z.string().trim()).optional(),
  sourceNames: z.array(z.string().trim()).optional(),
  sourceIdentity: optionalString,
  notes: optionalString,
  metadata: z.record(z.string(), z.unknown()).optional(),
  transactions: z.array(investorTransactionSchema).optional(),
  evidence: z.array(investorEvidenceSchema).optional(),
})

export const investorImportListSchema = z.array(investorImportSchema)

export const investorUpdateSchema = z.object({
  id: z.string().uuid(),
  relationshipStage: z.enum(investorRelationshipStages).optional(),
  outreachStatus: z.enum(investorOutreachStatuses).optional(),
  notes: optionalString,
  routingOwner: optionalString,
  nextFollowUpAt: optionalString,
})

export const investorBulkSchema = z.object({
  investorIds: z.array(z.string().uuid()).min(1),
  action: z.enum([
    'generate_outreach',
    'approve_outreach',
    'queue_outreach',
    'mark_sent',
    'mark_responded',
    'active_partner',
    'do_not_contact',
  ]),
})

export const investorFollowUpAgentSchema = z.object({
  investorId: z.string().uuid(),
  inboundMessage: z.string().trim().min(3),
})
