import { NextRequest, NextResponse } from "next/server";
import { waitForDealVaultTransaction } from "@/lib/blockchain/client";
import { updateDealVaultDealStatusOnChain } from "@/lib/blockchain/dealVaultRealEstate";
import {
  dealStatusToChainCode,
  ensureBytes32Hex,
  getDealVaultChainContext,
  hasDealVaultContractAddress,
  logDealVaultAuditEvent,
  logDealVaultBlockchainTransaction,
  logDealVaultStatusEvent,
} from "@/lib/dealvault/activity";
import { getDealVaultAdmin, isDealVaultAdmin, requireDealVaultUser } from "@/lib/dealvault/server";
import { updateDealVaultStatusSchema } from "@/lib/dealvault/validations";
import { withTimeout } from "@/lib/utils/async";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireDealVaultUser();
  if (auth.error || !auth.user) return auth.error!;

  const json = await request.json().catch(() => null);
  const parsed = updateDealVaultStatusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const admin = getDealVaultAdmin();
  const chainContext = getDealVaultChainContext();
  const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  const { data: existing, error: readError } = await admin
    .from("real_estate_deals")
    .select("id,user_id,status,deal_id")
    .eq("id", input.realEstateDealId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (existing.user_id !== auth.user.profileId && !isDealVaultAdmin(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let blockchainTxHash: string | null = null;
  const warnings: string[] = [];
  if (
    chainContext.configured &&
    hasDealVaultContractAddress(chainContext.addresses.dealVaultRealEstate) &&
    existing.deal_id
  ) {
    try {
      blockchainTxHash = await withTimeout(
        updateDealVaultDealStatusOnChain(
          ensureBytes32Hex(existing.deal_id),
          dealStatusToChainCode(input.newStatus)
        ),
        30000,
        "DealVault updateDealStatus"
      );
      await withTimeout(
        waitForDealVaultTransaction(blockchainTxHash as `0x${string}`),
        30000,
        "DealVault updateDealStatus receipt"
      );

      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_deals",
        relatedId: input.realEstateDealId,
        txHash: blockchainTxHash,
        contractAddress: chainContext.addresses.dealVaultRealEstate,
        methodName: "updateDealStatus",
        status: "submitted",
      });
    } catch (chainError) {
      const message =
        chainError instanceof Error ? chainError.message : "On-chain status update failed.";
      warnings.push(message);
      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_deals",
        relatedId: input.realEstateDealId,
        contractAddress: chainContext.addresses.dealVaultRealEstate,
        methodName: "updateDealStatus",
        status: "failed",
        errorMessage: message,
      });
    }
  }

  const { data, error } = await admin
    .from("real_estate_deals")
    .update({
      status: input.newStatus,
      blockchain_tx_hash: blockchainTxHash || undefined,
    })
    .eq("id", input.realEstateDealId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logDealVaultStatusEvent(admin, {
    dealId: input.realEstateDealId,
    previousStatus: existing.status,
    newStatus: input.newStatus,
    note: input.note || null,
    createdBy: auth.user.profileId,
    blockchainTxHash,
  });

  await logDealVaultAuditEvent(admin, {
    userId: auth.user.profileId,
    actorEmail: auth.user.email,
    action: "dealvault.deal.status_updated",
    entityType: "real_estate_deal",
    entityId: input.realEstateDealId,
    metadata: {
      previousStatus: existing.status,
      newStatus: input.newStatus,
      note: input.note || null,
    },
    ipAddress,
  });

  return NextResponse.json({ deal: data, warnings });
}
