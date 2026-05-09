import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDealVaultAdmin } from "@/lib/dealvault/server";
import { getDealVaultUser } from "@/lib/dealvault/auth";
import { CreateDealVaultProofForm } from "@/components/dealvault/create-dealvault-proof-form";
import { DealVaultCertificateButton } from "@/components/dealvault/dealvault-certificate-button";

export default async function DealVaultProofVaultPage() {
  const user = await getDealVaultUser();
  const admin = getDealVaultAdmin();
  let proofs: Array<{ id: string; title: string | null; document_type: string | null; status: string | null }> = [];

  if (user?.profileId) {
    try {
      const { data } = await admin
        .from("real_estate_deal_proofs")
        .select("id,title,document_type,status")
        .eq("user_id", user.profileId)
        .order("created_at", { ascending: false })
        .limit(10);
      proofs = (data as typeof proofs) || [];
    } catch {
      // ignore until schema is applied
    }
  }

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="space-y-2">
        <Badge variant="outline">Proof Vault</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Document proof records</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          This page will host agreement proof records, document hash verification, and
          certificate generation tied into DealVault.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proof workflow</CardTitle>
          <CardDescription>
            The route is installed and ready for the proof list, uploader, verifier, and
            certificate components from the standalone source app.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Next wiring steps: hashed upload flow, proof table queries, certificate generation, and
          on-chain verification fallback.
        </CardContent>
      </Card>

      <CreateDealVaultProofForm />

      <Card>
        <CardHeader>
          <CardTitle>Recent proof records</CardTitle>
          <CardDescription>Off-chain records already created in DealVault.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {proofs.length ? (
            proofs.map((proof) => (
              <div key={proof.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                  <p className="font-medium">{proof.title || "Untitled proof"}</p>
                  <p className="text-sm text-muted-foreground">
                    {proof.document_type || "document"} · {proof.status || "pending"}
                  </p>
                  </div>
                  <DealVaultCertificateButton proofId={proof.id} title={proof.title} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No proof records found yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
