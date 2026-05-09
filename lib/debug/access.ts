import "server-only";

import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth/admin";

function diagnosticsEnabled() {
  return process.env.ENABLE_INTERNAL_DIAGNOSTICS === "true" || process.env.NODE_ENV !== "production";
}

export async function requireInternalDiagnosticsAccess() {
  const adminCheck = await checkAdminAccess();

  if (!adminCheck.isAdmin) {
    return {
      error: NextResponse.json(
        { error: "Admin access required." },
        { status: adminCheck.user ? 403 : 401 }
      ),
    };
  }

  if (!diagnosticsEnabled()) {
    return {
      error: NextResponse.json(
        { error: "Internal diagnostics are disabled." },
        { status: 404 }
      ),
    };
  }

  return { error: null };
}

export function getSafeDiagnosticErrorMessage(defaultMessage: string) {
  return process.env.NODE_ENV === "production" ? defaultMessage : undefined;
}
