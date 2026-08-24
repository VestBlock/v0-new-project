import { timingSafeEqual } from 'node:crypto'

export function isTrustedN8nSecret(provided: string | null | undefined, expected: string | null | undefined) {
  const actual = Buffer.from(String(provided || '').trim())
  const target = Buffer.from(String(expected || '').trim())
  return Boolean(actual.length && target.length && actual.length === target.length && timingSafeEqual(actual, target))
}
