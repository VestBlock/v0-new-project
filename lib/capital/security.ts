import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function hashCapitalToken(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function createCapitalAccessToken() {
  return randomBytes(32).toString('base64url')
}

export function capitalDedupeKey(input: {
  caseType: string
  userId?: string | null
  email?: string | null
}) {
  const owner = input.userId
    ? `user:${input.userId}`
    : `guest:${String(input.email || '').trim().toLowerCase()}`
  return hashCapitalToken(`${input.caseType}|${owner}`)
}

export function capitalTokenMatches(token: string | null | undefined, expectedHash: string | null | undefined) {
  if (!token || !expectedHash) return false
  const actual = Buffer.from(hashCapitalToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
