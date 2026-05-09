import { NextRequest, NextResponse } from "next/server";
import { createProofOnChain } from "@/lib/blockchain/proofVault";
import {
  ensureBytes32Hex,
  getDealVaultChainContext,
  hasDealVaultContractAddress,
  logDealVaultAuditEvent,
  logDealVaultBlockchainTransaction,
} from "@/lib/dealvault/activity";
import { buildDealVaultOpaqueReference } from "@/lib/dealvault/onChainMetadata";
import { createDealVaultProofSchema } from "@/lib/dealvault/validations";
import { getDealVaultAdmin, requireDealVaultUser } from "@/lib/dealvault/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireDealVaultUser();
  if (auth.error || !auth.user) return auth.error!;

  const json = await request.json().catch(() => null);
  const parsed = createDealVaultProofSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const documentHash = (input.documentHash || "").toLowerCase().replace(/^0x/, "");

  const admin = getDealVaultAdmin();
  const chainContext = getDealVaultChainContext();
  const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  const { data, error } = await admin
    .from("real_estate_deal_proofs")
    .insert({
      real_estate_deal_id: input.realEstateDealId || null,
      user_id: auth.user.profileId,
      proof_id: null,
      document_type: input.proofType,
      title: input.title,
      file_url: input.fileUrl || null,
      document_hash: documentHash,
      blockchain_network: process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let proof = data;
  const warnings: string[] = [];

  await logDealVaultAuditEvent(admin, {
    userId: auth.user.profileId,
    actorEmail: auth.user.email,
    action: "dealvault.proof.created",
    entityType: "real_estate_deal_proof",
    entityId: data.id,
    metadata: {
      proofType: input.proofType,
      realEstateDealId: input.realEstateDealId || null,
    },
    ipAddress,
  });

  if (chainContext.configured && hasDealVaultContractAddress(chainContext.addresses.proofVault)) {
    try {
      const createdProof = await createProofOnChain(
        ensureBytes32Hex(documentHash),
        input.proofType,
        buildDealVaultOpaqueReference("proof", data.id)
      );

      const { data: updatedProof, error: updateError } = await admin
        .from("real_estate_deal_proofs")
        .update({
          proof_id: createdProof.proofId,
          blockchain_tx_hash: createdProof.txHash,
          blockchain_network: chainContext.chain?.slug || null,
          contract_address: chainContext.addresses.proofVault,
          status: "active",
        })
        .eq("id", data.id)
        .select("*")
        .single();

      if (!updateError && updatedProof) {
        proof = updatedProof;
      }

      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_deal_proofs",
        relatedId: data.id,
        txHash: createdProof.txHash,
        contractAddress: chainContext.addresses.proofVault,
        methodName: "createProof",
        status: "submitted",
      });
    } catch (chainError) {
      const message = chainError instanceof Error ? chainError.message : "Proof anchoring failed.";
      warnings.push(message);

      await admin
        .from("real_estate_deal_proofs")
        .update({ status: "failed" })
        .eq("id", data.id);

      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "real_estate_deal_proofs",
        relatedId: data.id,
        contractAddress: chainContext.addresses.proofVault,
        methodName: "createProof",
        status: "failed",
        errorMessage: message,
      });
    }
  }

  return NextResponse.json({
    proof,
    mode:
      chainContext.configured && hasDealVaultContractAddress(chainContext.addresses.proofVault)
        ? "anchoring_attempted"
        : "local_record",
    warnings,
    message:
      chainContext.configured && hasDealVaultContractAddress(chainContext.addresses.proofVault)
        ? "Proof record created and blockchain anchoring was requested."
        : "Proof record created. Blockchain anchoring can be enabled after contract setup.",
  });
}
