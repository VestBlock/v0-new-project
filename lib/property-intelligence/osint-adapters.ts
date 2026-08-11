export type OsintAdapterName = 'spiderfoot' | 'theharvester' | 'maigret' | 'sherlock' | 'holehe' | 'phoneinfoga'

export type OsintAdapterRunRequest = {
  adapter: OsintAdapterName
  query: string
  acceptedComplianceWarning: boolean
  adminUserId?: string | null
}

export type OsintAdapterResult = {
  adapter: OsintAdapterName
  query: string
  source: string
  resultType: string
  resultValue: string
  confidenceScore: number
  rawResult?: Record<string, unknown>
}

export const OSINT_COMPLIANCE_WARNING =
  'Use public and user-provided information only. Do not scrape private data, bypass paywalls, break terms, evade captchas, infer protected-class details, or run automated research against private individuals without a documented business purpose and admin approval.'

export const osintAdapters: Record<OsintAdapterName, { label: string; manualOnlyReason: string; expectedUse: string }> = {
  spiderfoot: {
    label: 'SpiderFoot',
    manualOnlyReason: 'Broad reconnaissance can touch many sources and must be scoped by an admin.',
    expectedUse: 'Public domain, company, and infrastructure-source checks for entities.',
  },
  theharvester: {
    label: 'theHarvester',
    manualOnlyReason: 'Email/domain discovery should be limited to business entities and public web sources.',
    expectedUse: 'Business-domain contact discovery for LLCs, land banks, lenders, and partners.',
  },
  maigret: {
    label: 'Maigret',
    manualOnlyReason: 'Username checks against private people should not run automatically.',
    expectedUse: 'Manual public-profile verification when the user provides a business username.',
  },
  sherlock: {
    label: 'Sherlock',
    manualOnlyReason: 'Username checks against private people should not run automatically.',
    expectedUse: 'Manual public-profile verification when the user provides a business username.',
  },
  holehe: {
    label: 'Holehe',
    manualOnlyReason: 'Email account checks can be privacy-sensitive and require explicit approval.',
    expectedUse: 'Manual validation of user-approved business emails only.',
  },
  phoneinfoga: {
    label: 'PhoneInfoga',
    manualOnlyReason: 'Phone enrichment can be privacy-sensitive and requires admin review.',
    expectedUse: 'Manual review of public phone metadata for business or filing contacts.',
  },
}

export async function runOsintAdapter(_request: OsintAdapterRunRequest): Promise<OsintAdapterResult[]> {
  throw new Error('OSINT adapters are manual-gated stubs in Phase 1. Enable a reviewed runner per adapter in Phase 3.')
}
