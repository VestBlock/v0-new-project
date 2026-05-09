import "server-only";
import { parseAbi, parseEventLogs } from "viem";
import { getDealVaultPublicClient } from "@/lib/blockchain/client";
import { getDealVaultContractAddresses } from "@/lib/blockchain/chains";
import { getDealVaultServerAccount } from "@/lib/blockchain/serverWallet";
import { submitDealVaultWrite } from "@/lib/blockchain/tx";

const abi = parseAbi([
  "function createProof(bytes32 documentHash, string proofType, string externalRef) returns (bytes32)",
  "function updateProofStatus(bytes32 proofId, uint8 statusCode)",
  "function verifyDocument(bytes32 proofId, bytes32 documentHash) view returns (bool)",
  "event ProofCreated(bytes32 indexed proofId, bytes32 indexed documentHash, address indexed creator, string proofType, string externalRef, uint256 createdAt)",
]);

export async function createProofOnChain(
  documentHash: `0x${string}`,
  proofType: string,
  externalRef: string
) {
  const address = getDealVaultContractAddresses().proofVault;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request, result } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "createProof",
    args: [documentHash, proofType, externalRef],
    account,
  });
  const { txHash, receipt } = await submitDealVaultWrite(request);
  const logs = parseEventLogs({
    abi,
    logs: receipt.logs,
    eventName: "ProofCreated",
  });

  return {
    proofId: (logs[0]?.args.proofId as `0x${string}` | undefined) || result,
    txHash,
  };
}

export async function updateProofStatusOnChain(proofId: `0x${string}`, statusCode: number) {
  const address = getDealVaultContractAddresses().proofVault;
  const publicClient = getDealVaultPublicClient();
  const account = getDealVaultServerAccount();
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName: "updateProofStatus",
    args: [proofId, statusCode],
    account,
  });

  const { txHash } = await submitDealVaultWrite(request);
  return txHash;
}

export async function verifyProofOnChain(proofId: `0x${string}`, documentHash: `0x${string}`) {
  const address = getDealVaultContractAddresses().proofVault;
  const publicClient = getDealVaultPublicClient();
  return publicClient.readContract({
    address,
    abi,
    functionName: "verifyDocument",
    args: [proofId, documentHash],
  });
}
