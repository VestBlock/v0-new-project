import { z } from 'zod'
import { nextMoveFocuses } from '@/lib/next-move/types'

export const nextMoveSubmissionSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  focus: z.enum(nextMoveFocuses),
  timeline: z.enum(['now', '30-days', '90-days', 'exploring']),
  position: z.enum(['starting', 'preparing', 'active', 'stalled']),
  creditRange: z.enum(['unknown', 'below-580', '580-669', '670-739', '740-plus', 'prefer-not-to-say']),
  weeklyTime: z.enum(['under-3', '3-7', '8-plus']),
  mainObstacle: z.string().trim().min(3).max(500),
  goalDetails: z.string().trim().max(1200).optional().or(z.literal('')),
  requestFollowUp: z.boolean(),
  analysisConsent: z.literal(true),
  marketingConsent: z.boolean(),
  attribution: z.record(z.string(), z.string().trim().max(500)).default({}),
  website: z.string().max(0).optional(),
})
