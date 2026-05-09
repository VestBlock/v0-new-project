import { checkAdminAccess } from "@/lib/auth/admin";
import { isDealVaultEnabled } from "@/lib/dealvault/featureFlag";
import { getDealVaultAdmin, isDealVaultBlockchainConfigured } from "@/lib/dealvault/server";
import { getDealVaultDeploymentArtifacts, getDealVaultOperationalSnapshot } from "@/lib/dealvault/ops";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await checkAdminAccess();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const network = process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || null;
  const env = {
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID || null,
    network,
    rpcConfigured: Boolean(process.env.DEALVAULT_BLOCKCHAIN_RPC_URL || process.env.BLOCKCHAIN_RPC_URL),
    adminKeyConfigured: Boolean(
      process.env.DEALVAULT_BLOCKCHAIN_ADMIN_PRIVATE_KEY || process.env.BLOCKCHAIN_ADMIN_PRIVATE_KEY
    ),
    dealVaultRealEstateAddress: process.env.NEXT_PUBLIC_DEALVAULT_REAL_ESTATE_ADDRESS || null,
    proofVaultAddress:
      process.env.NEXT_PUBLIC_PROOF_VAULT_ADDRESS || process.env.NEXT_PUBLIC_DEALVAULT_PROOF_VAULT_ADDRESS || null,
    partnerPayAddress:
      process.env.NEXT_PUBLIC_PARTNER_PAY_ADDRESS || process.env.NEXT_PUBLIC_DEALVAULT_PARTNER_PAY_ADDRESS || null,
    milestoneVaultAddress:
      process.env.NEXT_PUBLIC_MILESTONE_VAULT_ADDRESS ||
      process.env.NEXT_PUBLIC_DEALVAULT_MILESTONE_VAULT_ADDRESS ||
      null,
    adminAddress: process.env.DEALVAULT_ADMIN_ADDRESS || null,
  };

  const contractAddressMap = {
    dealVaultRealEstate: env.dealVaultRealEstateAddress,
    proofVault: env.proofVaultAddress,
    partnerPay: env.partnerPayAddress,
    milestoneVault: env.milestoneVaultAddress,
  };

  const missingContracts = Object.entries(contractAddressMap)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const artifacts = await getDealVaultDeploymentArtifacts(network);

  let operations = null;
  let databaseReachable = false;
  let databaseError: string | null = null;

  try {
    operations = await getDealVaultOperationalSnapshot(getDealVaultAdmin());
    databaseReachable = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Database health check failed.";
  }

  return NextResponse.json({
    module: "dealvault",
    enabled: isDealVaultEnabled(),
    readiness: {
      featureFlagEnabled: isDealVaultEnabled(),
      blockchainConfigured: isDealVaultBlockchainConfigured(),
      contractsConfigured: missingContracts.length === 0,
      missingContracts,
      databaseReachable,
      deploymentArtifactFound: Boolean(artifacts.deployment),
      smokeArtifactFound: Boolean(artifacts.smoke),
    },
    env,
    artifacts: {
      deploymentPath: artifacts.deploymentPath,
      smokePath: artifacts.smokePath,
      deploymentRecordedAt: artifacts.deployment?.deployedAt || null,
      smokeRecordedAt: artifacts.smoke?.executedAt || null,
    },
    operations,
    databaseError,
  });
}
