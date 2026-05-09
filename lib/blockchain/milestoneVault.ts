import "server-only";
import { parseAbi, parseEventLogs } from "viem";
import { getDealVaultPublicClient } from "@/lib/blockchain/client";
import { getDealVaultContractAddresses } from "@/lib/blockchain/chains";
import { getDealVaultServerAccount } from "@/lib/blockchain/serverWallet";
import { submitDealVaultWrite } from "@/lib/blockchain/tx";

const abi = parseAbi([
  "function createProject(string externalRef, string projectType, uint256 totalAmount) returns (bytes32)",
  "function addMilestone(bytes32 projectId, string title, string description, uint256 amount, uint256 dueDate)",
  "function submitMilestoneProof(bytes32 projectId, uint256 milestoneIndex, bytes32 proofId)",
  "function approveMilestone(bytes32 projectId, uint256 milestoneIndex)",
  "function disputeMilestone(bytes32 projectId, uint256 milestoneIndex)",
  "function completeMilestone(bytes32 projectId, uint256 milestoneIndex)",
  "event ProjectCreated(bytes32 indexed projectId, address indexed creator, string externalRef, string projectType, uint256 totalAmount)",
]);

export async function createMilestoneProjectOnChain(
  externalRef: string,
  projectType: string,
  totalAmount: bigint
) {
  const address = getDealVaultContractAddresses().milestoneVault;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request, result } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "createProject",
    args: [externalRef, projectType, totalAmount],
    account,
  });
  const { txHash, receipt } = await submitDealVaultWrite(request);
  const logs = parseEventLogs({
    abi,
    logs: receipt.logs,
    eventName: "ProjectCreated",
  });

  return {
    projectId: (logs[0]?.args.projectId as `0x${string}` | undefined) || result,
    txHash,
  };
}

export async function addMilestoneOnChain(
  projectId: `0x${string}`,
  title: string,
  description: string,
  amount: bigint,
  dueDate: bigint
) {
  const address = getDealVaultContractAddresses().milestoneVault;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "addMilestone",
    args: [projectId, title, description, amount, dueDate],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}

export async function submitMilestoneProofOnChain(
  projectId: `0x${string}`,
  milestoneIndex: number,
  proofId: `0x${string}`
) {
  const address = getDealVaultContractAddresses().milestoneVault;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "submitMilestoneProof",
    args: [projectId, BigInt(milestoneIndex), proofId],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}

export async function approveMilestoneOnChain(projectId: `0x${string}`, milestoneIndex: number) {
  const address = getDealVaultContractAddresses().milestoneVault;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "approveMilestone",
    args: [projectId, BigInt(milestoneIndex)],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}

export async function disputeMilestoneOnChain(projectId: `0x${string}`, milestoneIndex: number) {
  const address = getDealVaultContractAddresses().milestoneVault;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "disputeMilestone",
    args: [projectId, BigInt(milestoneIndex)],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}

export async function completeMilestoneOnChain(projectId: `0x${string}`, milestoneIndex: number) {
  const address = getDealVaultContractAddresses().milestoneVault;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "completeMilestone",
    args: [projectId, BigInt(milestoneIndex)],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}
