export const DEFAULT_AUTH_RETURN_PATH = '/dashboard/services'

export const MEMBER_ROLE_OPTIONS = [
  { value: 'business_owner', label: 'Build or grow a business' },
  { value: 'capital_seeker', label: 'Find business or real estate capital' },
  { value: 'real_estate_buyer', label: 'Buy or invest in real estate' },
  { value: 'property_seller', label: 'Sell a property or bring a deal' },
  { value: 'investor', label: 'Deploy capital or evaluate opportunities' },
  { value: 'lender', label: 'Provide financing' },
  { value: 'developer_operator', label: 'Develop, operate, or improve property' },
  { value: 'service_provider', label: 'Offer professional services' },
] as const

export type MemberRole = (typeof MEMBER_ROLE_OPTIONS)[number]['value']

const MEMBER_ROLE_VALUES = new Set<string>(
  MEMBER_ROLE_OPTIONS.map((option) => option.value)
)

const AUTH_LOOP_PATHS = new Set([
  '/auth/callback',
  '/forgot-password',
  '/join',
  '/login',
  '/register',
])

export function normalizeMemberRoles(value: unknown): MemberRole[] {
  if (!Array.isArray(value)) return []

  return [...new Set(value)]
    .filter(
      (role): role is MemberRole =>
        typeof role === 'string' && MEMBER_ROLE_VALUES.has(role)
    )
    .slice(0, MEMBER_ROLE_OPTIONS.length)
}

export function normalizeAuthIntent(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized) ? normalized : null
}

export function getSafeAuthReturnPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AUTH_RETURN_PATH
) {
  const safeFallback =
    fallback.startsWith('/') && !fallback.startsWith('//') ? fallback : '/'

  if (!value) return safeFallback

  const candidate = value.trim()
  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return safeFallback
  }

  try {
    const parsed = new URL(candidate, 'https://vestblock.local')
    if (parsed.origin !== 'https://vestblock.local') return safeFallback
    if (AUTH_LOOP_PATHS.has(parsed.pathname)) return safeFallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return safeFallback
  }
}

export function buildAuthPath(
  pathname: '/forgot-password' | '/join' | '/login',
  options: {
    next?: string | null
    email?: string | null
    intent?: string | null
    roles?: readonly string[] | null
  } = {}
) {
  const params = new URLSearchParams()
  const next = getSafeAuthReturnPath(options.next)
  const intent = normalizeAuthIntent(options.intent)
  const roles = normalizeMemberRoles(options.roles)

  if (next !== DEFAULT_AUTH_RETURN_PATH) params.set('next', next)
  if (options.email?.trim()) params.set('email', options.email.trim())
  if (intent) params.set('intent', intent)
  if (roles.length > 0) params.set('roles', roles.join(','))

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
