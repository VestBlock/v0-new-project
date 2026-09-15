import 'server-only'

export type HunterEmailVerification = {
  configured: boolean
  status: 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'disposable' | 'unknown' | 'pending' | 'blocked' | 'unverified'
  score: number | null
  smtpCheck: boolean | null
  acceptAll: boolean | null
  approvalSafe: boolean
  hardInvalid: boolean
  reason: string
}
function baseResult(overrides: Partial<HunterEmailVerification>): HunterEmailVerification {
  return {
    configured: false,
    status: 'unverified',
    score: null,
    smtpCheck: null,
    acceptAll: null,
    approvalSafe: false,
    hardInvalid: false,
    reason: 'Hunter email verification is not configured.',
    ...overrides,
  }
}

export async function verifyEmailWithHunter(_email: string): Promise<HunterEmailVerification> {
  return baseResult({
    status: 'blocked',
    reason:
      'unbudgeted_hunter_verification_quarantined: use the shared Hunter send-verification path, which reserves capacity before every provider request.',
  })
}
