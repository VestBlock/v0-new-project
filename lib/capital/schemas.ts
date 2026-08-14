import { z } from 'zod'
import { capitalCaseStatuses, capitalCaseTypes } from '@/lib/capital/types'

const scalar = z.union([z.string().max(3000), z.number().finite(), z.boolean(), z.null()])

export const capitalCaseInputSchema = z.object({
  id: z.string().uuid().optional(),
  accessToken: z.string().min(32).max(256).optional(),
  idempotencyKey: z.string().min(12).max(160).optional(),
  caseType: z.enum(capitalCaseTypes),
  action: z.enum(['save_draft', 'submit']).default('save_draft'),
  fullName: z.string().trim().max(160).default(''),
  email: z.string().trim().max(320).default(''),
  phone: z.string().trim().max(60).optional().default(''),
  organizationName: z.string().trim().max(200).optional().default(''),
  amountRequested: z.coerce.number().min(0).max(1000000000).nullable().optional(),
  purpose: z.string().trim().max(3000).optional().default(''),
  timing: z.string().trim().max(120).optional().default(''),
  geography: z.string().trim().max(240).optional().default(''),
  communicationPreference: z.enum(['email', 'phone', 'either']).default('email'),
  analysisConsent: z.boolean().default(false),
  providerSharingConsent: z.boolean().default(false),
  marketingConsent: z.boolean().default(false),
  intakeData: z.record(z.string().max(100), scalar).default({}),
  availableDocuments: z.array(z.string().trim().max(240)).max(40).default([]),
})

export const capitalAdminUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(capitalCaseStatuses).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(3000).optional().default(''),
})
