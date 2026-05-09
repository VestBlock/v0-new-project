import type { DealVaultDealType } from "@/lib/dealvault/types";

export type DealVaultTemplateField =
  | "property_address"
  | "property_city"
  | "property_state"
  | "property_zip"
  | "seller_name"
  | "buyer_name"
  | "lead_owner"
  | "dispo_partner"
  | "buyer_finder"
  | "contractor_name"
  | "investor_name"
  | "title_company"
  | "closing_date"
  | "contract_price"
  | "buyer_price"
  | "assignment_fee"
  | "earnest_money"
  | "purchase_price"
  | "down_payment"
  | "principal_balance"
  | "interest_rate"
  | "monthly_payment"
  | "term_months"
  | "balloon_date"
  | "first_payment_date"
  | "option_fee"
  | "monthly_rent"
  | "rent_credit"
  | "option_expiration"
  | "referral_source"
  | "expected_fee"
  | "referral_percentage"
  | "deal_status"
  | "total_project_budget"
  | "scope_summary"
  | "upload_agreement";

export interface DealVaultTemplate {
  id: DealVaultDealType;
  label: string;
  description: string;
  fields: DealVaultTemplateField[];
  requiredFields: DealVaultTemplateField[];
  optionalFields: DealVaultTemplateField[];
  defaultStatus: string;
  supportsPayoutSplits: boolean;
  supportsMilestones: boolean;
  supportsProofs: boolean;
}

export const dealVaultTemplates: DealVaultTemplate[] = [
  {
    id: "wholesale_assignment",
    label: "Wholesale Assignment",
    description: "Track assignment deals, proofs, and fee splits.",
    fields: [
      "property_address",
      "property_city",
      "property_state",
      "property_zip",
      "seller_name",
      "buyer_name",
      "contract_price",
      "buyer_price",
      "assignment_fee",
      "earnest_money",
      "closing_date",
      "title_company",
      "upload_agreement",
    ],
    requiredFields: [
      "property_address",
      "contract_price",
      "buyer_price",
      "assignment_fee",
    ],
    optionalFields: [
      "property_city",
      "property_state",
      "property_zip",
      "seller_name",
      "buyer_name",
      "earnest_money",
      "closing_date",
      "title_company",
      "upload_agreement",
    ],
    defaultStatus: "draft",
    supportsPayoutSplits: true,
    supportsMilestones: false,
    supportsProofs: true,
  },
  {
    id: "jv_split",
    label: "JV / Co-Wholesale Split",
    description: "Track partner roles, fee percentages, and agreement proofs.",
    fields: [
      "property_address",
      "lead_owner",
      "dispo_partner",
      "buyer_finder",
      "assignment_fee",
      "upload_agreement",
    ],
    requiredFields: ["property_address", "assignment_fee"],
    optionalFields: [
      "lead_owner",
      "dispo_partner",
      "buyer_finder",
      "upload_agreement",
    ],
    defaultStatus: "draft",
    supportsPayoutSplits: true,
    supportsMilestones: false,
    supportsProofs: true,
  },
  {
    id: "contractor_rehab",
    label: "Contractor Rehab",
    description: "Track rehab projects, contractor milestones, and proof records.",
    fields: [
      "property_address",
      "investor_name",
      "contractor_name",
      "total_project_budget",
      "scope_summary",
      "upload_agreement",
    ],
    requiredFields: ["property_address", "contractor_name", "total_project_budget"],
    optionalFields: ["investor_name", "scope_summary", "upload_agreement"],
    defaultStatus: "draft",
    supportsPayoutSplits: false,
    supportsMilestones: true,
    supportsProofs: true,
  },
  {
    id: "seller_finance",
    label: "Seller Finance",
    description: "Track seller-finance terms and supporting proof records.",
    fields: [
      "property_address",
      "seller_name",
      "buyer_name",
      "purchase_price",
      "down_payment",
      "principal_balance",
      "interest_rate",
      "monthly_payment",
      "term_months",
      "balloon_date",
      "first_payment_date",
      "upload_agreement",
    ],
    requiredFields: [
      "property_address",
      "seller_name",
      "buyer_name",
      "purchase_price",
      "down_payment",
    ],
    optionalFields: [
      "principal_balance",
      "interest_rate",
      "monthly_payment",
      "term_months",
      "balloon_date",
      "first_payment_date",
      "upload_agreement",
    ],
    defaultStatus: "draft",
    supportsPayoutSplits: false,
    supportsMilestones: false,
    supportsProofs: true,
  },
  {
    id: "rent_to_own",
    label: "Rent-to-Own / Lease Option",
    description: "Track lease-option terms and proof-backed agreement records.",
    fields: [
      "property_address",
      "seller_name",
      "buyer_name",
      "purchase_price",
      "option_fee",
      "monthly_rent",
      "rent_credit",
      "option_expiration",
      "upload_agreement",
    ],
    requiredFields: ["property_address", "purchase_price", "option_fee", "monthly_rent"],
    optionalFields: [
      "seller_name",
      "buyer_name",
      "rent_credit",
      "option_expiration",
      "upload_agreement",
    ],
    defaultStatus: "draft",
    supportsPayoutSplits: false,
    supportsMilestones: false,
    supportsProofs: true,
  },
  {
    id: "real_estate_referral",
    label: "Real Estate Referral",
    description: "Track referral terms, proof records, and payout ledger entries.",
    fields: [
      "referral_source",
      "investor_name",
      "property_address",
      "expected_fee",
      "referral_percentage",
      "deal_status",
      "upload_agreement",
    ],
    requiredFields: ["referral_source", "investor_name", "expected_fee"],
    optionalFields: [
      "property_address",
      "referral_percentage",
      "deal_status",
      "upload_agreement",
    ],
    defaultStatus: "draft",
    supportsPayoutSplits: true,
    supportsMilestones: false,
    supportsProofs: true,
  },
];

export function getDealVaultTemplate(type: DealVaultDealType) {
  return dealVaultTemplates.find((template) => template.id === type) ?? null;
}

