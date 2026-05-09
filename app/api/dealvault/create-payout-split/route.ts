import { NextRequest, NextResponse } from "next/server";
import { waitForDealVaultTransaction } from "@/lib/blockchain/client";
import { addPartnerPaySplitOnChain, createPartnerPayDealOnChain, getPartnerPayDealOnChain, toCents } from "@/lib/blockchain/partnerPay";
import {
  ensureBytes32Hex,
  getDealVaultChainContext,
  hasDealVaultContractAddress,
  logDealVaultAuditEvent,
  logDealVaultBlockchainTransaction,
} from "@/lib/dealvault/activity";
import { calculateSplitAmount, calculateTotalBps } from "@/lib/dealvault/dealCalculations";
import { buildDealVaultOpaqueLabel, buildDealVaultOpaqueReference } from "@/lib/dealvault/onChainMetadata";
import { createDealVaultPayoutSplitSchema } from "@/lib/dealvault/validations";
import { getDealVaultAdmin, isDealVaultAdmin, requireDealVaultUser } from "@/lib/dealvault/server";
import { withTimeout } from "@/lib/utils/async";

export const runtime = "nodejs";

async function waitForPartnerPayDealVisibility(dealId: `0x${string}`) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await getPartnerPayDealOnChain(dealId);
      return;
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireDealVaultUser();
  if (auth.error || !auth.user) return auth.error!;

  const json = await request.json().catch(() => null);
  const parsed = createDealVaultPayoutSplitSchema.safeParse(json);
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
  const { data: deal } = await admin
    .from("real_estate_deals")
    .select("id,user_id,external_ref,expected_fee,assignment_fee,buyer_price,partner_pay_deal_id")
    .eq("id", input.realEstateDealId)
    .maybeSingle();

  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (deal.user_id !== auth.user.profileId && !isDealVaultAdmin(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: existingSplits } = await admin
    .from("real_estate_payout_splits")
    .select("id,bps")
    .eq("real_estate_deal_id", input.realEstateDealId);

  const totalBps = calculateTotalBps([...(existingSplits || []), input.split]);
  if (totalBps > 10000) {
    return NextResponse.json({ error: "Total payout splits cannot exceed 100%." }, { status: 400 });
  }

  const baseAmount =
    Number(deal.assignment_fee ?? deal.expected_fee ?? deal.buyer_price ?? 0);

  const { data, error } = await admin
    .from("real_estate_payout_splits")
    .insert({
      real_estate_deal_id: input.realEstateDealId,
      user_id: auth.user.profileId,
      participant_name: input.split.participantName,
      participant_email: input.split.participantEmail || null,
      participant_role: input.split.participantRole || null,
      participant_wallet: input.split.participantWallet || null,
      bps: input.split.bps,
      amount_owed: calculateSplitAmount(baseAmount, input.split.bps),
      paid: false,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logDealVaultAuditEvent(admin, {
    userId: auth.user.profileId,
    actorEmail: auth.user.email,
    action: "dealvault.payout_split.created",
    entityType: "real_estate_payout_split",
    entityId: data.id,
    metadata: {
      realEstateDealId: input.realEstateDealId,
      bps: input.split.bps,
      participantName: input.split.participantName,
    },
    ipAddress,
  });

  const warnings: string[] = [];
  let partnerPayDealId = deal.partner_pay_deal_id;
  if (
    chainContext.configured &&
    hasDealVaultContractAddress(chainContext.addresses.partnerPay) &&
    input.split.participantWallet &&
    /^0x[a-fA-F0-9]{40}$/.test(input.split.participantWallet)
  ) {
    try {
      if (!partnerPayDealId) {
        const payoutAmount = Number(deal.assignment_fee ?? deal.expected_fee ?? deal.buyer_price ?? 0);
        const partnerPayDeal = await withTimeout(
          createPartnerPayDealOnChain(
            buildDealVaultOpaqueReference("partner-pay", deal.id),
            toCents(payoutAmount)
          ),
          30000,
          "PartnerPay createDeal"
        );

        partnerPayDealId = partnerPayDeal.dealId;

        await admin
          .from("real_estate_deals")
          .update({ partner_pay_deal_id: partnerPayDeal.dealId })
          .eq("id", input.realEstateDealId);

        await logDealVaultBlockchainTransaction(admin, {
          userId: auth.user.profileId,
          relatedTable: "real_estate_deals",
          relatedId: input.realEstateDealId,
          txHash: partnerPayDeal.txHash,
          contractAddress: chainContext.addresses.partnerPay,
          methodName: "createDeal",
          status: "submitted",
        });

        await withTimeout(
          waitForPartnerPayDealVisibility(ensureBytes32Hex(partnerPayDeal.dealId)),
          30000,
          "PartnerPay deal visibility"
        );
      }

      const splitIndex = existingSplits?.length ?? 0;
      const txHash = await withTimeout(
        addPartnerPaySplitOnChain(
          ensureBytes32Hex(partnerPayDealId),
          input.split.participantWallet as `0x${string}`,
          buildDealVaultOpaqueLabel("split", splitIndex),
          input.split.bps
        ),
        30000,
        "PartnerPay addSplit"
      );
      await withTimeout(
        waitForDealVaultTransaction(txHash),
        30000,
        "PartnerPay addSplit receipt"
      );

      await admin
        .from("real_estate_payout_splits")
        .update({ blockchain_split_index: splitIndex })
        .eq("id", data.id);

      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_payout_splits",
        relatedId: data.id,
        txHash,
        contractAddress: chainContext.addresses.partnerPay,
        methodName: "addSplit",
        status: "submitted",
      });
    } catch (chainError) {
      const message = chainError instanceof Error ? chainError.message : "On-chain payout split failed.";
      warnings.push(message);
      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_payout_splits",
        relatedId: data.id,
        contractAddress: chainContext.addresses.partnerPay,
        methodName: "addSplit",
        status: "failed",
        errorMessage: message,
      });
    }
  }

  return NextResponse.json({ split: data, warnings });
}
