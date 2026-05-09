export function isDealVaultEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEALVAULT === "true";
}

export function assertDealVaultEnabled() {
  if (!isDealVaultEnabled()) {
    throw new Error("DealVault is not enabled.");
  }
}

