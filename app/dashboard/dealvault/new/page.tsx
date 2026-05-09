import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dealVaultTemplates } from "@/lib/dealvault/dealTemplates";
import { isDealVaultEnabled } from "@/lib/dealvault/featureFlag";
import { getServerAccessContext } from "@/lib/auth/access-server";
import { CreateDealVaultDealForm } from "@/components/dealvault/create-dealvault-deal-form";

export default async function DealVaultNewDealPage() {
  const context = await getServerAccessContext();
  if (!context) {
    redirect("/login?redirect=/dashboard/dealvault/new");
  }

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="space-y-2">
        <Badge variant="outline">Deal templates</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Create a new DealVault record</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          The template system is installed first so the final form and API wiring can stay
          consistent across wholesaling, JV splits, seller finance, referrals, and rehab projects.
        </p>
      </div>

      {!isDealVaultEnabled() ? (
        <Card>
          <CardHeader>
            <CardTitle>Feature flag off</CardTitle>
            <CardDescription>
              The create-deal workflow is present but intentionally hidden from production usage
              until the module is fully verified.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dealVaultTemplates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle>{template.label}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Required fields: {template.requiredFields.length}</p>
              <p>Payout splits: {template.supportsPayoutSplits ? "Supported" : "Not required"}</p>
              <p>Milestones: {template.supportsMilestones ? "Supported" : "Not required"}</p>
              <p>Proof records: {template.supportsProofs ? "Supported" : "Not required"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateDealVaultDealForm />
    </main>
  );
}
