import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDealVaultAdmin } from "@/lib/dealvault/server";
import { getDealVaultUser } from "@/lib/dealvault/auth";

export default async function DealVaultPartnerPayPage() {
  const user = await getDealVaultUser();
  const admin = getDealVaultAdmin();
  let splits: Array<{ id: string; participant_name: string; bps: number; paid: boolean; amount_owed: number | null }> = [];

  if (user?.profileId) {
    try {
      const { data } = await admin
        .from("real_estate_payout_splits")
        .select("id,participant_name,bps,paid,amount_owed")
        .eq("user_id", user.profileId)
        .order("created_at", { ascending: false })
        .limit(10);
      splits = (data as typeof splits) || [];
    } catch {
      // ignore until schema is applied
    }
  }

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="space-y-2">
        <Badge variant="outline">PartnerPay</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Payout split ledger</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Track referral fees, JV splits, and off-chain payment confirmations without exposing users
          to crypto-native complexity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ledger-first rollout</CardTitle>
          <CardDescription>
            DealVault will stay in ledger-only mode until payment-rail adapters are verified and the
            kill switch remains intentionally engaged.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Next wiring steps: deal list queries, split forms, status transitions, and admin payment
          marking flows.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent payout splits</CardTitle>
          <CardDescription>Latest payout ledger entries for your DealVault records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {splits.length ? (
            splits.map((split) => (
              <div key={split.id} className="rounded-lg border p-3">
                <p className="font-medium">{split.participant_name}</p>
                <p className="text-sm text-muted-foreground">
                  {split.bps} bps · {split.amount_owed ?? 0} · {split.paid ? "Paid" : "Pending"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No payout splits found yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
