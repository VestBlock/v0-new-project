function normalizeScope(scope: string) {
  const normalized = scope
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "record";
}

function normalizeRecordId(recordId: string) {
  const normalized = recordId.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "");
  return normalized || "pending";
}

export function buildDealVaultOpaqueReference(scope: string, recordId: string) {
  return `${normalizeScope(scope)}:${normalizeRecordId(recordId)}`;
}

export function buildDealVaultOpaqueLabel(scope: string, index: number) {
  return `${normalizeScope(scope)}-${index + 1}`;
}
