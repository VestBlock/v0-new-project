import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { checkAdminAccess } from "@/lib/auth/admin";
import { isDealVaultEnabled } from "@/lib/dealvault/featureFlag";
import { getDealVaultAdmin } from "@/lib/dealvault/server";

export const dynamic = "force-dynamic";

type CountCard = {
  title: string;
  description: string;
  value: number | string;
};

export default async function AdminDealVaultPage() {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    redirect("/dashboard");
  }

  const admin = getDealVaultAdmin();
  const enabled = isDealVaultEnabled();

  let counts: CountCard[] = [
    {
      title: "Feature flag",
      description: "Current customer-facing availability.",
      value: enabled ? "Enabled" : "Disabled",
    },
    {
      title: "Deals",
      description: "Real estate records stored in DealVault.",
      value: 0,
    },
    {
      title: "Proofs",
      description: "Proof records saved for document verification.",
      value: 0,
    },
    {
      title: "Failed transactions",
      description: "Blockchain transaction logs currently marked failed.",
      value: 0,
    },
  ];

  let recentTransactions: Array<{
    id: string;
    method_name: string | null;
    related_table: string | null;
    status: string | null;
    created_at: string | null;
    tx_hash: string | null;
  }> = [];

  let recentAudit: Array<{
    id: string;
    action: string;
    entity_type: string | null;
    created_at: string | null;
  }> = [];

  try {
    const [dealsCount, proofsCount, failedTxCount, recentTxRows, recentAuditRows] = await Promise.all([
      admin.from("real_estate_deals").select("*", { count: "exact", head: true }),
      admin.from("real_estate_deal_proofs").select("*", { count: "exact", head: true }),
      admin
        .from("dealvault_blockchain_transactions")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
      admin
        .from("dealvault_blockchain_transactions")
        .select("id,method_name,related_table,status,created_at,tx_hash")
        .order("created_at", { ascending: false })
        .limit(6),
      admin
        .from("dealvault_audit_logs")
        .select("id,action,entity_type,created_at")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    counts = [
      {
        title: "Feature flag",
        description: "Current customer-facing availability.",
        value: enabled ? "Enabled" : "Disabled",
      },
      {
        title: "Deals",
        description: "Real estate records stored in DealVault.",
        value: dealsCount.count || 0,
      },
      {
        title: "Proofs",
        description: "Proof records saved for document verification.",
        value: proofsCount.count || 0,
      },
      {
        title: "Failed transactions",
        description: "Blockchain transaction logs currently marked failed.",
        value: failedTxCount.count || 0,
      },
    ];

    recentTransactions = recentTxRows.data || [];
    recentAudit = recentAuditRows.data || [];
  } catch {
    // Leave zero-state cards in place when the connected environment is incomplete.
  }

  return (
    <main className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Admin workspace</Badge>
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? "Enabled" : "Feature flag off"}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">DealVault operations</p>
          <h1 className="text-2xl font-semibold text-white">DealVault Admin</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Review module readiness, recent blockchain activity, and storage health before widening
            customer access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/blockchain">Blockchain Diagnostics</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin-panel">Admin Overview</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {counts.map((card) => (
          <Card key={card.title} className="border-slate-800 bg-slate-900/80 text-slate-50">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription className="text-slate-400">{card.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{card.value}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/80 text-slate-50">
          <CardHeader>
            <CardTitle>Recent blockchain transactions</CardTitle>
            <CardDescription className="text-slate-400">
              Latest submitted or failed transaction logs captured by the module.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTransactions.length ? (
              recentTransactions.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-800 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{item.method_name || "Unknown method"}</p>
                    <Badge variant={item.status === "failed" ? "destructive" : "outline"}>
                      {item.status || "unknown"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{item.related_table || "No related table"}</p>
                  <p className="mt-2 break-all font-mono text-xs text-slate-500">
                    {item.tx_hash || "No transaction hash"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{item.created_at || "No timestamp"}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No blockchain transactions have been logged yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80 text-slate-50">
          <CardHeader>
            <CardTitle>Recent audit events</CardTitle>
            <CardDescription className="text-slate-400">
              Most recent operator and workflow actions recorded by DealVault.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAudit.length ? (
              recentAudit.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-800 p-3">
                  <p className="font-medium">{item.action}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.entity_type || "No entity type"}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.created_at || "No timestamp"}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No DealVault audit events have been recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
