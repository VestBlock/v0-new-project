import { NextRequest, NextResponse } from "next/server";
import { waitForDealVaultTransaction } from "@/lib/blockchain/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDealVaultUser } from "@/lib/dealvault/auth";
import { isDealVaultEnabled } from "@/lib/dealvault/featureFlag";
import { createDealVaultDealSchema } from "@/lib/dealvault/validations";
import { generateDealAnchorHash, generatePropertyHash } from "@/lib/dealvault/proof";
import {
  dealTypeToChainCode,
  ensureBytes32Hex,
  getDealVaultChainContext,
  hasDealVaultContractAddress,
  logDealVaultAuditEvent,
  logDealVaultBlockchainTransaction,
} from "@/lib/dealvault/activity";
import { buildDealVaultOpaqueLabel, buildDealVaultOpaqueReference } from "@/lib/dealvault/onChainMetadata";
import { createDealVaultDealOnChain } from "@/lib/blockchain/dealVaultRealEstate";
import { addMilestoneOnChain, createMilestoneProjectOnChain } from "@/lib/blockchain/milestoneVault";
import { addPartnerPaySplitOnChain, createPartnerPayDealOnChain, toCents } from "@/lib/blockchain/partnerPay";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isDealVaultEnabled()) {
    return NextResponse.json({ error: "DealVault is not enabled." }, { status: 503 });
  }

  const user = await getDealVaultUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createDealVaultDealSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const propertyHash = input.propertyAddress
    ? await generatePropertyHash({
        propertyAddress: input.propertyAddress,
        propertyCity: input.propertyCity,
        propertyState: input.propertyState,
        propertyZip: input.propertyZip,
      })
    : await generateDealAnchorHash({
        externalRef: input.externalRef,
        title: input.title,
        dealType: input.dealType,
        userId: user.profileId,
      });

  const admin = createAdminClient();
  const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  const { data, error } = await admin
    .from("real_estate_deals")
    .insert({
      user_id: user.profileId,
      external_ref: input.externalRef || null,
      deal_type: input.dealType,
      status: "draft",
      title: input.title,
      property_address: input.propertyAddress || null,
      property_city: input.propertyCity || null,
      property_state: input.propertyState || null,
      property_zip: input.propertyZip || null,
      property_hash: propertyHash,
      seller_name: input.sellerName || null,
      buyer_name: input.buyerName || null,
      lead_owner: input.leadOwner || null,
      dispo_partner: input.dispoPartner || null,
      buyer_finder: input.buyerFinder || null,
      contractor_name: input.contractorName || null,
      investor_name: input.investorName || null,
      title_company: input.titleCompany || null,
      closing_date: input.closingDate || null,
      contract_price: input.contractPrice ?? null,
      buyer_price: input.buyerPrice ?? null,
      assignment_fee: input.assignmentFee ?? null,
      earnest_money: input.earnestMoney ?? null,
      purchase_price: input.purchasePrice ?? null,
      down_payment: input.downPayment ?? null,
      principal_balance: input.principalBalance ?? null,
      interest_rate: input.interestRate ?? null,
      monthly_payment: input.monthlyPayment ?? null,
      term_months: input.termMonths ?? null,
      balloon_date: input.balloonDate || null,
      first_payment_date: input.firstPaymentDate || null,
      option_fee: input.optionFee ?? null,
      monthly_rent: input.monthlyRent ?? null,
      rent_credit: input.rentCredit ?? null,
      option_expiration: input.optionExpiration || null,
      expected_fee: input.expectedFee ?? null,
      referral_source: input.referralSource || null,
      referral_percentage: input.referralPercentage ?? null,
      total_project_budget: input.totalProjectBudget ?? null,
      scope_summary: input.scopeSummary || null,
      blockchain_network: process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const chainContext = getDealVaultChainContext();
  const chainDealReference = buildDealVaultOpaqueReference("deal", data.id);
  const chainMilestoneProjectReference = buildDealVaultOpaqueReference("project", data.id);
  const chainPartnerPayReference = buildDealVaultOpaqueReference("partner-pay", data.id);
  let deal = data;
  const warnings: string[] = [];

  await logDealVaultAuditEvent(admin, {
    userId: user.profileId,
    actorEmail: user.email,
    action: "dealvault.deal.created",
    entityType: "real_estate_deal",
    entityId: data.id,
    metadata: {
      dealType: input.dealType,
      title: input.title,
      mode: chainContext.configured ? "anchoring_requested" : "local_record",
    },
    ipAddress,
  });

  if (input.splits.length) {
    const baseAmount = Number(
      data.assignment_fee ?? data.expected_fee ?? data.buyer_price ?? data.total_project_budget ?? 0
    );
    await admin.from("real_estate_payout_splits").insert(
      input.splits.map((split) => ({
        real_estate_deal_id: data.id,
        user_id: user.profileId,
        participant_name: split.participantName,
        participant_email: split.participantEmail || null,
        participant_role: split.participantRole || null,
        participant_wallet: split.participantWallet || null,
        bps: split.bps,
        amount_owed: split.amountOwed ?? (baseAmount ? (baseAmount * split.bps) / 10000 : null),
        paid: false,
      }))
    );
  }

  if (input.milestones.length) {
    const milestoneVaultConfigured =
      chainContext.configured && hasDealVaultContractAddress(chainContext.addresses.milestoneVault);
    const totalAmount = input.totalProjectBudget ?? input.expectedFee ?? input.assignmentFee ?? 0;

    if (milestoneVaultConfigured) {
      let milestoneWriteMethod: "createProject" | "addMilestone" = "createProject";
      try {
        const createdProject = await createMilestoneProjectOnChain(
          chainMilestoneProjectReference,
          input.dealType,
          toCents(totalAmount)
        );

        const { data: project, error: projectError } = await admin
          .from("dealvault_milestone_projects")
          .insert({
            user_id: user.profileId,
            real_estate_deal_id: data.id,
            title: input.title,
            project_type: input.dealType,
            total_amount: totalAmount,
            status: "active",
            project_id: createdProject.projectId,
            blockchain_tx_hash: createdProject.txHash,
            blockchain_network: chainContext.chain?.slug || null,
            contract_address: chainContext.addresses.milestoneVault,
          })
          .select("*")
          .single();

        if (projectError || !project) {
          warnings.push(projectError?.message || "Failed to save milestone project.");
        } else {
          await logDealVaultBlockchainTransaction(admin, {
            userId: user.profileId,
            relatedTable: "dealvault_milestone_projects",
            relatedId: project.id,
            txHash: createdProject.txHash,
            contractAddress: chainContext.addresses.milestoneVault,
            methodName: "createProject",
            status: "submitted",
          });

          for (const [index, milestone] of input.milestones.entries()) {
            milestoneWriteMethod = "addMilestone";
            const milestoneTxHash = await addMilestoneOnChain(
              ensureBytes32Hex(createdProject.projectId),
              buildDealVaultOpaqueLabel("milestone", index),
              "",
              BigInt(Math.round(Number(milestone.amount || 0) * 100)),
              BigInt(
                milestone.dueDate
                  ? Math.floor(new Date(`${milestone.dueDate}T00:00:00Z`).getTime() / 1000)
                  : 0
              )
            );

            const { data: milestoneRow, error: milestoneInsertError } = await admin
              .from("dealvault_milestone_items")
              .insert({
                milestone_project_id: project.id,
                title: milestone.title,
                description: milestone.description || null,
                amount: milestone.amount ?? null,
                due_date: milestone.dueDate || null,
                status: "pending",
                blockchain_milestone_index: index,
              })
              .select("id")
              .single();

            if (milestoneInsertError || !milestoneRow) {
              warnings.push(
                milestoneInsertError?.message ||
                  `Milestone ${index + 1} was added on-chain but could not be saved locally.`
              );
              break;
            }

            await logDealVaultBlockchainTransaction(admin, {
              userId: user.profileId,
              relatedTable: "dealvault_milestone_items",
              relatedId: milestoneRow.id,
              txHash: milestoneTxHash,
              contractAddress: chainContext.addresses.milestoneVault,
              methodName: "addMilestone",
              status: "submitted",
            });
          }
        }
      } catch (milestoneError) {
        const message =
          milestoneError instanceof Error
            ? milestoneError.message
            : "Milestone project anchoring failed.";
        warnings.push(message);
        await logDealVaultBlockchainTransaction(admin, {
          userId: user.profileId,
          relatedTable: "real_estate_deals",
          relatedId: data.id,
          contractAddress: chainContext.addresses.milestoneVault,
          methodName: milestoneWriteMethod,
          status: "failed",
          errorMessage: message,
        });
      }
    } else {
      const { data: project, error: projectError } = await admin
        .from("dealvault_milestone_projects")
        .insert({
          user_id: user.profileId,
          real_estate_deal_id: data.id,
          title: input.title,
          project_type: input.dealType,
          total_amount: totalAmount,
          status: "active",
          blockchain_network: process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || null,
        })
        .select("*")
        .single();

      if (projectError) {
        warnings.push(projectError.message);
      } else if (project) {
        await admin.from("dealvault_milestone_items").insert(
          input.milestones.map((milestone) => ({
            milestone_project_id: project.id,
            title: milestone.title,
            description: milestone.description || null,
            amount: milestone.amount ?? null,
            due_date: milestone.dueDate || null,
            status: "pending",
          }))
        );
      }
    }
  }

  if (chainContext.configured && hasDealVaultContractAddress(chainContext.addresses.dealVaultRealEstate)) {
    try {
      const createdDeal = await createDealVaultDealOnChain(
        ensureBytes32Hex(propertyHash),
        dealTypeToChainCode(input.dealType),
        chainDealReference
      );

      const { data: updatedDeal, error: updateError } = await admin
        .from("real_estate_deals")
        .update({
          deal_id: createdDeal.dealId,
          blockchain_tx_hash: createdDeal.txHash,
          blockchain_network: chainContext.chain?.slug || null,
          contract_address: chainContext.addresses.dealVaultRealEstate,
          status: "draft",
        })
        .eq("id", data.id)
        .select("*")
        .single();

      if (!updateError && updatedDeal) {
        deal = updatedDeal;
      }

      await logDealVaultBlockchainTransaction(admin, {
        userId: user.profileId,
        relatedTable: "real_estate_deals",
        relatedId: data.id,
        txHash: createdDeal.txHash,
        contractAddress: chainContext.addresses.dealVaultRealEstate,
        methodName: "createDeal",
        status: "submitted",
      });
    } catch (chainError) {
      const message =
        chainError instanceof Error ? chainError.message : "DealVault real estate anchoring failed.";
      warnings.push(message);
      await logDealVaultBlockchainTransaction(admin, {
        userId: user.profileId,
        relatedTable: "real_estate_deals",
        relatedId: data.id,
        contractAddress: chainContext.addresses.dealVaultRealEstate,
        methodName: "createDeal",
        status: "failed",
        errorMessage: message,
      });
    }
  }

  if (input.splits.length && chainContext.configured && hasDealVaultContractAddress(chainContext.addresses.partnerPay)) {
    try {
      const payoutAmount = input.expectedFee ?? input.assignmentFee ?? input.buyerPrice ?? 0;
      const partnerPayDeal = await createPartnerPayDealOnChain(chainPartnerPayReference, toCents(payoutAmount));

      await admin
        .from("real_estate_deals")
        .update({ partner_pay_deal_id: partnerPayDeal.dealId })
        .eq("id", data.id);

      await logDealVaultBlockchainTransaction(admin, {
        userId: user.profileId,
        relatedTable: "real_estate_deals",
        relatedId: data.id,
        txHash: partnerPayDeal.txHash,
        contractAddress: chainContext.addresses.partnerPay,
        methodName: "createDeal",
        status: "submitted",
      });

      const { data: createdSplits } = await admin
        .from("real_estate_payout_splits")
        .select("id,participant_name,participant_wallet,bps")
        .eq("real_estate_deal_id", data.id)
        .order("created_at", { ascending: true });

      let syncedSplitCount = 0;
      for (const [index, split] of (createdSplits || []).entries()) {
        if (!split.participant_wallet || !/^0x[a-fA-F0-9]{40}$/.test(split.participant_wallet)) {
          continue;
        }

        const splitTxHash = await addPartnerPaySplitOnChain(
          ensureBytes32Hex(partnerPayDeal.dealId),
          split.participant_wallet as `0x${string}`,
          buildDealVaultOpaqueLabel("split", index),
          split.bps
        );
        await waitForDealVaultTransaction(splitTxHash);

        await admin
          .from("real_estate_payout_splits")
          .update({ blockchain_split_index: index })
          .eq("id", split.id);
        syncedSplitCount += 1;

        await logDealVaultBlockchainTransaction(admin, {
          userId: user.profileId,
          relatedTable: "real_estate_payout_splits",
          relatedId: split.id,
          txHash: splitTxHash,
          contractAddress: chainContext.addresses.partnerPay,
          methodName: "addSplit",
          status: "submitted",
        });
      }

      if (createdSplits?.length && syncedSplitCount === 0) {
        warnings.push("Payout ledger created, but no payout splits were synced on-chain because no valid participant wallet was provided.");
      }
    } catch (partnerPayError) {
      const message =
        partnerPayError instanceof Error ? partnerPayError.message : "PartnerPay ledger sync failed.";
      warnings.push(message);
      await logDealVaultBlockchainTransaction(admin, {
        userId: user.profileId,
        relatedTable: "real_estate_deals",
        relatedId: data.id,
        contractAddress: chainContext.addresses.partnerPay,
        methodName: "createDeal",
        status: "failed",
        errorMessage: message,
      });
    }
  }

  return NextResponse.json({
    deal,
    mode:
      chainContext.configured && hasDealVaultContractAddress(chainContext.addresses.dealVaultRealEstate)
        ? "anchoring_attempted"
        : "local_record",
    warnings,
    message:
      chainContext.configured && hasDealVaultContractAddress(chainContext.addresses.dealVaultRealEstate)
        ? "DealVault deal created and blockchain anchoring was requested."
        : "DealVault deal created in DealVault.",
  });
}
