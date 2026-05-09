import { NextRequest, NextResponse } from "next/server";
import { lockPartnerPayDealOnChain } from "@/lib/blockchain/partnerPay";
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
import { lockDealVaultPayoutsSchema } from "@/lib/dealvault/validations";
import { withTimeout } from "@/lib/utils/async";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireDealVaultUser();
  if (auth.error || !auth.user) return auth.error!;

  const json = await request.json().catch(() => null);
  const parsed = lockDealVaultPayoutsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = getDealVaultAdmin();
  const chainContext = getDealVaultChainContext();
  const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  const { data: deal } = await admin
    .from("real_estate_deals")
    .select("id,user_id,status,partner_pay_deal_id")
    .eq("id", parsed.data.realEstateDealId)
    .maybeSingle();

  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (deal.user_id !== auth.user.profileId && !isDealVaultAdmin(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let blockchainTxHash: string | null = null;
  const warnings: string[] = [];
  const { count: syncedSplitCount } = await admin
    .from("real_estate_payout_splits")
    .select("id", { count: "exact", head: true })
    .eq("real_estate_deal_id", parsed.data.realEstateDealId)
    .not("blockchain_split_index", "is", null);
  if (
    chainContext.configured &&
    hasDealVaultContractAddress(chainContext.addresses.partnerPay) &&
    deal.partner_pay_deal_id &&
    (syncedSplitCount ?? 0) > 0
  ) {
    try {
      blockchainTxHash = await withTimeout(
        lockPartnerPayDealOnChain(ensureBytes32Hex(deal.partner_pay_deal_id)),
        30000,
        "PartnerPay lockDeal"
      );
      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_deals",
        relatedId: parsed.data.realEstateDealId,
        txHash: blockchainTxHash,
        contractAddress: chainContext.addresses.partnerPay,
        methodName: "lockDeal",
        status: "submitted",
      });
    } catch (chainError) {
      const message = chainError instanceof Error ? chainError.message : "On-chain payout lock failed.";
      warnings.push(message);
      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_deals",
        relatedId: parsed.data.realEstateDealId,
        contractAddress: chainContext.addresses.partnerPay,
        methodName: "lockDeal",
        status: "failed",
        errorMessage: message,
        });
    }
  } else if (
    chainContext.configured &&
    hasDealVaultContractAddress(chainContext.addresses.partnerPay) &&
    deal.partner_pay_deal_id
  ) {
    warnings.push("Payout lock was applied off-chain only because no payout splits have been synced on-chain yet.");
  }

  const { data, error } = await admin
    .from("real_estate_deals")
    .update({ status: "locked", blockchain_tx_hash: blockchainTxHash || undefined })
    .eq("id", parsed.data.realEstateDealId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logDealVaultStatusEvent(admin, {
    dealId: parsed.data.realEstateDealId,
    previousStatus: deal.status,
    newStatus: "locked",
    note: "Payout terms locked.",
    createdBy: auth.user.profileId,
    blockchainTxHash,
  });

  await logDealVaultAuditEvent(admin, {
    userId: auth.user.profileId,
    actorEmail: auth.user.email,
    action: "dealvault.payouts.locked",
    entityType: "real_estate_deal",
    entityId: parsed.data.realEstateDealId,
    metadata: {
      previousStatus: deal.status,
      newStatus: "locked",
      chainStatusCode: dealStatusToChainCode("locked"),
    },
    ipAddress,
  });

  return NextResponse.json({ deal: data, warnings });
}
