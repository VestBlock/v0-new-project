import { z } from "zod";

export const dealVaultDealTypeSchema = z.enum([
  "wholesale_assignment",
  "jv_split",
  "contractor_rehab",
  "seller_finance",
  "rent_to_own",
  "real_estate_referral",
]);

export const dealVaultProofStatusSchema = z.enum([
  "pending",
  "active",
  "revoked",
  "superseded",
  "failed",
]);

export const dealVaultProofTypeSchema = z.enum([
  "purchase_agreement",
  "assignment_agreement",
  "contractor_scope",
  "seller_finance_note",
  "lease_option",
  "referral_agreement",
  "other",
]);

export const dealVaultMilestoneStatusSchema = z.enum([
  "pending",
  "submitted",
  "approved",
  "disputed",
  "completed",
  "cancelled",
]);

export const dealVaultSplitSchema = z.object({
  participantName: z.string().trim().min(1),
  participantEmail: z.string().email().optional().or(z.literal("")),
  participantWallet: z.string().trim().optional().or(z.literal("")),
  participantRole: z.string().trim().optional().or(z.literal("")),
  bps: z.number().int().positive().max(10000),
  amountOwed: z.number().nonnegative().optional(),
});

export const dealVaultMilestoneSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().or(z.literal("")),
  amount: z.number().nonnegative().optional(),
  dueDate: z.string().trim().optional().or(z.literal("")),
});

export const createDealVaultDealSchema = z.object({
  dealType: dealVaultDealTypeSchema,
  title: z.string().trim().min(1),
  externalRef: z.string().trim().optional().or(z.literal("")),
  propertyAddress: z.string().trim().optional().or(z.literal("")),
  propertyCity: z.string().trim().optional().or(z.literal("")),
  propertyState: z.string().trim().optional().or(z.literal("")),
  propertyZip: z.string().trim().optional().or(z.literal("")),
  sellerName: z.string().trim().optional().or(z.literal("")),
  buyerName: z.string().trim().optional().or(z.literal("")),
  leadOwner: z.string().trim().optional().or(z.literal("")),
  dispoPartner: z.string().trim().optional().or(z.literal("")),
  buyerFinder: z.string().trim().optional().or(z.literal("")),
  contractorName: z.string().trim().optional().or(z.literal("")),
  investorName: z.string().trim().optional().or(z.literal("")),
  titleCompany: z.string().trim().optional().or(z.literal("")),
  closingDate: z.string().trim().optional().or(z.literal("")),
  contractPrice: z.number().nonnegative().optional(),
  buyerPrice: z.number().nonnegative().optional(),
  assignmentFee: z.number().nonnegative().optional(),
  earnestMoney: z.number().nonnegative().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  downPayment: z.number().nonnegative().optional(),
  principalBalance: z.number().nonnegative().optional(),
  interestRate: z.number().nonnegative().optional(),
  monthlyPayment: z.number().nonnegative().optional(),
  termMonths: z.number().int().nonnegative().optional(),
  balloonDate: z.string().trim().optional().or(z.literal("")),
  firstPaymentDate: z.string().trim().optional().or(z.literal("")),
  optionFee: z.number().nonnegative().optional(),
  monthlyRent: z.number().nonnegative().optional(),
  rentCredit: z.number().nonnegative().optional(),
  optionExpiration: z.string().trim().optional().or(z.literal("")),
  referralSource: z.string().trim().optional().or(z.literal("")),
  expectedFee: z.number().nonnegative().optional(),
  referralPercentage: z.number().nonnegative().max(100).optional(),
  totalProjectBudget: z.number().nonnegative().optional(),
  scopeSummary: z.string().trim().optional().or(z.literal("")),
  splits: z.array(dealVaultSplitSchema).default([]),
  milestones: z.array(dealVaultMilestoneSchema).default([]),
}).superRefine((value, ctx) => {
  const totalBps = value.splits.reduce((sum, split) => sum + split.bps, 0);
  if (totalBps > 10000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payout splits cannot exceed 10000 bps (100%).",
      path: ["splits"],
    });
  }
});

export type CreateDealVaultDealInput = z.infer<typeof createDealVaultDealSchema>;

export const createDealVaultProofSchema = z.object({
  realEstateDealId: z.string().uuid().optional(),
  proofType: dealVaultProofTypeSchema,
  title: z.string().trim().min(1),
  fileUrl: z.string().trim().url().optional().or(z.literal("")),
  documentHash: z.string().trim().optional().or(z.literal("")),
}).superRefine((value, ctx) => {
  if (!value.documentHash?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide a document hash.",
      path: ["documentHash"],
    });
  }

  if (value.documentHash?.trim() && !/^(0x)?[0-9a-fA-F]{64}$/.test(value.documentHash.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Document hash must be a SHA-256 hex value.",
      path: ["documentHash"],
    });
  }
});

export const updateDealVaultStatusSchema = z.object({
  realEstateDealId: z.string().uuid(),
  newStatus: z.enum([
    "draft",
    "active",
    "under_contract",
    "locked",
    "closed",
    "cancelled",
    "disputed",
  ]),
  note: z.string().trim().optional().or(z.literal("")),
});

export const attachDealVaultProofSchema = z.object({
  realEstateDealId: z.string().uuid(),
  proofId: z.string().uuid(),
});

export const createDealVaultPayoutSplitSchema = z.object({
  realEstateDealId: z.string().uuid(),
  split: dealVaultSplitSchema,
});

export const markDealVaultSplitPaidSchema = z.object({
  splitId: z.string().uuid(),
  paid: z.boolean().default(true),
});

export const lockDealVaultPayoutsSchema = z.object({
  realEstateDealId: z.string().uuid(),
});

export const createDealVaultMilestoneSchema = z.object({
  realEstateDealId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  projectTitle: z.string().trim().optional().or(z.literal("")),
  projectType: dealVaultDealTypeSchema.optional().or(z.literal("")),
  totalAmount: z.number().nonnegative().optional(),
  milestone: dealVaultMilestoneSchema,
});

export const updateDealVaultMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
  status: dealVaultMilestoneStatusSchema,
  proofId: z.string().trim().optional().or(z.literal("")),
});
