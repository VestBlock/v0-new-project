import { createHmac } from 'node:crypto';

function secretOrThrow(explicitSecret?: string) {
  const secret = explicitSecret || process.env.CRM_IDENTITY_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('CRM identity hashing requires CRM_IDENTITY_HASH_SECRET with at least 32 characters.');
  }
  return secret;
}

export function normalizeEmail(value: string | null | undefined) {
  const normalized = String(value || '').normalize('NFKC').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function normalizePhone(value: string | null | undefined, defaultCountryCode = '1') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  const normalized = digits.length === 10 ? `${defaultCountryCode}${digits}` : digits;
  return normalized.length >= 11 && normalized.length <= 15 ? `+${normalized}` : null;
}

export function crmIdentityKey(input: {
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  source?: string | null;
  secret?: string;
}) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const external = String(input.externalId || '').trim();
  const source = String(input.source || 'vestblock').trim().toLowerCase();
  const identity = email
    ? `email:${email}`
    : phone
      ? `phone:${phone}`
      : external
        ? `external:${source}:${external}`
        : null;

  if (!identity) throw new Error('A normalized email, phone, or source external ID is required.');
  return createHmac('sha256', secretOrThrow(input.secret)).update(identity).digest('hex');
}

export function crmIdempotencyKey(namespace: string, parts: Array<string | number | null | undefined>, secret?: string) {
  const canonical = [namespace.trim().toLowerCase(), ...parts.map((part) => String(part ?? '').trim())].join('|');
  return createHmac('sha256', secretOrThrow(secret)).update(canonical).digest('hex');
}
