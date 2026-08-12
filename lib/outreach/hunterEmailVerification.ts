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

function normalizedStatus(value: unknown): HunterEmailVerification['status'] {
  const status = String(value || '').trim().toLowerCase()
  if (['valid', 'invalid', 'accept_all', 'webmail', 'disposable', 'unknown'].includes(status)) {
    return status as HunterEmailVerification['status']
  }
  return 'unknown'
}

export async function verifyEmailWithHunter(email: string): Promise<HunterEmailVerification> {
  const apiKey = String(process.env.HUNTER_API_KEY || '').trim()
  if (!apiKey) return baseResult({})

  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(18_000),
        cache: 'no-store',
      }
    )

    if (response.status === 202) {
      return baseResult({
        configured: true,
        status: 'pending',
        reason: 'Hunter verification is still pending.',
      })
    }

    if (response.status === 451) {
      return baseResult({
        configured: true,
        status: 'blocked',
        hardInvalid: true,
        reason: 'Hunter marked this address as claimed and not eligible for processing.',
      })
    }

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = payload?.errors?.[0]?.details || payload?.errors?.[0]?.id
      return baseResult({
        configured: true,
        status: 'unknown',
        reason: detail ? `Hunter verification failed: ${detail}` : `Hunter verification failed with ${response.status}.`,
      })
    }

    const data = payload?.data || {}
    const status = normalizedStatus(data.status)
    const smtpCheck = typeof data.smtp_check === 'boolean' ? data.smtp_check : null
    const acceptAll = typeof data.accept_all === 'boolean' ? data.accept_all : null
    const score = Number.isFinite(Number(data.score)) ? Number(data.score) : null
    const hardInvalid = ['invalid', 'disposable'].includes(status)
    const approvalSafe = status === 'valid' || (status === 'webmail' && smtpCheck === true)

    return baseResult({
      configured: true,
      status,
      score,
      smtpCheck,
      acceptAll,
      approvalSafe,
      hardInvalid,
      reason: approvalSafe
        ? 'Hunter verified the address as sendable.'
        : hardInvalid
          ? `Hunter marked the address ${status}.`
          : `Hunter returned ${status}; manual review is required.`,
    })
  } catch (error) {
    return baseResult({
      configured: true,
      status: 'unknown',
      reason: error instanceof Error ? `Hunter verification failed: ${error.message}` : 'Hunter verification failed.',
    })
  }
}
