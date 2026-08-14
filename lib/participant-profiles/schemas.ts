import { z } from 'zod'
import {
  PARTICIPANT_ROLES,
  PARTICIPANT_STATUSES,
  roleFieldKeys,
  rolePublicKeys,
  roleRequiredKeys,
  type ParticipantRole,
} from '@/lib/participant-profiles/config'

export const participantRoleSchema = z.enum(PARTICIPANT_ROLES)
export const participantStatusSchema = z.enum(PARTICIPANT_STATUSES)

const criteriaValueSchema = z.union([
  z.string().trim().max(4000),
  z.number().finite().min(-1_000_000_000).max(1_000_000_000),
  z.boolean(),
  z.array(z.string().trim().min(1).max(240)).max(120),
])

export const participantCriteriaSchema = z.record(
  z.string().min(1).max(80),
  criteriaValueSchema
).superRefine((criteria, context) => {
  if (Object.keys(criteria).length > 80) {
    context.addIssue({ code: 'custom', message: 'Too many criteria fields were submitted.' })
  }
})

export const communicationPreferencesSchema = z.object({
  email: z.boolean(),
  phone: z.boolean(),
}).strict()

const participantProfileObjectSchema = z.object({
  role: participantRoleSchema,
  identityType: z.enum(['individual', 'organization']).default('individual'),
  displayName: z.string().trim().min(2).max(200),
  organizationName: z.string().trim().max(200).optional().default(''),
  contactEmail: z.string().trim().email().max(320),
  contactPhone: z.string().trim().max(80).optional().default(''),
  summary: z.string().trim().max(2000).optional().default(''),
  criteria: participantCriteriaSchema.default({}),
  communicationPreferences: communicationPreferencesSchema.default({ email: true, phone: false }),
  marketingConsent: z.boolean().default(false),
  matchingConsent: z.boolean().default(false),
  outreachConsent: z.boolean().default(false),
  publicVisibilityConsent: z.boolean().default(false),
  publicFieldKeys: z.array(z.string().min(1).max(80)).max(40).default([]),
  idempotencyKey: z.string().uuid(),
}).strict()

export const participantProfileCreateSchema = participantProfileObjectSchema
  .superRefine((input, context) => validateRoleCriteria(input.role, input.criteria, input.publicFieldKeys, context))

export const participantProfilePatchSchema = z.object({
  identityType: z.enum(['individual', 'organization']).optional(),
  displayName: z.string().trim().min(2).max(200).optional(),
  organizationName: z.string().trim().max(200).optional(),
  contactEmail: z.string().trim().email().max(320).optional(),
  contactPhone: z.string().trim().max(80).optional(),
  summary: z.string().trim().max(2000).optional(),
  criteria: participantCriteriaSchema.optional(),
  communicationPreferences: communicationPreferencesSchema.optional(),
  marketingConsent: z.boolean().optional(),
  matchingConsent: z.boolean().optional(),
  outreachConsent: z.boolean().optional(),
  publicVisibilityConsent: z.boolean().optional(),
  publicFieldKeys: z.array(z.string().min(1).max(80)).max(40).optional(),
  expectedVersion: z.number().int().positive(),
}).strict()

export const participantLifecycleSchema = z.object({
  action: z.enum(['submit', 'pause', 'reactivate', 'withdraw']),
  expectedVersion: z.number().int().positive(),
}).strict()

export const participantNormalizationRequestSchema = z.object({
  originalText: z.string().trim().min(20).max(8000),
}).strict()

export const participantNormalizationDecisionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  corrections: participantCriteriaSchema.optional().default({}),
  expectedVersion: z.number().int().positive(),
}).strict()

export const participantAdminActionSchema = z.object({
  action: z.enum(['assign', 'request_information', 'approve', 'decline', 'pause', 'archive', 'link_legacy']),
  reason: z.string().trim().max(2000).optional().default(''),
  assignedOperatorEmail: z.string().trim().email().max(320).optional(),
  legacyEntityType: z.enum(['buyers', 'lenders', 'investor_profiles']).optional(),
  legacyEntityId: z.string().uuid().optional(),
  expectedVersion: z.number().int().positive(),
}).strict()

export const publicSlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{8,80}$/)

export function validateCompleteProfile(input: {
  role: ParticipantRole
  displayName: string
  contactEmail: string
  criteria: Record<string, unknown>
}) {
  const missing = [
    ...(input.displayName.trim().length >= 2 ? [] : ['name']),
    ...(/^\S+@\S+\.\S+$/.test(input.contactEmail) ? [] : ['valid contact email']),
    ...roleRequiredKeys(input.role).filter((key) => {
      const value = input.criteria[key]
      if (Array.isArray(value)) return value.length === 0
      return value === null || value === undefined || String(value).trim() === ''
    }),
  ]
  return { complete: missing.length === 0, missing }
}

function validateRoleCriteria(
  role: ParticipantRole,
  criteria: Record<string, unknown>,
  publicFieldKeys: string[],
  context: z.RefinementCtx
) {
  const allowed = new Set(roleFieldKeys(role))
  for (const key of Object.keys(criteria)) {
    if (!allowed.has(key)) {
      context.addIssue({ code: 'custom', path: ['criteria', key], message: 'This field is not valid for the selected role.' })
    }
  }
  const publicAllowed = new Set(rolePublicKeys(role))
  for (const key of publicFieldKeys) {
    if (!publicAllowed.has(key)) {
      context.addIssue({ code: 'custom', path: ['publicFieldKeys'], message: 'A selected public field is not eligible for public display.' })
    }
  }
}
