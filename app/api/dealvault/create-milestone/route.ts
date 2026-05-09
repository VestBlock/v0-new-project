import { NextRequest, NextResponse } from "next/server";
import { addMilestoneOnChain, createMilestoneProjectOnChain } from "@/lib/blockchain/milestoneVault";
import {
  ensureBytes32Hex,
  getDealVaultChainContext,
  hasDealVaultContractAddress,
  logDealVaultAuditEvent,
  logDealVaultBlockchainTransaction,
} from "@/lib/dealvault/activity";
import { toCents } from "@/lib/blockchain/partnerPay";
import { buildDealVaultOpaqueLabel, buildDealVaultOpaqueReference } from "@/lib/dealvault/onChainMetadata";
import { createDealVaultMilestoneSchema } from "@/lib/dealvault/validations";
import { getDealVaultAdmin, isDealVaultAdmin, requireDealVaultUser } from "@/lib/dealvault/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireDealVaultUser();
  if (auth.error || !auth.user) return auth.error!;

  const json = await request.json().catch(() => null);
  const parsed = createDealVaultMilestoneSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const admin = getDealVaultAdmin();
  const chainContext = getDealVaultChainContext();
  const milestoneVaultConfigured =
    chainContext.configured && hasDealVaultContractAddress(chainContext.addresses.milestoneVault);
  const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  const { data: deal } = await admin
    .from("real_estate_deals")
    .select("id,user_id,title,deal_type,total_project_budget")
    .eq("id", input.realEstateDealId)
    .maybeSingle();

  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (deal.user_id !== auth.user.profileId && !isDealVaultAdmin(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let projectId = input.projectId || null;
  let projectRecordId: string | null = null;
  let chainProjectId: string | null = null;
  let blockchainMilestoneIndex = 0;

  if (!projectId) {
    const projectTitle = input.projectTitle || deal.title || "DealVault Project";
    const projectType = input.projectType || deal.deal_type || "contractor_rehab";
    const totalAmount = input.totalAmount ?? deal.total_project_budget ?? input.milestone.amount ?? 0;
    let projectTxHash: string | null = null;

    if (milestoneVaultConfigured) {
      try {
        const createdProject = await createMilestoneProjectOnChain(
          buildDealVaultOpaqueReference("project", input.realEstateDealId),
          projectType,
          toCents(totalAmount)
        );
        chainProjectId = createdProject.projectId;
        projectTxHash = createdProject.txHash;
      } catch (chainError) {
        const message =
          chainError instanceof Error ? chainError.message : "On-chain milestone project creation failed.";
        await logDealVaultBlockchainTransaction(admin, {
          userId: auth.user.profileId,
          relatedTable: "real_estate_deals",
          relatedId: input.realEstateDealId,
          contractAddress: chainContext.addresses.milestoneVault,
          methodName: "createProject",
          status: "failed",
          errorMessage: message,
        });

        return NextResponse.json(
          { error: `Blockchain milestone project creation failed. ${message}` },
          { status: 502 }
        );
      }
    }

    const { data: project, error: projectError } = await admin
      .from("dealvault_milestone_projects")
      .insert({
        user_id: auth.user.profileId,
        real_estate_deal_id: input.realEstateDealId,
        title: projectTitle,
        project_type: projectType,
        total_amount: totalAmount,
        status: "active",
        project_id: chainProjectId,
        blockchain_tx_hash: projectTxHash,
        blockchain_network: milestoneVaultConfigured
          ? chainContext.chain?.slug || null
          : process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || null,
        contract_address: milestoneVaultConfigured ? chainContext.addresses.milestoneVault : null,
      })
      .select("id")
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: projectError?.message || "Failed to create project." },
        { status: 500 }
      );
    }

    projectId = project.id;
    projectRecordId = project.id;

    if (milestoneVaultConfigured && projectTxHash) {
      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "dealvault_milestone_projects",
        relatedId: project.id,
        txHash: projectTxHash,
        contractAddress: chainContext.addresses.milestoneVault,
        methodName: "createProject",
        status: "submitted",
      });
    }
  } else {
    const { data: existingProject } = await admin
      .from("dealvault_milestone_projects")
      .select("id,user_id,real_estate_deal_id,project_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    if (
      existingProject.real_estate_deal_id !== input.realEstateDealId ||
      (existingProject.user_id !== auth.user.profileId && !isDealVaultAdmin(auth.user.role))
    ) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    projectRecordId = existingProject.id;
    chainProjectId = existingProject.project_id ?? null;

    const { count } = await admin
      .from("dealvault_milestone_items")
      .select("id", { count: "exact", head: true })
      .eq("milestone_project_id", projectId);
    blockchainMilestoneIndex = count ?? 0;
  }

  let milestoneTxHash: string | null = null;
  if (milestoneVaultConfigured) {
    if (!chainProjectId) {
      return NextResponse.json(
        {
          error:
            "This milestone project is missing its on-chain project reference. Repair the project before adding more milestones.",
        },
        { status: 409 }
      );
    }

    try {
      milestoneTxHash = await addMilestoneOnChain(
        ensureBytes32Hex(chainProjectId),
        buildDealVaultOpaqueLabel("milestone", blockchainMilestoneIndex),
        "",
        BigInt(Math.round(Number(input.milestone.amount || 0) * 100)),
        BigInt(
          input.milestone.dueDate
            ? Math.floor(new Date(`${input.milestone.dueDate}T00:00:00Z`).getTime() / 1000)
            : 0
        )
      );
    } catch (chainError) {
      const message = chainError instanceof Error ? chainError.message : "On-chain milestone add failed.";
      await logDealVaultBlockchainTransaction(admin, {
        userId: auth.user.profileId,
        relatedTable: "dealvault_milestone_projects",
        relatedId: projectRecordId,
        contractAddress: chainContext.addresses.milestoneVault,
        methodName: "addMilestone",
        status: "failed",
        errorMessage: message,
      });

      return NextResponse.json(
        { error: `Blockchain milestone creation failed. The milestone was not saved locally. ${message}` },
        { status: 502 }
      );
    }
  }

  const { data, error } = await admin
    .from("dealvault_milestone_items")
    .insert({
      milestone_project_id: projectId,
      title: input.milestone.title,
      description: input.milestone.description || null,
      amount: input.milestone.amount ?? null,
      due_date: input.milestone.dueDate || null,
      status: "pending",
      blockchain_milestone_index: milestoneVaultConfigured ? blockchainMilestoneIndex : null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (milestoneVaultConfigured && milestoneTxHash) {
    await logDealVaultBlockchainTransaction(admin, {
      userId: auth.user.profileId,
      relatedTable: "dealvault_milestone_items",
      relatedId: data.id,
      txHash: milestoneTxHash,
      contractAddress: chainContext.addresses.milestoneVault,
      methodName: "addMilestone",
      status: "submitted",
    });
  }

  await logDealVaultAuditEvent(admin, {
    userId: auth.user.profileId,
    actorEmail: auth.user.email,
    action: "dealvault.milestone.created",
    entityType: "dealvault_milestone_item",
    entityId: data.id,
    metadata: {
      projectId,
      realEstateDealId: input.realEstateDealId,
      title: input.milestone.title,
    },
    ipAddress,
  });

  return NextResponse.json({ milestone: data, projectId, warnings: [] });
}
