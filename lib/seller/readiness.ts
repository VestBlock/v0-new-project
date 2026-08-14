import type { SellerCaseInput } from '@/lib/seller/schemas'

export function assessSellerCompleteness(input: SellerCaseInput & { email: string }) {
  const checks = [
    ['seller name', input.sellerName],
    ['email address', /^\S+@\S+\.\S+$/.test(input.email)],
    ['phone number', input.phone],
    ['property address', input.propertyAddress],
    ['city', input.city],
    ['state', input.state],
    ['property type', input.propertyType],
    ['property condition', input.propertyCondition],
    ['occupancy', input.occupancyStatus],
    ['sale timeline', input.timelineToSell],
    ['seller objective', input.reasonForSelling],
    ['analysis permission', input.analysisConsent],
    ['contact permission', input.contactConsent],
  ] as const
  const gaps = checks.filter(([, value]) => !value).map(([label]) => label)
  return {
    score: Math.round(((checks.length - gaps.length) / checks.length) * 100),
    gaps,
    complete: gaps.length === 0,
  }
}
