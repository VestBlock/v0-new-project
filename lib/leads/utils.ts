export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

export function normalizePhone(value?: string | null) {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return value.trim() || null
}

export function safeUrl(value?: string | null) {
  if (!value) return null
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    if (!url.search && /%3f/i.test(url.pathname)) {
      const decodedPath = decodeURIComponent(url.pathname)
      if (decodedPath.startsWith('/?')) {
        url.pathname = '/'
        url.search = decodedPath.slice(1)
      }
    }
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^utm_/i.test(key)) {
        url.searchParams.delete(key)
      }
    }
    return url.toString()
  } catch {
    return null
  }
}

export function toTitleCase(value?: string | null) {
  if (!value) return null
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ')
}

export function daysBetween(dateLike?: string | null) {
  if (!dateLike) return null
  const parsed = Date.parse(dateLike)
  if (Number.isNaN(parsed)) return null
  return Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24))
}

export function truncate(value: string, length = 280) {
  if (value.length <= length) return value
  return `${value.slice(0, Math.max(0, length - 1)).trim()}...`
}
