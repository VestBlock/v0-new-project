import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isDealVaultEnabled } from "@/lib/dealvault/featureFlag";
import { getServerAccessContext } from "@/lib/auth/access-server";
import { getDealVaultAdmin } from "@/lib/dealvault/server";
import { getDealVaultUser } from "@/lib/dealvault/auth";

const quickLinks = [
  {
    title: "New Real Estate Deal",
    description: "Create a proof-backed deal record for real estate workflows.",
    href: "/dashboard/dealvault/new",
  },
  {
    title: "Proof Vault",
    description: "Store document hashes and generate verification certificates.",
    href: "/dashboard/dealvault/proof-vault",
  },
  {
    title: "PartnerPay",
    description: "Track referral and JV split ledgers without moving funds on-chain.",
    href: "/dashboard/dealvault/partner-pay",
  },
  {
    title: "Milestone Vault",
    description: "Track rehab and contractor milestones with proof references.",
    href: "/dashboard/dealvault/milestone-vault",
  },
];

export default async function DealVaultDashboardPage() {
  const context = await getServerAccessContext();
  if (!context) {
    redirect("/login?redirect=/dashboard/dealvault");
  }

  const enabled = isDealVaultEnabled();
  const dealVaultUser = await getDealVaultUser();
  const admin = getDealVaultAdmin();

  let stats = {
    deals: 0,
    proofs: 0,
    pendingPayouts: 0,
    milestones: 0,
  };
  let recentDeals: Array<{ id: string; title: string | null; status: string | null; created_at: string }> = [];

  if (dealVaultUser?.profileId) {
    try {
      const [dealsCount, proofsCount, payoutCount, milestonesCount, dealsList] = await Promise.all([
        admin.from("real_estate_deals").select("*", { count: "exact", head: true }).eq("user_id", dealVaultUser.profileId),
        admin.from("real_estate_deal_proofs").select("*", { count: "exact", head: true }).eq("user_id", dealVaultUser.profileId),
        admin.from("real_estate_payout_splits").select("*", { count: "exact", head: true }).eq("user_id", dealVaultUser.profileId).eq("paid", false),
        admin.from("dealvault_milestone_projects").select("*", { count: "exact", head: true }).eq("user_id", dealVaultUser.profileId),
        admin
          .from("real_estate_deals")
          .select("id,title,status,created_at")
          .eq("user_id", dealVaultUser.profileId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      stats = {
        deals: dealsCount.count || 0,
        proofs: proofsCount.count || 0,
        pendingPayouts: payoutCount.count || 0,
        milestones: milestonesCount.count || 0,
      };
      recentDeals = (dealsList.data as typeof recentDeals) || [];
    } catch {
      // Tables may not exist yet in the connected environment.
    }
  }

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="outline">DealVault by VestBlock</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Blockchain-backed deal records</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            DealVault tracks proofs, payout ledgers, and milestone timelines while keeping sensitive
            property details and private documents off-chain.
          </p>
        </div>
        <Badge variant={enabled ? "default" : "secondary"}>
          {enabled ? "Enabled" : "Feature flag off"}
        </Badge>
      </div>

      {!enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>DealVault is not enabled</CardTitle>
            <CardDescription>
              The module is installed behind a feature flag so it can be verified safely before
              rollout.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Set <code>NEXT_PUBLIC_ENABLE_DEALVAULT=true</code> after the schema, API routes, and
            contract setup are verified.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Deals</CardTitle>
            <CardDescription>Real estate agreements tracked in DealVault.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.deals}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Proof Records</CardTitle>
            <CardDescription>Document hashes and verification certificates.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.proofs}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending Payouts</CardTitle>
            <CardDescription>Ledger-tracked payouts awaiting off-chain settlement.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.pendingPayouts}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
            <CardDescription>Contractor or rehab milestones under management.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.milestones}</CardContent>
        </Card>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {quickLinks.map((item) => (
          <Card key={item.href}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={item.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent deals</CardTitle>
          <CardDescription>Your most recent DealVault records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentDeals.length ? (
            recentDeals.map((deal) => (
              <div key={deal.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{deal.title || "Untitled deal"}</p>
                  <p className="text-sm text-muted-foreground">{deal.status || "draft"}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/dealvault/${deal.id}`}>Open</Link>
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No deals yet. Use the create route or upcoming form flow to add the first DealVault
              record.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Important disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          DealVault helps track and prove agreement records. It does not replace legal counsel,
          licensed title services, escrow services, brokerage compliance, or required real estate
          professionals.
        </CardContent>
      </Card>
    </main>
  );
}
