"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreateDealVaultProofForm } from "@/components/dealvault/create-dealvault-proof-form";
import { DealVaultCertificateButton } from "@/components/dealvault/dealvault-certificate-button";
import type { DealVaultDealStatus, DealVaultMilestoneStatus } from "@/lib/dealvault/types";

const statuses: DealVaultDealStatus[] = [
  "draft",
  "active",
  "under_contract",
  "locked",
  "closed",
  "cancelled",
  "disputed",
];

const milestoneStatuses: DealVaultMilestoneStatus[] = [
  "pending",
  "submitted",
  "approved",
  "disputed",
  "completed",
  "cancelled",
];

interface DealVaultProofOption {
  id: string;
  title: string | null;
  proof_id?: string | null;
  real_estate_deal_id?: string | null;
}

interface DealVaultSplit {
  id: string;
  participant_name: string;
  bps: number;
  amount_owed: number | null;
  paid: boolean;
}

interface DealVaultProject {
  id: string;
  title: string | null;
  status: string | null;
}

interface DealVaultMilestone {
  id: string;
  milestone_project_id: string;
  title: string;
  status: string | null;
  proof_id?: string | null;
}

interface DealVaultProof {
  id: string;
  title: string | null;
  document_type: string | null;
  status: string | null;
  document_hash: string;
  proof_id?: string | null;
}

