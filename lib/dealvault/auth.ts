import "server-only";
import { getServerUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DealVaultAuthedUser {
  id: string;
  email: string | null;
  profileId: string | null;
  role: string | null;
}

export async function getDealVaultUser(): Promise<DealVaultAuthedUser | null> {
  const user = await getServerUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id,user_id,email,role")
    .or(`id.eq.${user.id},user_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    profileId: profile?.id ?? user.id,
    role: profile?.role ?? null,
  };
}

