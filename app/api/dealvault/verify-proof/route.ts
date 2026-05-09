import { NextRequest, NextResponse } from "next/server";
import { verifyProofOnChain } from "@/lib/blockchain/proofVault";
import { ensureBytes32Hex, getDealVaultChainContext, hasDealVaultContractAddress } from "@/lib/dealvault/activity";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const proofId = typeof json?.proofId === "string" ? json.proofId.trim() : "";
  const documentHash =
    typeof json?.documentHash === "string" ? json.documentHash.trim().toLowerCase().replace(/^0x/, "") : "";

  if (!proofId || !documentHash) {
    return NextResponse.json(
      { error: "proofId and documentHash are required." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const chainContext = getDealVaultChainContext();
  const { data, error } = await admin
    .from("real_estate_deal_proofs")
    .select("id,proof_id,document_hash,status,blockchain_tx_hash,blockchain_network,contract_address")
    .or(`id.eq.${proofId},proof_id.eq.${proofId}`)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Proof not found." }, { status: 404 });
  }

  const matches = data.document_hash?.toLowerCase() === documentHash;

  let onChainMatches: boolean | null = null;
  if (
    chainContext.configured &&
    hasDealVaultContractAddress(chainContext.addresses.proofVault) &&
    data.proof_id
  ) {
    try {
      onChainMatches = await verifyProofOnChain(
        ensureBytes32Hex(data.proof_id),
        ensureBytes32Hex(documentHash)
      );
    } catch {
      onChainMatches = null;
    }
  }

  return NextResponse.json({
    proof: data,
    matches,
    onChainMatches,
  });
}
