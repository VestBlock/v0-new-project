import { getDealVaultContractAddresses, getDealVaultChain, type DealVaultChainConfig } from "@/lib/blockchain/chains";
import type { DealVaultDealStatus, DealVaultDealType, DealVaultProofStatus } from "@/lib/dealvault/types";
import { createAdminClient } from "@/lib/supabase/admin";

type DealVaultAdminClient = ReturnType<typeof createAdminClient>;

const ZERO_BYTES32 = `0x${"0".repeat(64)}` as const;

export function ensureBytes32Hex(value?: string | null, fallback: `0x${string}` = ZERO_BYTES32) {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    return fallback;
  }

  return `0x${normalized}` as `0x${string}`;
}

export function dealTypeToChainCode(value: DealVaultDealType): number {
  switch (value) {
    case "wholesale_assignment":
      return 0;
    case "jv_split":
      return 1;
    case "contractor_rehab":
      return 2;
    case "seller_finance":
      return 3;
    case "rent_to_own":
      return 4;
    case "real_estate_referral":
      return 5;
    default:
      return 6;
  }
}

export function dealStatusToChainCode(value: DealVaultDealStatus): number {
  switch (value) {
    case "draft":
      return 0;
    case "active":
      return 1;
    case "under_contract":
      return 2;
    case "locked":
      return 3;
    case "closed":
      return 4;
    case "cancelled":
      return 5;
    case "disputed":
      return 6;
    default:
      return 0;
  }
}

export function proofStatusToChainCode(value: DealVaultProofStatus): number {
  switch (value) {
    case "pending":
      return 0;
    case "active":
      return 1;
    case "revoked":
      return 2;
    case "superseded":
      return 3;
    case "failed":
      return 4;
    default:
      return 0;
  }
}

export function getDealVaultChainContext() {
  const configured = Boolean(
    (process.env.DEALVAULT_BLOCKCHAIN_RPC_URL || process.env.BLOCKCHAIN_RPC_URL) &&
      (process.env.DEALVAULT_BLOCKCHAIN_ADMIN_PRIVATE_KEY ||
        process.env.BLOCKCHAIN_ADMIN_PRIVATE_KEY)
  );

  const chain = configured ? getDealVaultChain() : null;
  const addresses = getDealVaultContractAddresses();

  return { configured, chain, addresses };
}

export function hasDealVaultContractAddress(address?: string | null) {
  return Boolean(address && /^0x[a-fA-F0-9]{40}$/.test(address));
}

export function preferredChainLabel(chain: DealVaultChainConfig | null) {
  return chain?.slug || process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || null;
}

export async function logDealVaultAuditEvent(
  admin: DealVaultAdminClient,
  input: {
    userId?: string | null;
    actorEmail?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
  }
) {
  await admin.from("dealvault_audit_logs").insert({
    user_id: input.userId || null,
    actor_email: input.actorEmail || null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    metadata: input.metadata || {},
    ip_address: input.ipAddress || null,
  });
}

export async function logDealVaultBlockchainTransaction(
  admin: DealVaultAdminClient,
  input: {
    userId?: string | null;
    relatedTable: string;
    relatedId?: string | null;
    txHash?: string | null;
    contractAddress?: string | null;
    methodName: string;
    status: "submitted" | "failed";
    errorMessage?: string | null;
  }
) {
  const chain = getDealVaultChainContext().chain;

  await admin.from("dealvault_blockchain_transactions").insert({
    user_id: input.userId || null,
    related_table: input.relatedTable,
    related_id: input.relatedId || null,
    tx_hash: input.txHash || null,
    chain_id: chain?.id ?? null,
    network: preferredChainLabel(chain),
    contract_address: input.contractAddress || null,
    method_name: input.methodName,
    status: input.status,
    error_message: input.errorMessage || null,
    confirmed_at: input.status === "submitted" && input.txHash ? new Date().toISOString() : null,
  });
}

export async function logDealVaultStatusEvent(
  admin: DealVaultAdminClient,
  input: {
    dealId: string;
    previousStatus?: string | null;
    newStatus: string;
    note?: string | null;
    createdBy?: string | null;
    blockchainTxHash?: string | null;
  }
) {
  await admin.from("real_estate_status_events").insert({
    real_estate_deal_id: input.dealId,
    previous_status: input.previousStatus || null,
    new_status: input.newStatus,
    note: input.note || null,
    blockchain_tx_hash: input.blockchainTxHash || null,
    created_by: input.createdBy || null,
  });
}
