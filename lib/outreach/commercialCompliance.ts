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
