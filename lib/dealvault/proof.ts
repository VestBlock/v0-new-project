const textEncoder = new TextEncoder();

function normalizeHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeAddressForHash(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function sha256Text(value: string): Promise<string> {
  const normalized = textEncoder.encode(value);
  const digest = await crypto.subtle.digest("SHA-256", normalized);
  return normalizeHex(digest);
}

export async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return normalizeHex(digest);
}

export async function generatePropertyHash(input: {
  propertyAddress: string;
  propertyCity?: string | null;
  propertyState?: string | null;
  propertyZip?: string | null;
}): Promise<string> {
  const raw = [
    normalizeAddressForHash(input.propertyAddress),
    normalizeAddressForHash(input.propertyCity || ""),
    normalizeAddressForHash(input.propertyState || ""),
    normalizeAddressForHash(input.propertyZip || ""),
  ].join("|");

  return sha256Text(raw);
}

export async function generateDealAnchorHash(input: {
  externalRef?: string | null;
  title: string;
  dealType: string;
  userId?: string | null;
}) {
  const raw = [
    normalizeAddressForHash(input.dealType),
    normalizeAddressForHash(input.externalRef || ""),
    normalizeAddressForHash(input.title),
    normalizeAddressForHash(input.userId || ""),
  ].join("|");

  return sha256Text(raw);
}

export async function generateDocumentHash(input: File | string): Promise<string> {
  if (typeof input === "string") {
    return sha256Text(input);
  }

  return sha256File(input);
}

export async function verifyDocumentHash(input: File | string, expectedHash: string): Promise<boolean> {
  const computedHash = await generateDocumentHash(input);
  return computedHash.toLowerCase() === expectedHash.trim().toLowerCase();
}
