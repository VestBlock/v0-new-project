import type { NormalizedPropertyInput } from '@/lib/property-intelligence/types'

export function normalizePropertyAddressKey(input: Pick<NormalizedPropertyInput, 'propertyAddress' | 'city' | 'state' | 'zipCode'>) {
  return [input.propertyAddress, input.city, input.state, input.zipCode]
    .map((part) => String(part || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
    .filter(Boolean)
    .join('|')
}
