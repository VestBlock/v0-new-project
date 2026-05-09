import "server-only";
import { parseAbi, parseEventLogs } from "viem";
import { getDealVaultPublicClient } from "@/lib/blockchain/client";
import { getDealVaultContractAddresses } from "@/lib/blockchain/chains";
import { getDealVaultServerAccount } from "@/lib/blockchain/serverWallet";
import { submitDealVaultWrite } from "@/lib/blockchain/tx";

const abi = parseAbi([
  "function createDeal(bytes32 propertyHash, uint8 dealType, string externalRef) returns (bytes32)",
  "function updateDealStatus(bytes32 dealId, uint8 status)",
  "function attachProof(bytes32 dealId, bytes32 proofId)",
  "event DealCreated(bytes32 indexed dealId, bytes32 indexed propertyHash, address indexed creator, uint8 dealType, string externalRef, uint256 createdAt)",
]);

export async function createDealVaultDealOnChain(
  propertyHash: `0x${string}`,
  dealType: number,
  externalRef: string
) {
  const address = getDealVaultContractAddresses().dealVaultRealEstate;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request, result } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "createDeal",
    args: [propertyHash, dealType, externalRef],
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

export async function updateDealVaultDealStatusOnChain(dealId: `0x${string}`, status: number) {
  const address = getDealVaultContractAddresses().dealVaultRealEstate;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "updateDealStatus",
    args: [dealId, status],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}

export async function attachDealVaultProofOnChain(dealId: `0x${string}`, proofId: `0x${string}`) {
  const address = getDealVaultContractAddresses().dealVaultRealEstate;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "attachProof",
    args: [dealId, proofId],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}
