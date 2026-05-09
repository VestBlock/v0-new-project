import { NextRequest, NextResponse } from "next/server";
import { generateDealVaultCertificatePdf } from "@/lib/dealvault/certificates";
import { getDealVaultAdmin, requireDealVaultUser } from "@/lib/dealvault/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireDealVaultUser();
  if (auth.error || !auth.user) return auth.error!;

  const json = await request.json().catch(() => null);
  const proofId = typeof json?.proofId === "string" ? json.proofId : "";

  if (!proofId) {
    return NextResponse.json({ error: "proofId is required." }, { status: 400 });
  }

  const admin = getDealVaultAdmin();
  const { data: proof, error } = await admin
    .from("real_estate_deal_proofs")
    .select("id,real_estate_deal_id,proof_id,document_type,title,document_hash,blockchain_tx_hash,blockchain_network,contract_address,status,created_at")
    .eq("id", proofId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!proof) {
    return NextResponse.json({ error: "Proof not found." }, { status: 404 });
  }

  let dealType: string | null = null;
  let propertyHash: string | null = null;
  if (proof.real_estate_deal_id) {
    const { data: deal } = await admin
      .from("real_estate_deals")
      .select("deal_type,property_hash")
      .eq("id", proof.real_estate_deal_id)
      .maybeSingle();

    dealType = deal?.deal_type ?? null;
    propertyHash = deal?.property_hash ?? null;
  }

  const pdf = await generateDealVaultCertificatePdf({
    certificateId: proof.id,
    dealId: proof.real_estate_deal_id,
    proofId: proof.proof_id || proof.id,
    dealType,
    documentHash: proof.document_hash,
    propertyHash,
    createdAt: proof.created_at,
    blockchainNetwork: proof.blockchain_network,
    contractAddress: proof.contract_address,
    transactionHash: proof.blockchain_tx_hash,
    verificationStatus: proof.status,
  });

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dealvault-certificate-${proof.id}.pdf"`,
    },
  });
}
