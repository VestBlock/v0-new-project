import { NextRequest, NextResponse } from "next/server";
import { markPartnerPaySplitPaidOnChain } from "@/lib/blockchain/partnerPay";
import {
  ensureBytes32Hex,
  getDealVaultChainContext,
  hasDealVaultContractAddress,
  logDealVaultAuditEvent,
  logDealVaultBlockchainTransaction,
} from "@/lib/dealvault/activity";
import { getDealVaultAdmin, isDealVaultAdmin, requireDealVaultUser } from "@/lib/dealvault/server";
import { markDealVaultSplitPaidSchema } from "@/lib/dealvault/validations";
import { withTimeout } from "@/lib/utils/async";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireDealVaultUser();
  if (auth.error || !auth.user) return auth.error!;

  const json = await request.json().catch(() => null);
  const parsed = markDealVaultSplitPaidSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = getDealVaultAdmin();
  const chainContext = getDealVaultChainContext();
  const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  const { data: split } = await admin
    .from("real_estate_payout_splits")
    .select("id,user_id,real_estate_deal_id,blockchain_split_index")
    .eq("id", parsed.data.splitId)
    .maybeSingle();

  if (!split) {
    return NextResponse.json({ error: "Split not found." }, { status: 404 });
  }

  if (split.user_id !== auth.user.profileId && !isDealVaultAdmin(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: deal } = await admin
    .from("real_estate_deals")
    .select("id,partner_pay_deal_id")
    .eq("id", split.real_estate_deal_id)
    .maybeSingle();

  const warnings: string[] = [];
  if (
    parsed.data.paid &&
    chainContext.configured &&
    hasDealVaultContractAddress(chainContext.addresses.partnerPay) &&
    deal?.partner_pay_deal_id &&
    typeof split.blockchain_split_index === "number"
  ) {
    try {
      const txHash = await withTimeout(
        markPartnerPaySplitPaidOnChain(
          ensureBytes32Hex(deal.partner_pay_deal_id),
          split.blockchain_split_index
        ),
        30000,
        "PartnerPay markSplitPaid"
      );

      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_payout_splits",
        relatedId: split.id,
        txHash,
        contractAddress: chainContext.addresses.partnerPay,
        methodName: "markSplitPaid",
        status: "submitted",
      });
    } catch (chainError) {
      const message = chainError instanceof Error ? chainError.message : "On-chain paid marker failed.";
      warnings.push(message);
      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_payout_splits",
        relatedId: split.id,
        contractAddress: chainContext.addresses.partnerPay,
        methodName: "markSplitPaid",
        status: "failed",
        errorMessage: message,
      });
    }
  }

  const { data, error } = await admin
    .from("real_estate_payout_splits")
    .update({
      paid: parsed.data.paid,
      paid_at: parsed.data.paid ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.splitId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logDealVaultAuditEvent(admin, {
    userId: auth.user.profileId,
    actorEmail: auth.user.email,
    action: parsed.data.paid ? "dealvault.payout_split.marked_paid" : "dealvault.payout_split.reopened",
    entityType: "real_estate_payout_split",
    entityId: split.id,
    metadata: {
      realEstateDealId: split.real_estate_deal_id,
      paid: parsed.data.paid,
    },
    ipAddress,
  });

  return NextResponse.json({ split: data, warnings });
}
