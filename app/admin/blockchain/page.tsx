import path from "node:path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { checkAdminAccess } from "@/lib/auth/admin";
import { getDealVaultContractAddresses } from "@/lib/blockchain/chains";
import { getDealVaultAdmin } from "@/lib/dealvault/server";
import {
  getDealVaultDeploymentArtifacts,
  getDealVaultExplorerBaseUrl,
  getDealVaultOperationalSnapshot,
} from "@/lib/dealvault/ops";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago",
  });
}

function ShortHash({ value }: { value: string }) {
  return (
    <span className="font-mono text-xs text-slate-100">
      {value.slice(0, 10)}...{value.slice(-8)}
    </span>
  );
}

export default async function AdminBlockchainPage() {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    redirect("/dashboard");
  }

  const admin = getDealVaultAdmin();
  const network = process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || null;
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || null;
  const contractAddresses = getDealVaultContractAddresses();
  const { deploymentPath, smokePath, deployment, smoke } = await getDealVaultDeploymentArtifacts(network);
  const explorerBaseUrl = getDealVaultExplorerBaseUrl(network);
  const opsSnapshot = await getDealVaultOperationalSnapshot(admin).catch(() => null);

  const envRows = [
    ["Feature flag", process.env.NEXT_PUBLIC_ENABLE_DEALVAULT === "true" ? "Enabled" : "Disabled"],
    ["Chain ID", chainId || "Not configured"],
    ["Network", network || "Not configured"],
    ["RPC configured", process.env.DEALVAULT_BLOCKCHAIN_RPC_URL || process.env.BLOCKCHAIN_RPC_URL ? "Yes" : "No"],
    [
      "Admin key configured",
      process.env.DEALVAULT_BLOCKCHAIN_ADMIN_PRIVATE_KEY || process.env.BLOCKCHAIN_ADMIN_PRIVATE_KEY ? "Yes" : "No",
    ],
    ["DealVaultRealEstate", contractAddresses.dealVaultRealEstate || "Not configured"],
    ["ProofVault", contractAddresses.proofVault || "Not configured"],
    ["PartnerPay", contractAddresses.partnerPay || "Not configured"],
    ["MilestoneVault", contractAddresses.milestoneVault || "Not configured"],
  ] as const;

  const contracts = deployment
    ? [
        ["DealVaultRealEstate", deployment.contracts.dealVaultRealEstate],
        ["ProofVault", deployment.contracts.proofVault],
        ["PartnerPay", deployment.contracts.partnerPay],
        ["MilestoneVault", deployment.contracts.milestoneVault],
      ]
    : [];

  const opsCards = [
    {
      label: "Transactions (24h)",
      value: opsSnapshot?.recentTransactionCount ?? "N/A",
      description: "Recent blockchain writes logged by the module.",
    },
    {
      label: "Failures (24h)",
      value: opsSnapshot?.recentFailureCount ?? "N/A",
      description: "Failed writes that need operator review.",
    },
    {
      label: "Unconfirmed logs",
      value: opsSnapshot?.unconfirmedTransactionCount ?? "N/A",
      description: "Submitted writes missing confirmation timestamps.",
    },
    {
      label: "Latest audit event",
      value: opsSnapshot?.latestAuditEvent?.action || "N/A",
      description: formatTimestamp(opsSnapshot?.latestAuditEvent?.created_at ?? null),
    },
  ] as const;

  return (
    <main className="space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Admin workspace</Badge>
            <Badge variant={deployment ? "default" : "secondary"}>
              {deployment ? "Deployed" : "Not deployed"}
            </Badge>
            <Badge variant={smoke ? "default" : "secondary"}>
              {smoke ? "Smoke tested" : "Not smoke tested"}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">DealVault blockchain lane</p>
          <h1 className="text-2xl font-semibold text-white">Blockchain Diagnostics</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Safe readiness signals for DealVault&apos;s proof and ledger infrastructure, including
            live deployment and smoke-test evidence without exposing private credentials.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/dealvault">DealVault Admin</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin-panel">Admin Overview</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {opsCards.map((card) => (
          <Card key={card.label} className="border-slate-800 bg-slate-900/80 text-slate-50">
            <CardHeader>
              <CardTitle>{card.label}</CardTitle>
              <CardDescription className="text-slate-400">{card.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{card.value}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/80 text-slate-50 xl:col-span-1">
          <CardHeader>
            <CardTitle>Environment readiness</CardTitle>
            <CardDescription className="text-slate-400">
              Feature flag and contract endpoint visibility for the active local environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {envRows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 last:border-b-0 last:pb-0"
              >
                <span className="text-slate-400">{label}</span>
                <span className="max-w-[16rem] break-all text-right font-mono text-xs text-slate-100">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80 text-slate-50 xl:col-span-1">
          <CardHeader>
            <CardTitle>Live deployment</CardTitle>
            <CardDescription className="text-slate-400">
              Deployment artifact loaded from the local `deployments/` directory for the active network.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Status</span>
                <span>{deployment ? "Deployment artifact found" : "No deployment artifact found"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Deployed at</span>
                <span className="text-right">{formatTimestamp(deployment?.deployedAt ?? null)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Deployer/Admin</span>
                <span className="max-w-[16rem] break-all text-right font-mono text-xs">
                  {deployment?.adminAddress || "Not available"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Artifact</span>
                <span className="text-right font-mono text-xs">{deploymentPath ? path.basename(deploymentPath) : "N/A"}</span>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-800 pt-4">
              {contracts.length > 0 ? (
                contracts.map(([label, address]) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">{label}</span>
                    {explorerBaseUrl ? (
                      <a
                        href={`${explorerBaseUrl}${address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-300 transition hover:text-cyan-200"
                      >
                        <ShortHash value={address} />
                      </a>
                    ) : (
                      <ShortHash value={address} />
                    )}
                  </div>
                ))
              ) : (
                <p className="text-slate-400">No contract deployment record found for the active network.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80 text-slate-50 xl:col-span-1">
          <CardHeader>
            <CardTitle>Smoke-test evidence</CardTitle>
            <CardDescription className="text-slate-400">
              Live contract write validation loaded from the local smoke-test artifact.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Status</span>
                <span>{smoke ? "Smoke artifact found" : "No smoke artifact found"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Executed at</span>
                <span className="text-right">{formatTimestamp(smoke?.executedAt ?? null)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Signer</span>
                <span className="max-w-[16rem] break-all text-right font-mono text-xs">
                  {smoke?.signer || "Not available"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Artifact</span>
                <span className="text-right font-mono text-xs">{smokePath ? path.basename(smokePath) : "N/A"}</span>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-800 pt-4">
              {smoke ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">DealVault deal ID</span>
                    <ShortHash value={smoke.dealVault.dealId} />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">Proof ID</span>
                    <ShortHash value={smoke.dealVault.proofId} />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">PartnerPay deal ID</span>
                    <ShortHash value={smoke.partnerPay.dealId} />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400">Milestone project ID</span>
                    <ShortHash value={smoke.milestoneVault.projectId} />
                  </div>
                </>
              ) : (
                <p className="text-slate-400">No live smoke-test record found for the active network.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/80 text-slate-50">
        <CardHeader>
          <CardTitle>Recent failures</CardTitle>
          <CardDescription className="text-slate-400">
            Most recent failed blockchain writes captured in DealVault transaction logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {opsSnapshot?.recentFailures.length ? (
            opsSnapshot.recentFailures.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-800 p-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">{item.method_name || "Unknown method"}</p>
                  <Badge variant="destructive">{item.status || "failed"}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-400">{item.related_table || "No related table"}</p>
                <p className="mt-2 text-sm text-amber-200">
                  {item.error_message || "No failure message was stored for this transaction."}
                </p>
                <p className="mt-2 break-all font-mono text-xs text-slate-500">
                  {item.tx_hash || "No transaction hash"}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatTimestamp(item.created_at)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No failed blockchain writes were found in the current log window.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
