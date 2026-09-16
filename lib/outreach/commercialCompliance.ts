export function getCommercialOutreachMailingAddress(
  env: Record<string, string | undefined> = process.env
) {
  return String(
    env.OUTREACH_MAILING_ADDRESS ||
      env.BUSINESS_MAILING_ADDRESS ||
      env.COMPANY_MAILING_ADDRESS ||
      env.PUBLIC_BUSINESS_ADDRESS ||
      ''
  ).trim()
}

export function buildCommercialOutreachBody(input: {
  body: string
  complianceNote?: string | null
  mailingAddress: string
}) {
  const body = String(input.body || '').trim()
  const mailingAddress = String(input.mailingAddress || '').trim()
  if (!mailingAddress) {
    throw new Error('Commercial outreach mailing address is required.')
  }
  const complianceNote = String(
    input.complianceNote || 'If this is not relevant, reply and we will not contact you again.'
  ).trim()
  const mailingLine = `VestBlock mailing address: ${mailingAddress}`
  const normalizedBody = body.toLowerCase()
  const additions = [complianceNote, mailingLine].filter(
    (part) => part && !normalizedBody.includes(part.toLowerCase())
  )
  return [body, ...additions].filter(Boolean).join('\n\n')
}

function decodeComparableHtml(value: string) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_match, digits: string) => {
      const codePoint = Number.parseInt(digits, 10)
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : ' '
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, digits: string) => {
      const codePoint = Number.parseInt(digits, 16)
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : ' '
    })
    .replace(/&(nbsp|amp|quot|apos|lt|gt);/gi, (_match, entity: string) => ({
      nbsp: ' ',
      amp: '&',
      quot: '"',
      apos: "'",
      lt: '<',
      gt: '>',
    })[entity.toLowerCase()] || ' ')
}

function comparableCommercialText(value: string) {
  return decodeComparableHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export type CommercialOutreachContentAssessment = {
  compliant: boolean
  missingOptOut: boolean
  missingMailingAddress: boolean
  mailingAddressConfigured: boolean
}

/**
 * Verifies the content the recipient will actually see. Merely configuring an
 * address in the environment is insufficient: marketing and cold email must
 * render both a clear opt-out instruction and that configured address.
 */
export function assessCommercialOutreachContent(input: {
  html: string
  mailingAddress: string
}): CommercialOutreachContentAssessment {
  const rendered = comparableCommercialText(input.html)
  const mailingAddress = comparableCommercialText(input.mailingAddress)
  const mailingAddressConfigured = Boolean(mailingAddress)
  const missingMailingAddress = !mailingAddressConfigured || !rendered.includes(mailingAddress)
  const hasOptOut = [
    /\bunsubscribe\b/,
    /\bopt out\b/,
    /\bdo not contact\b/,
    /\bdo not email\b/,
    /\bdon t contact\b/,
    /\bdon t email\b/,
    /\bremove me\b/,
    /\bstop emailing\b/,
  ].some((pattern) => pattern.test(rendered)) || (
    /\bnot relevant\b/.test(rendered) &&
    /\breply\b/.test(rendered) &&
    /\b(?:not|won t) contact\b/.test(rendered)
  )
  return {
    compliant: hasOptOut && !missingMailingAddress,
    missingOptOut: !hasOptOut,
    missingMailingAddress,
    mailingAddressConfigured,
  }
}
