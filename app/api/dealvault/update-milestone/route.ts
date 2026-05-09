import { NextRequest, NextResponse } from "next/server";
import {
  approveMilestoneOnChain,
  completeMilestoneOnChain,
  disputeMilestoneOnChain,
  submitMilestoneProofOnChain,
} from "@/lib/blockchain/milestoneVault";
import {
  ensureBytes32Hex,
  getDealVaultChainContext,
  hasDealVaultContractAddress,
  logDealVaultAuditEvent,
  logDealVaultBlockchainTransaction,
} from "@/lib/dealvault/activity";
import { getDealVaultAdmin, isDealVaultAdmin, requireDealVaultUser } from "@/lib/dealvault/server";
import { updateDealVaultMilestoneSchema } from "@/lib/dealvault/validations";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireDealVaultUser();
  if (auth.error || !auth.user) return auth.error!;

  const json = await request.json().catch(() => null);
  const parsed = updateDealVaultMilestoneSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.status === "submitted" && !parsed.data.proofId) {
    return NextResponse.json(
      { error: "proofId is required when submitting a milestone proof." },
      { status: 400 }
    );
  }

  const admin = getDealVaultAdmin();
  const chainContext = getDealVaultChainContext();
  const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  const { data: milestone } = await admin
    .from("dealvault_milestone_items")
    .select("id,milestone_project_id,blockchain_milestone_index")
    .eq("id", parsed.data.milestoneId)
    .maybeSingle();

  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
  }

  const { data: project } = await admin
    .from("dealvault_milestone_projects")
    .select("id,user_id,project_id")
    .eq("id", milestone.milestone_project_id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (project.user_id !== auth.user.profileId && !isDealVaultAdmin(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const updates: Record<string, string | null> = {
    status: parsed.data.status,
  };

  if (parsed.data.proofId) {
    updates.proof_id = parsed.data.proofId;
  }

  const timestamp = new Date().toISOString();
  if (parsed.data.status === "submitted") updates.submitted_at = timestamp;
  if (parsed.data.status === "approved") updates.approved_at = timestamp;
  if (parsed.data.status === "disputed") updates.disputed_at = timestamp;
  if (parsed.data.status === "completed") updates.completed_at = timestamp;

  const warnings: string[] = [];
  const milestoneVaultConfigured =
    chainContext.configured && hasDealVaultContractAddress(chainContext.addresses.milestoneVault);

  if (milestoneVaultConfigured) {
    if (!project.project_id || typeof milestone.blockchain_milestone_index !== "number") {
      return NextResponse.json(
        {
          error:
            "This milestone is missing its on-chain project or index reference. Recreate or repair the milestone before changing its status.",
        },
        { status: 409 }
      );
    }

    try {
      let txHash: string | null = null;
      const projectBytes32 = ensureBytes32Hex(project.project_id);

      if (parsed.data.status === "submitted" && parsed.data.proofId) {
        txHash = await submitMilestoneProofOnChain(
          projectBytes32,
          milestone.blockchain_milestone_index,
          ensureBytes32Hex(parsed.data.proofId)
        );
      }
      if (parsed.data.status === "approved") {
        txHash = await approveMilestoneOnChain(projectBytes32, milestone.blockchain_milestone_index);
      }
      if (parsed.data.status === "disputed") {
        txHash = await disputeMilestoneOnChain(projectBytes32, milestone.blockchain_milestone_index);
      }
      if (parsed.data.status === "completed") {
        txHash = await completeMilestoneOnChain(projectBytes32, milestone.blockchain_milestone_index);
      }

      if (txHash) {
        await logDealVaultBlockchainTransaction(admin, {
          userId: auth.user.profileId,
          relatedTable: "dealvault_milestone_items",
          relatedId: milestone.id,
          txHash,
          contractAddress: chainContext.addresses.milestoneVault,
          methodName:
            parsed.data.status === "submitted"
              ? "submitMilestoneProof"
              : parsed.data.status === "approved"
                ? "approveMilestone"
                : parsed.data.status === "disputed"
                  ? "disputeMilestone"
                  : "completeMilestone",
          status: "submitted",
        });
      }
    } catch (chainError) {
      const message =
        chainError instanceof Error ? chainError.message : "On-chain milestone status update failed.";
      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "dealvault_milestone_items",
        relatedId: milestone.id,
        contractAddress: chainContext.addresses.milestoneVault,
        methodName: "updateMilestone",
        status: "failed",
        errorMessage: message,
      });

      return NextResponse.json(
        {
          error: `Blockchain milestone update failed. The milestone was not changed locally. ${message}`,
        },
        { status: 502 }
      );
    }
  }

  const { data, error } = await admin
    .from("dealvault_milestone_items")
    .update(updates)
    .eq("id", parsed.data.milestoneId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logDealVaultAuditEvent(admin, {
    userId: auth.user.profileId,
    actorEmail: auth.user.email,
    action: "dealvault.milestone.updated",
    entityType: "dealvault_milestone_item",
    entityId: milestone.id,
    metadata: {
      status: parsed.data.status,
      proofId: parsed.data.proofId || null,
    },
    ipAddress,
  });

  return NextResponse.json({ milestone: data, warnings });
}
