import { NextRequest, NextResponse } from "next/server";
import { attachDealVaultProofOnChain } from "@/lib/blockchain/dealVaultRealEstate";
import {
  ensureBytes32Hex,
  getDealVaultChainContext,
  hasDealVaultContractAddress,
  logDealVaultAuditEvent,
  logDealVaultBlockchainTransaction,
} from "@/lib/dealvault/activity";
import { attachDealVaultProofSchema } from "@/lib/dealvault/validations";
import { getDealVaultAdmin, isDealVaultAdmin, requireDealVaultUser } from "@/lib/dealvault/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireDealVaultUser();
  if (auth.error || !auth.user) return auth.error!;

  const json = await request.json().catch(() => null);
  const parsed = attachDealVaultProofSchema.safeParse(json);
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
    .select("id,user_id,deal_id")
    .eq("id", input.realEstateDealId)
    .maybeSingle();

  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (deal.user_id !== auth.user.profileId && !isDealVaultAdmin(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: proofBeforeAttach } = await admin
    .from("real_estate_deal_proofs")
    .select("id,proof_id")
    .eq("id", input.proofId)
    .maybeSingle();

  if (!proofBeforeAttach) {
    return NextResponse.json({ error: "Proof not found." }, { status: 404 });
  }

  const { data, error } = await admin
    .from("real_estate_deal_proofs")
    .update({ real_estate_deal_id: input.realEstateDealId })
    .eq("id", input.proofId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logDealVaultAuditEvent(admin, {
    userId: auth.user.profileId,
    actorEmail: auth.user.email,
    action: "dealvault.proof.attached",
    entityType: "real_estate_deal_proof",
    entityId: data.id,
    metadata: {
      realEstateDealId: input.realEstateDealId,
    },
    ipAddress,
  });

  const warnings: string[] = [];
  if (
    chainContext.configured &&
    hasDealVaultContractAddress(chainContext.addresses.dealVaultRealEstate) &&
    deal.deal_id &&
    proofBeforeAttach.proof_id
  ) {
    try {
      const txHash = await attachDealVaultProofOnChain(
        ensureBytes32Hex(deal.deal_id),
        ensureBytes32Hex(proofBeforeAttach.proof_id)
      );

      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_deal_proofs",
        relatedId: data.id,
        txHash,
        contractAddress: chainContext.addresses.dealVaultRealEstate,
        methodName: "attachProof",
        status: "submitted",
      });
    } catch (chainError) {
      const message = chainError instanceof Error ? chainError.message : "On-chain proof attach failed.";
      warnings.push(message);
      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_deal_proofs",
        relatedId: data.id,
        contractAddress: chainContext.addresses.dealVaultRealEstate,
        methodName: "attachProof",
        status: "failed",
        errorMessage: message,
      });
    }
  }

  return NextResponse.json({ proof: data, warnings });
}
