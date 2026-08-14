import { z } from 'zod'
import { sellerCaseStatuses } from '@/lib/seller/types'

const optionalAmount = z.preprocess(
  (value) => value === '' || value === undefined ? null : value,
  z.coerce.number().min(0).max(1000000000).nullable(),
)

export const sellerCaseInputSchema = z.object({
  id: z.string().uuid().optional(),
  accessToken: z.string().min(32).max(256).optional(),
  idempotencyKey: z.string().min(12).max(160).optional(),
  action: z.enum(['save_draft', 'submit', 'withdraw']).default('save_draft'),
  sellerName: z.string().trim().max(160).default(''),
  email: z.string().trim().max(320).default(''),
  phone: z.string().trim().max(60).default(''),
  propertyAddress: z.string().trim().max(240).default(''),
  city: z.string().trim().max(120).default(''),
  state: z.string().trim().max(80).default(''),
  postalCode: z.string().trim().max(20).default(''),
  propertyType: z.string().trim().max(120).default(''),
  bedrooms: z.preprocess((value) => value === '' || value === undefined ? null : value, z.coerce.number().min(0).max(100).nullable()),
  bathrooms: z.preprocess((value) => value === '' || value === undefined ? null : value, z.coerce.number().min(0).max(100).nullable()),
  propertyCondition: z.string().trim().max(120).default(''),
  occupancyStatus: z.string().trim().max(120).default(''),
  timelineToSell: z.string().trim().max(120).default(''),
  reasonForSelling: z.string().trim().max(600).default(''),
  preferredSalePath: z.string().trim().max(120).default('not_sure'),
  estimatedValue: optionalAmount,
  askingPrice: optionalAmount,
  mortgageBalance: optionalAmount,
  liensOrTaxes: z.string().trim().max(1000).default(''),
  bestTimeToContact: z.string().trim().max(120).default(''),
  communicationPreference: z.enum(['email', 'phone', 'either']).default('either'),
  analysisConsent: z.boolean().default(false),
  contactConsent: z.boolean().default(false),
  marketingConsent: z.boolean().default(false),
  sellerNotes: z.string().trim().max(3000).default(''),
  sourcePath: z.string().regex(/^\/sell(?:\/[a-z0-9-]+)?$/).max(240).default('/sell'),
  attribution: z.record(z.string().max(100), z.string().max(500)).default({}),
}).superRefine((value, context) => {
  if (Object.keys(value.attribution).length > 30) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['attribution'], message: 'Too many attribution fields.' })
  }
})

export const sellerAdminUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(sellerCaseStatuses).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(3000).default(''),
})

export type SellerCaseInput = z.infer<typeof sellerCaseInputSchema>