export function DealVaultDealActions({
  dealId,
  currentStatus,
  proofs,
  availableProofs,
  splits,
  projects,
  milestones,
}: {
  dealId: string;
  currentStatus: DealVaultDealStatus;
  proofs: DealVaultProof[];
  availableProofs: DealVaultProofOption[];
  splits: DealVaultSplit[];
  projects: DealVaultProject[];
  milestones: DealVaultMilestone[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<DealVaultDealStatus>(currentStatus);
  const [statusNote, setStatusNote] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [attachProofId, setAttachProofId] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [splitBusy, setSplitBusy] = useState(false);
  const [splitName, setSplitName] = useState("");
  const [splitEmail, setSplitEmail] = useState("");
  const [splitRole, setSplitRole] = useState("");
  const [splitWallet, setSplitWallet] = useState("");
  const [splitBps, setSplitBps] = useState("");
  const [milestoneBusy, setMilestoneBusy] = useState(false);
  const [milestoneProjectId, setMilestoneProjectId] = useState(projects[0]?.id ?? "");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectType, setProjectType] = useState("contractor_rehab");
  const [projectTotalAmount, setProjectTotalAmount] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDescription, setMilestoneDescription] = useState("");
  const [milestoneAmount, setMilestoneAmount] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [milestoneMutatingId, setMilestoneMutatingId] = useState<string | null>(null);
  const [splitMutatingId, setSplitMutatingId] = useState<string | null>(null);
  const [selectedMilestoneProofs, setSelectedMilestoneProofs] = useState<Record<string, string>>({});

  const attachableProofs = useMemo(
    () => availableProofs.filter((proof) => proof.real_estate_deal_id !== dealId),
    [availableProofs, dealId]
  );

  async function postJson<T>(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(json?.error || "Request failed.");
    }

    return json as T;
  }

  async function handleStatusUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusBusy(true);

    try {
      const result = await postJson<{ warnings?: string[] }>("/api/dealvault/update-status", {
        realEstateDealId: dealId,
        newStatus: status,
        note: statusNote,
      });

      toast({
        title: "Status updated",
        description: result.warnings?.[0] || "Deal status has been updated.",
      });
      setStatusNote("");
      router.refresh();
    } catch (error) {
      toast({
        title: "Status update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleAttachProof(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!attachProofId) return;
    setAttachBusy(true);

    try {
      const result = await postJson<{ warnings?: string[] }>("/api/dealvault/attach-proof", {
        realEstateDealId: dealId,
        proofId: attachProofId,
      });

      toast({
        title: "Proof attached",
        description: result.warnings?.[0] || "The proof is now attached to this deal.",
      });
      setAttachProofId("");
      router.refresh();
    } catch (error) {
      toast({
        title: "Attach failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAttachBusy(false);
    }
  }

  async function handleLockPayouts() {
    setLockBusy(true);
    try {
      const result = await postJson<{ warnings?: string[] }>("/api/dealvault/lock-payouts", {
        realEstateDealId: dealId,
      });

      toast({
        title: "Payouts locked",
        description: result.warnings?.[0] || "The payout terms are now locked.",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Lock failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLockBusy(false);
    }
  }

  async function handleCreateSplit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSplitBusy(true);

    try {
      const result = await postJson<{ warnings?: string[] }>("/api/dealvault/create-payout-split", {
        realEstateDealId: dealId,
        split: {
          participantName: splitName,
          participantEmail: splitEmail,
          participantRole: splitRole,
          participantWallet: splitWallet,
          bps: Number(splitBps),
        },
      });

      toast({
        title: "Split created",
        description: result.warnings?.[0] || "The payout split has been added.",
      });
      setSplitName("");
      setSplitEmail("");
      setSplitRole("");
      setSplitWallet("");
      setSplitBps("");
      router.refresh();
    } catch (error) {
      toast({
        title: "Split failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSplitBusy(false);
    }
  }

  async function togglePaid(splitId: string, paid: boolean) {
    setSplitMutatingId(splitId);
    try {
      const result = await postJson<{ warnings?: string[] }>("/api/dealvault/mark-paid", {
        splitId,
        paid: !paid,
      });

      toast({
        title: !paid ? "Split marked paid" : "Split reopened",
        description: result.warnings?.[0] || "The payout ledger was updated.",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Split update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSplitMutatingId(null);
    }
  }

  async function handleCreateMilestone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMilestoneBusy(true);

    try {
      const result = await postJson<{ warnings?: string[] }>("/api/dealvault/create-milestone", {
        realEstateDealId: dealId,
        projectId: milestoneProjectId || undefined,
        projectTitle,
        projectType,
        totalAmount: projectTotalAmount ? Number(projectTotalAmount) : undefined,
        milestone: {
          title: milestoneTitle,
          description: milestoneDescription,
          amount: milestoneAmount ? Number(milestoneAmount) : undefined,
          dueDate: milestoneDueDate || undefined,
        },
      });

      toast({
        title: "Milestone created",
        description: result.warnings?.[0] || "The milestone was added to the project.",
      });
      setMilestoneTitle("");
      setMilestoneDescription("");
      setMilestoneAmount("");
      setMilestoneDueDate("");
      setProjectTitle("");
      setProjectTotalAmount("");
      router.refresh();
    } catch (error) {
      toast({
        title: "Milestone failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setMilestoneBusy(false);
    }
  }

  async function updateMilestone(milestoneId: string, nextStatus: DealVaultMilestoneStatus) {
    const selectedProofId = selectedMilestoneProofs[milestoneId] || "";
    const fallbackProofId =
      proofs.length === 1 && proofs[0]?.proof_id ? proofs[0].proof_id : "";
    const proofId = selectedProofId || fallbackProofId;

    if (nextStatus === "submitted" && !proofId) {
      toast({
        title: "Proof required",
        description: "Choose a proof record with an on-chain proof id before submitting a milestone.",
        variant: "destructive",
      });
      return;
    }

    setMilestoneMutatingId(milestoneId);
    try {
      await postJson("/api/dealvault/update-milestone", {
        milestoneId,
        status: nextStatus,
        proofId: nextStatus === "submitted" ? proofId : undefined,
      });

      toast({
        title: "Milestone updated",
        description: `Milestone moved to ${nextStatus}.`,
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Milestone update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setMilestoneMutatingId(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Deal actions</CardTitle>
          <CardDescription>Update status, attach proof records, and lock payout terms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-3" onSubmit={handleStatusUpdate}>
            <div className="space-y-2">
              <Label htmlFor="deal-status">Status</Label>
              <select
                id="deal-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value as DealVaultDealStatus)}
              >
                {statuses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-note">Status note</Label>
              <Textarea id="status-note" value={statusNote} onChange={(event) => setStatusNote(event.target.value)} />
            </div>
            <Button type="submit" disabled={statusBusy}>
              {statusBusy ? "Saving..." : "Update status"}
            </Button>
          </form>

          <form className="space-y-3" onSubmit={handleAttachProof}>
            <div className="space-y-2">
              <Label htmlFor="attach-proof">Attach existing proof</Label>
              <select
                id="attach-proof"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={attachProofId}
                onChange={(event) => setAttachProofId(event.target.value)}
              >
                <option value="">Select a proof</option>
                {attachableProofs.map((proof) => (
                  <option key={proof.id} value={proof.id}>
                    {proof.title || proof.id}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline" disabled={attachBusy || !attachableProofs.length || !attachProofId}>
              {attachBusy ? "Attaching..." : "Attach proof"}
            </Button>
          </form>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Lock payout ledger</p>
              <p className="text-sm text-muted-foreground">
                Freeze referral and JV payout terms after review.
              </p>
            </div>
            <Button type="button" variant="outline" disabled={lockBusy} onClick={handleLockPayouts}>
              {lockBusy ? "Locking..." : "Lock payouts"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create proof for this deal</CardTitle>
          <CardDescription>Create a proof record and attach it directly to this deal.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateDealVaultProofForm realEstateDealId={dealId} compact />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payout ledger</CardTitle>
          <CardDescription>Add payout participants and track paid status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-3" onSubmit={handleCreateSplit}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="split-name">Participant name</Label>
                <Input id="split-name" value={splitName} onChange={(event) => setSplitName(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="split-bps">Basis points</Label>
                <Input
                  id="split-bps"
                  type="number"
                  min="1"
                  max="10000"
                  value={splitBps}
                  onChange={(event) => setSplitBps(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="split-email">Email</Label>
                <Input id="split-email" value={splitEmail} onChange={(event) => setSplitEmail(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="split-role">Role</Label>
                <Input id="split-role" value={splitRole} onChange={(event) => setSplitRole(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="split-wallet">Wallet (optional for on-chain sync)</Label>
              <Input id="split-wallet" value={splitWallet} onChange={(event) => setSplitWallet(event.target.value)} />
            </div>
            <Button type="submit" disabled={splitBusy}>
              {splitBusy ? "Saving..." : "Add payout split"}
            </Button>
          </form>

          <div className="space-y-3">
            {splits.length ? (
              splits.map((split) => (
                <div key={split.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{split.participant_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {split.bps} bps · {split.amount_owed ?? 0} · {split.paid ? "Paid" : "Pending"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={splitMutatingId === split.id}
                    onClick={() => togglePaid(split.id, split.paid)}
                  >
                    {splitMutatingId === split.id ? "Saving..." : split.paid ? "Mark unpaid" : "Mark paid"}
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No payout splits yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Milestones and certificates</CardTitle>
          <CardDescription>Add rehab milestones, update progress, and download proof certificates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-3" onSubmit={handleCreateMilestone}>
            <div className="space-y-2">
              <Label htmlFor="project-select">Project</Label>
              <select
                id="project-select"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={milestoneProjectId}
                onChange={(event) => setMilestoneProjectId(event.target.value)}
              >
                <option value="">Create new project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title || project.id}
                  </option>
                ))}
              </select>
            </div>
            {!milestoneProjectId ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="project-title">Project title</Label>
                  <Input id="project-title" value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-type">Project type</Label>
                  <Input id="project-type" value={projectType} onChange={(event) => setProjectType(event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="project-total">Project total amount</Label>
                  <Input
                    id="project-total"
                    type="number"
                    min="0"
                    step="0.01"
                    value={projectTotalAmount}
                    onChange={(event) => setProjectTotalAmount(event.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="milestone-title">Milestone title</Label>
              <Input id="milestone-title" value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-description">Description</Label>
              <Textarea
                id="milestone-description"
                value={milestoneDescription}
                onChange={(event) => setMilestoneDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="milestone-amount">Amount</Label>
                <Input
                  id="milestone-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={milestoneAmount}
                  onChange={(event) => setMilestoneAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="milestone-date">Due date</Label>
                <Input
                  id="milestone-date"
                  type="date"
                  value={milestoneDueDate}
                  onChange={(event) => setMilestoneDueDate(event.target.value)}
                />
              </div>
            </div>
            <Button type="submit" disabled={milestoneBusy}>
              {milestoneBusy ? "Saving..." : "Add milestone"}
            </Button>
          </form>

          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Proof certificates</p>
              {proofs.length ? (
                proofs.map((proof) => (
                  <div key={proof.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{proof.title || "Untitled proof"}</p>
                      <p className="text-sm text-muted-foreground">
                        {proof.document_type || "document"} · {proof.status || "pending"}
                      </p>
                    </div>
                    <DealVaultCertificateButton proofId={proof.id} title={proof.title} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No proofs available for certificates yet.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Milestone status controls</p>
              {milestones.length ? (
                milestones.map((milestone) => (
                  <div key={milestone.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="space-y-2">
                      <p className="font-medium">{milestone.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{milestone.status || "pending"}</Badge>
                        {milestone.proof_id ? <span className="text-xs text-muted-foreground">Proof attached</span> : null}
                      </div>
                      {proofs.length ? (
                        <div className="space-y-1">
                          <Label htmlFor={`milestone-proof-${milestone.id}`}>Submission proof</Label>
                          <select
                            id={`milestone-proof-${milestone.id}`}
                            className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={selectedMilestoneProofs[milestone.id] || (milestone.proof_id ?? "")}
                            disabled={milestoneMutatingId === milestone.id}
                            onChange={(event) =>
                              setSelectedMilestoneProofs((current) => ({
                                ...current,
                                [milestone.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select proof for on-chain submission</option>
                            {proofs
                              .filter((proof) => proof.proof_id)
                              .map((proof) => (
                                <option key={proof.id} value={proof.proof_id || ""}>
                                  {proof.title || proof.id}
                                </option>
                              ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={milestone.status || "pending"}
                      disabled={milestoneMutatingId === milestone.id}
                      onChange={(event) =>
                        updateMilestone(milestone.id, event.target.value as DealVaultMilestoneStatus)
                      }
                    >
                      {milestoneStatuses.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No milestones yet.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
