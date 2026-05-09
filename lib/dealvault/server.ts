import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDealVaultUser } from "@/lib/dealvault/auth";
import { isDealVaultEnabled } from "@/lib/dealvault/featureFlag";

export async function requireDealVaultUser() {
  if (!isDealVaultEnabled()) {
    return {
      error: NextResponse.json({ error: "DealVault is not enabled." }, { status: 503 }),
      user: null,
    };
  }

  const user = await getDealVaultUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
      user: null,
    };
  }

  return { error: null, user };
}

export function getDealVaultAdmin() {
  return createAdminClient();
}

export function isDealVaultAdmin(role?: string | null) {
  return role === "admin";
}

export function isDealVaultBlockchainConfigured() {
  return Boolean(
    (process.env.DEALVAULT_BLOCKCHAIN_RPC_URL || process.env.BLOCKCHAIN_RPC_URL) &&
      (process.env.DEALVAULT_BLOCKCHAIN_ADMIN_PRIVATE_KEY ||
        process.env.BLOCKCHAIN_ADMIN_PRIVATE_KEY)
  );
}
