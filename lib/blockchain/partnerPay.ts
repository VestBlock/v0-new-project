import "server-only";
import { parseAbi, parseEventLogs } from "viem";
import { getDealVaultPublicClient } from "@/lib/blockchain/client";
import { getDealVaultContractAddresses } from "@/lib/blockchain/chains";
import { getDealVaultServerAccount } from "@/lib/blockchain/serverWallet";
import { submitDealVaultWrite } from "@/lib/blockchain/tx";

const abi = parseAbi([
  "function createDeal(string externalRef, uint256 dealAmount) returns (bytes32)",
  "function addSplit(bytes32 dealId, address participant, string participantName, uint16 bps)",
  "function lockDeal(bytes32 dealId)",
  "function updateDealStatus(bytes32 dealId, uint8 statusCode)",
  "function markSplitPaid(bytes32 dealId, uint256 splitIndex)",
  "function getDeal(bytes32 dealId) view returns ((bytes32 dealId, address creator, string externalRef, uint256 dealAmount, uint8 status, uint256 createdAt, uint256 updatedAt, bool exists))",
  "event DealCreated(bytes32 indexed dealId, address indexed creator, string externalRef, uint256 dealAmount)",
]);

export async function createPartnerPayDealOnChain(externalRef: string, dealAmount: bigint) {
  const address = getDealVaultContractAddresses().partnerPay;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request, result } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "createDeal",
    args: [externalRef, dealAmount],
    account,
  });
  const { txHash, receipt } = await submitDealVaultWrite(request);
  const logs = parseEventLogs({
    abi,
    logs: receipt.logs,
    eventName: "DealCreated",
  });

  return {
    dealId: (logs[0]?.args.dealId as `0x${string}` | undefined) || result,
    txHash,
  };
}

export async function addPartnerPaySplitOnChain(
  dealId: `0x${string}`,
  participant: `0x${string}`,
  participantName: string,
  bps: number
) {
  const address = getDealVaultContractAddresses().partnerPay;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "addSplit",
    args: [dealId, participant, participantName, bps],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}

export async function lockPartnerPayDealOnChain(dealId: `0x${string}`) {
  const address = getDealVaultContractAddresses().partnerPay;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "lockDeal",
    args: [dealId],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}

export async function updatePartnerPayDealStatusOnChain(dealId: `0x${string}`, statusCode: number) {
  const address = getDealVaultContractAddresses().partnerPay;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "updateDealStatus",
    args: [dealId, statusCode],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}

export async function markPartnerPaySplitPaidOnChain(dealId: `0x${string}`, splitIndex: number) {
  const address = getDealVaultContractAddresses().partnerPay;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "markSplitPaid",
    args: [dealId, BigInt(splitIndex)],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}

export async function getPartnerPayDealOnChain(dealId: `0x${string}`) {
  const address = getDealVaultContractAddresses().partnerPay;
  const publicClient = getDealVaultPublicClient();
  return publicClient.readContract({
    address,
    abi,
    functionName: "getDeal",
    args: [dealId],
  });
}

export function toCents(value: number) {
  return BigInt(Math.round(value * 100));
}
