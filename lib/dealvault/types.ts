export type DealVaultDealType =
  | "wholesale_assignment"
  | "jv_split"
  | "contractor_rehab"
  | "seller_finance"
  | "rent_to_own"
  | "real_estate_referral";

export type DealVaultDealStatus =
  | "draft"
  | "active"
  | "under_contract"
  | "locked"
  | "closed"
  | "cancelled"
  | "disputed";

export type DealVaultProofStatus =
  | "pending"
  | "active"
  | "revoked"
  | "superseded"
  | "failed";

export type DealVaultMilestoneStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "disputed"
  | "completed"
  | "cancelled";

export type DealVaultPayoutRail =
  | "manual"
  | "stripe"
  | "splits"
  | "request";

export interface DealVaultRecordSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DealVaultSplitDraft {
  participantName: string;
  participantEmail?: string | null;
  participantWallet?: string | null;
  participantRole?: string | null;
  bps: number;
  amountOwed?: number | null;
}

export interface DealVaultMilestoneDraft {
  title: string;
  description?: string | null;
  amount?: number | null;
  dueDate?: string | null;
}

