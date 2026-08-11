import 'server-only'

function normalizedHost(value: string | null) {
  return String(value || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
}

export function isTrustedMutationOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true

  let originHost = ''
  try {
    const parsed = new URL(origin)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    originHost = normalizedHost(parsed.host)
  } catch {
    return false
  }

  const requestHost = normalizedHost(
    request.headers.get('x-forwarded-host') || request.headers.get('host')
  )
  if (requestHost && originHost === requestHost) return true

  const configuredOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_ORIGIN,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ]
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [normalizedHost(new URL(String(value)).host)]
      } catch {
        return []
      }
    })

  return configuredOrigins.includes(originHost)
}
