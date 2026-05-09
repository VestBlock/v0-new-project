import { z } from 'zod';
import {
  applicationStatuses,
  fundingModes,
  fundingPaths,
  fundingPaymentPlanIds,
} from '@/lib/funding/types';

export const fundingProfileSchema = z.object({
  mode: z.enum(fundingModes),
  funding_goal_amount: z.coerce.number().min(0).max(10000000).nullable().optional(),
  funding_goal_reason: z.string().trim().max(2000).nullable().optional(),
  fico_estimate: z.coerce.number().int().min(300).max(850).nullable().optional(),
  income_range: z.string().trim().max(120).nullable().optional(),
  monthly_debt_payments: z.coerce.number().min(0).max(1000000).nullable().optional(),
  credit_utilization: z.coerce.number().min(0).max(100).nullable().optional(),
  recent_inquiries_count: z.coerce.number().int().min(0).max(50).nullable().optional(),
  new_accounts_24_months: z.coerce.number().int().min(0).max(50).nullable().optional(),
  has_llc: z.boolean().optional().default(false),
  business_name: z.string().trim().max(160).nullable().optional(),
  business_start_date: z.string().trim().max(40).nullable().optional(),
  business_revenue_range: z.string().trim().max(120).nullable().optional(),
  business_industry: z.string().trim().max(120).nullable().optional(),
  ein_available: z.boolean().optional().default(false),
});

export const manualFundingApplicationSchema = z.object({
  recommendation_id: z.string().uuid(),
  product_id: z.string().uuid().nullable().optional(),
  sequence_order: z.coerce.number().int().min(1).max(25),
  recommended_day: z.coerce.number().int().min(0).max(365).default(0),
  user_notes: z.string().trim().max(4000).nullable().optional(),
});

export const fundingApplicationStatusSchema = z.object({
  status: z.enum(applicationStatuses),
  user_notes: z.string().trim().max(4000).nullable().optional(),
  screenshot_url: z.string().url().max(1000).nullable().optional(),
});

export const fundingApprovalSchema = z.object({
  sequence_item_id: z.string().uuid(),
  approved_limit: z.coerce.number().min(0).max(10000000),
  notes: z.string().trim().max(4000).nullable().optional(),
  approval_date: z.string().trim().max(40).nullable().optional(),
});

export const fundingPaymentPlanSchema = z.object({
  recommendation_id: z.string().uuid().nullable().optional(),
  selected_plan: z.enum(fundingPaymentPlanIds).nullable().optional(),
});

export const recommendationRequestSchema = z.object({
  profile_id: z.string().uuid().nullable().optional(),
  force_refresh: z.boolean().optional().default(false),
});

export const fundingPathSchema = z.enum(fundingPaths);
