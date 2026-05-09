import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DealVaultDealActions } from "@/components/dealvault/dealvault-deal-actions";
import { getDealVaultAdmin, isDealVaultAdmin } from "@/lib/dealvault/server";
import { getDealVaultUser } from "@/lib/dealvault/auth";
import type { DealVaultDealStatus } from "@/lib/dealvault/types";

export const dynamic = "force-dynamic";

export default async function DealVaultDealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const user = await getDealVaultUser();
  if (!user) {
    redirect("/login?redirect=/dashboard/dealvault");
  }

  const { dealId } = await params;
  const admin = getDealVaultAdmin();
  const { data: deal } = await admin
    .from("real_estate_deals")
    .select("*")
    .eq("id", dealId)
    .maybeSingle();

  if (!deal) {
    notFound();
  }

  if (deal.user_id !== user.profileId && !isDealVaultAdmin(user.role)) {
    redirect("/dashboard/dealvault");
  }

  const { data: projectRows } = await admin
    .from("dealvault_milestone_projects")
    .select("id,title,status")
    .eq("real_estate_deal_id", dealId);

  const projectIds = (projectRows || []).map((project) => project.id);

  const [proofs, splits, events, milestoneItems, availableProofs] = await Promise.all([
    admin
      .from("real_estate_deal_proofs")
      .select("id,title,document_type,status,document_hash,proof_id")
      .eq("real_estate_deal_id", dealId),
    admin
      .from("real_estate_payout_splits")
      .select("id,participant_name,bps,amount_owed,paid")
      .eq("real_estate_deal_id", dealId),
    admin
      .from("real_estate_status_events")
      .select("id,previous_status,new_status,note,created_at")
      .eq("real_estate_deal_id", dealId)
      .order("created_at", { ascending: false }),
    admin
      .from("dealvault_milestone_items")
      .select("id,milestone_project_id,title,status,proof_id")
      .in(
        "milestone_project_id",
        projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]
      ),
    admin
      .from("real_estate_deal_proofs")
      .select("id,title,proof_id,real_estate_deal_id")
      .eq("user_id", user.profileId),
  ]);

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Badge variant="outline">Deal detail</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">{deal.title || "Untitled deal"}</h1>
          <p className="text-sm text-muted-foreground">
            {deal.deal_type} · {deal.status}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/dealvault">Back to DealVault</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>{deal.status || "draft"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Property hash</CardTitle>
          </CardHeader>
          <CardContent className="break-all font-mono text-xs">{deal.property_hash || "Not generated"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Blockchain network</CardTitle>
          </CardHeader>
          <CardContent>{deal.blockchain_network || "Blockchain not configured"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transaction hash</CardTitle>
          </CardHeader>
          <CardContent className="break-all font-mono text-xs">{deal.blockchain_tx_hash || "Awaiting blockchain proof"}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Proof records</CardTitle>
            <CardDescription>Documents attached to this deal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(proofs.data || []).length ? (
              (proofs.data || []).map((proof) => (
                <div key={proof.id} className="rounded-lg border p-3">
                  <p className="font-medium">{proof.title || "Untitled proof"}</p>
                  <p className="text-sm text-muted-foreground">
                    {proof.document_type || "document"} · {proof.status || "pending"}
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                    {proof.document_hash}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No proof records attached yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payout splits</CardTitle>
            <CardDescription>Referral and JV ledger entries tied to this deal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(splits.data || []).length ? (
              (splits.data || []).map((split) => (
                <div key={split.id} className="rounded-lg border p-3">
                  <p className="font-medium">{split.participant_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {split.bps} bps · {split.amount_owed ?? 0} · {split.paid ? "Paid" : "Pending"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No payout splits attached yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status timeline</CardTitle>
            <CardDescription>Recorded status changes for this deal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(events.data || []).length ? (
              (events.data || []).map((event) => (
                <div key={event.id} className="rounded-lg border p-3">
                  <p className="font-medium">
                    {event.previous_status || "none"} → {event.new_status}
                  </p>
                  <p className="text-sm text-muted-foreground">{event.note || "No note"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.created_at}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No status events recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Milestone projects</CardTitle>
            <CardDescription>Projects and rehab work tied to this deal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(projectRows || []).length ? (
              (projectRows || []).map((project) => (
                <div key={project.id} className="rounded-lg border p-3">
                  <p className="font-medium">{project.title || "Untitled project"}</p>
                  <p className="text-sm text-muted-foreground">{project.status || "active"}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No milestone projects attached yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <DealVaultDealActions
        dealId={dealId}
        currentStatus={deal.status as DealVaultDealStatus}
        proofs={(proofs.data || []) as Array<{
          id: string;
          title: string | null;
          document_type: string | null;
          status: string | null;
          document_hash: string;
          proof_id?: string | null;
        }>}
        availableProofs={(availableProofs.data || []) as Array<{
          id: string;
          title: string | null;
          proof_id?: string | null;
          real_estate_deal_id?: string | null;
        }>}
        splits={(splits.data || []) as Array<{
          id: string;
          participant_name: string;
          bps: number;
          amount_owed: number | null;
          paid: boolean;
        }>}
        projects={(projectRows || []) as Array<{
          id: string;
          title: string | null;
          status: string | null;
        }>}
        milestones={(milestoneItems.data || []) as Array<{
          id: string;
          milestone_project_id: string;
          title: string;
          status: string | null;
          proof_id?: string | null;
        }>}
      />
    </main>
  );
}
