import "server-only";
import { createPublicClient, http } from "viem";
import { getDealVaultChain } from "@/lib/blockchain/chains";

let publicClient: ReturnType<typeof createPublicClient> | null = null;

export function getDealVaultPublicClient() {
  if (publicClient) {
    return publicClient;
  }

  const chain = getDealVaultChain();
  publicClient = createPublicClient({
    chain: chain.viemChain,
    transport: http(chain.rpcUrl),
  });

  return publicClient;
}

export async function waitForDealVaultTransaction(txHash: `0x${string}`) {
  const client = getDealVaultPublicClient();
  return client.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });
}
