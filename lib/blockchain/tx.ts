import "server-only";
import { getDealVaultPublicClient } from "@/lib/blockchain/client";
import { getDealVaultServerWalletClient } from "@/lib/blockchain/serverWallet";

type DealVaultWriteRequest = Parameters<ReturnType<typeof getDealVaultServerWalletClient>["writeContract"]>[0];

let pendingWriteQueue: Promise<unknown> = Promise.resolve();
let nextReservedNonce: number | null = null;

async function reserveDealVaultNonce() {
  const publicClient = getDealVaultPublicClient();
  const walletClient = getDealVaultServerWalletClient();
  const account = walletClient.account;

  if (!account) {
    throw new Error("Missing DealVault wallet account.");
  }

  const onChainPendingNonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });

  if (nextReservedNonce === null || onChainPendingNonce > nextReservedNonce) {
    nextReservedNonce = onChainPendingNonce;
  }

  const reservedNonce = nextReservedNonce;
  nextReservedNonce += 1;
  return reservedNonce;
}

async function executeDealVaultWrite(request: DealVaultWriteRequest) {
  const publicClient = getDealVaultPublicClient();
  const walletClient = getDealVaultServerWalletClient();
  const nonce = await reserveDealVaultNonce();
  const txHash = await walletClient.writeContract({
    ...request,
    nonce,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });

  return { txHash, receipt };
}

export async function submitDealVaultWrite(request: DealVaultWriteRequest) {
  const queuedWrite = pendingWriteQueue.then(() => executeDealVaultWrite(request));
  pendingWriteQueue = queuedWrite.then(
    () => undefined,
    () => undefined
  );

  return queuedWrite;
}
