export const SELLER_SMS_CONSENT_VERSION = 'seller-sms-v2-2026-09-15'

export const SELLER_SMS_CONSENT_DISCLOSURE =
  'By checking this box, I agree that Vestblock LLC may send recurring marketing and property-review text messages to the number I provided, including with automated technology. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.'

export function sellerSmsConsentEvidence(input: {
  consented: boolean
  consentedAt: string
  sourcePath: string
  phoneFingerprint: string
  phoneLast4: string
  userAgent?: string | null
  networkFingerprint?: string | null
}) {
  if (!input.consented || !/^[a-f0-9]{64}$/i.test(input.phoneFingerprint) || !/^\d{4}$/.test(input.phoneLast4)) {
    return null
  }

  return {
    status: 'granted' as const,
    brand: 'Vestblock LLC',
    purpose: 'seller_property_review_marketing',
    disclosureVersion: SELLER_SMS_CONSENT_VERSION,
    disclosureText: SELLER_SMS_CONSENT_DISCLOSURE,
    consentedAt: input.consentedAt,
    sourcePath: input.sourcePath,
    method: 'unchecked_checkbox' as const,
    phoneFingerprint: input.phoneFingerprint.toLowerCase(),
    phoneLast4: input.phoneLast4,
    userAgent: String(input.userAgent || '').slice(0, 500) || null,
    networkFingerprint: input.networkFingerprint || null,
  }
}
