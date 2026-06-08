export function normalizeText(value) {
  return String(value || '').trim()
}

export function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function hashString(input) {
  let value = 0
  const text = String(input || '')
  for (let index = 0; index < text.length; index += 1) {
    value = (value << 5) - value + text.charCodeAt(index)
    value |= 0
  }
  return Math.abs(value)
}

export function rotate(items, seed, count = items.length) {
  return [...items]
    .sort((left, right) => (hashString(`${left.city || left.id || left}-${seed}`) % 1009) - (hashString(`${right.city || right.id || right}-${seed}`) % 1009))
    .slice(0, count)
}

export function normalizeEmail(value) {
  return normalizeText(value).toLowerCase()
}

export function normalizePhone(value) {
  const digits = normalizeText(value).replace(/\D+/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

export function websiteHost(value) {
  const raw = normalizeText(value)
  if (!raw) return ''
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    return url.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

export function csvEscape(value) {
  const text = String(value ?? '')
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(rows, columns) {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n')
}

export function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount)
}

export function countBy(rows, selector) {
  const counts = new Map()
  for (const row of rows) increment(counts, selector(row) || 'unknown')
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1]))
}

export function safeJson(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

