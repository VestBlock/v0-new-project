const SCOPED_SOURCE_SEPARATOR = '__'

export function getSourceFamily(sourceKey: string | null | undefined) {
  const normalized = String(sourceKey || '').trim()
  if (!normalized) return ''
  return normalized.split(SCOPED_SOURCE_SEPARATOR)[0] || normalized
}

export function isSourceInFamily(sourceKey: string | null | undefined, family: string) {
  return getSourceFamily(sourceKey) === family
}

export function buildSourceFamilyFilters(column: string, families: string[]) {
  return families
    .filter(Boolean)
    .flatMap((family) => [`${column}.eq.${family}`, `${column}.like.${family}${SCOPED_SOURCE_SEPARATOR}%`])
    .join(',')
}
