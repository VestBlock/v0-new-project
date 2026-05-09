import "server-only";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getDealVaultChain } from "@/lib/blockchain/chains";

let walletClient: ReturnType<typeof createWalletClient> | null = null;

export function getDealVaultServerWalletClient() {
  if (walletClient) {
    return walletClient;
  }

  const privateKey =
    process.env.DEALVAULT_BLOCKCHAIN_ADMIN_PRIVATE_KEY ||
    process.env.BLOCKCHAIN_ADMIN_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Missing DealVault admin private key.");
  }

  const chain = getDealVaultChain();
  walletClient = createWalletClient({
    account: privateKeyToAccount(privateKey as `0x${string}`),
    chain: chain.viemChain,
    transport: http(chain.rpcUrl),
  });

  return walletClient;
}

export function getDealVaultServerAccount() {
  const client = getDealVaultServerWalletClient();
  if (!client.account) {
    throw new Error("Missing DealVault server wallet account.");
  }

  return client.account;
}
