import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";

type DealVaultAdminClient = ReturnType<typeof createAdminClient>;

export type DealVaultDeploymentRecord = {
  network: string;
  chainId: number;
  deployer: string;
  adminAddress: string;
  deployedAt: string;
  contracts: {
    dealVaultRealEstate: string;
    proofVault: string;
    partnerPay: string;
    milestoneVault: string;
  };
};

export type DealVaultSmokeRecord = {
  network: string;
  chainId: number;
  signer: string;
  executedAt: string;
  dealVault: {
    dealId: string;
    propertyHash: string;
    proofId: string;
  };
  partnerPay: {
    dealId: string;
  };
  milestoneVault: {
    projectId: string;
  };
};

export type DealVaultOpsSnapshot = {
  windowHours: number;
  recentTransactionCount: number;
  recentFailureCount: number;
  unconfirmedTransactionCount: number;
  recentFailures: Array<{
    id: string;
    method_name: string | null;
    related_table: string | null;
    status: string | null;
    created_at: string | null;
    tx_hash: string | null;
    error_message: string | null;
  }>;
  latestAuditEvent: {
    id: string;
    action: string;
    entity_type: string | null;
    created_at: string | null;
  } | null;
};

const NETWORK_FILE_MAP: Record<string, string> = {
  "base-sepolia": "baseSepolia",
  "polygon-amoy": "amoy",
};

type DealVaultDeploymentRecordLike =
  | DealVaultDeploymentRecord
  | {
      network?: string;
      chainId?: number;
      deployer?: string;
      adminAddress?: string;
      deployedAt?: string;
      contracts?: Partial<DealVaultDeploymentRecord["contracts"]>;
      dealVaultRealEstate?: string;
      proofVault?: string;
      partnerPay?: string;
      milestoneVault?: string;
    };

type DealVaultFlatDeploymentRecord = Extract<
  DealVaultDeploymentRecordLike,
  {
    dealVaultRealEstate?: string;
    proofVault?: string;
    partnerPay?: string;
    milestoneVault?: string;
  }
>;

async function readJsonFile<T>(filePath: string) {
  try {
    const file = await readFile(filePath, "utf8");
    return JSON.parse(file) as T;
  } catch {
    return null;
  }
}

function normalizeDeploymentRecord(
  deployment: DealVaultDeploymentRecordLike | null
): DealVaultDeploymentRecord | null {
  if (!deployment || typeof deployment !== "object") {
    return null;
  }

  const flatDeployment = deployment as DealVaultFlatDeploymentRecord;
  const nestedContracts = deployment.contracts || {};
  const dealVaultRealEstate =
    nestedContracts.dealVaultRealEstate || flatDeployment.dealVaultRealEstate || "";
  const proofVault = nestedContracts.proofVault || flatDeployment.proofVault || "";
  const partnerPay = nestedContracts.partnerPay || flatDeployment.partnerPay || "";
  const milestoneVault = nestedContracts.milestoneVault || flatDeployment.milestoneVault || "";

  return {
    network: deployment.network || "unknown",
    chainId: Number(deployment.chainId || 0),
    deployer: deployment.deployer || "",
    adminAddress: deployment.adminAddress || deployment.deployer || "",
    deployedAt: deployment.deployedAt || "",
    contracts: {
      dealVaultRealEstate,
      proofVault,
      partnerPay,
      milestoneVault,
    },
  };
}

export function getDealVaultExplorerBaseUrl(network: string | null) {
  switch (network) {
    case "base":
      return "https://basescan.org/address/";
    case "base-sepolia":
      return "https://sepolia.basescan.org/address/";
    case "polygon":
      return "https://polygonscan.com/address/";
    case "polygon-amoy":
      return "https://amoy.polygonscan.com/address/";
    default:
      return null;
  }
}

export async function getDealVaultDeploymentArtifacts(network: string | null) {
  const networkFile = network ? NETWORK_FILE_MAP[network] || network : null;
  const deploymentPath = networkFile ? path.join(process.cwd(), "deployments", `${networkFile}.json`) : null;
  const smokePath = networkFile ? path.join(process.cwd(), "deployments", `${networkFile}.smoke.json`) : null;

  const [deploymentRaw, smoke] = await Promise.all([
    deploymentPath ? readJsonFile<DealVaultDeploymentRecordLike>(deploymentPath) : Promise.resolve(null),
    smokePath ? readJsonFile<DealVaultSmokeRecord>(smokePath) : Promise.resolve(null),
  ]);
  const deployment = normalizeDeploymentRecord(deploymentRaw);

  return {
    deploymentPath,
    smokePath,
    deployment,
    smoke,
  };
}

export async function getDealVaultOperationalSnapshot(
  admin: DealVaultAdminClient,
  windowHours = 24
): Promise<DealVaultOpsSnapshot> {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  const [recentTransactions, recentFailures, unconfirmedTransactions, failureRows, latestAuditRows] =
    await Promise.all([
      admin
        .from("dealvault_blockchain_transactions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", cutoff),
      admin
        .from("dealvault_blockchain_transactions")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", cutoff),
      admin
        .from("dealvault_blockchain_transactions")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted")
        .is("confirmed_at", null),
      admin
        .from("dealvault_blockchain_transactions")
        .select("id,method_name,related_table,status,created_at,tx_hash,error_message")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("dealvault_audit_logs")
        .select("id,action,entity_type,created_at")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

  return {
    windowHours,
    recentTransactionCount: recentTransactions.count || 0,
    recentFailureCount: recentFailures.count || 0,
    unconfirmedTransactionCount: unconfirmedTransactions.count || 0,
    recentFailures: failureRows.data || [],
    latestAuditEvent: latestAuditRows.data?.[0] || null,
  };
}
