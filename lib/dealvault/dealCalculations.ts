import type { DealVaultSplitDraft } from "@/lib/dealvault/types";

export function calculateTotalBps(splits: Array<Pick<DealVaultSplitDraft, "bps">>): number {
  return splits.reduce((sum, split) => sum + split.bps, 0);
}

export function splitsExceedLimit(splits: Array<Pick<DealVaultSplitDraft, "bps">>): boolean {
  return calculateTotalBps(splits) > 10000;
}

export function calculateSplitAmount(totalAmount: number, bps: number): number {
  return Number(((totalAmount * bps) / 10000).toFixed(2));
}

export function calculateSplitAmounts(
  totalAmount: number,
  splits: Array<Pick<DealVaultSplitDraft, "bps">>
): number[] {
  return splits.map((split) => calculateSplitAmount(totalAmount, split.bps));
}

