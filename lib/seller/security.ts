import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function hashSellerToken(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function createSellerAccessToken() {
  return randomBytes(32).toString('base64url')
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ')
}

export function sellerDedupeKey(input: {
  propertyAddress: string
  city: string
  state: string
  userId?: string | null
  email?: string | null
}) {
  const owner = input.userId
    ? `user:${input.userId}`
    : `guest:${String(input.email || '').trim().toLowerCase()}`
  const property = [input.propertyAddress, input.city, input.state].map(normalizeAddress).join('|')
  return hashSellerToken(`${property}|${owner}`)
}

export function sellerTokenMatches(token: string | null | undefined, expectedHash: string | null | undefined) {
  if (!token || !expectedHash) return false
  const actual = Buffer.from(hashSellerToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
