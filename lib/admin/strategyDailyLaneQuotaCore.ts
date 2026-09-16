function nonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

export function strategyLaneDraftLimit(input: {
  target: number
  existing: number
  perRunLimit: number
}) {
  const target = nonNegativeInteger(input.target)
  const existing = nonNegativeInteger(input.existing)
  const perRunLimit = nonNegativeInteger(input.perRunLimit)
  return Math.min(perRunLimit, Math.max(0, target - existing))
}

export function advanceStrategyLaneDraftCount(existing: number, drafted: number) {
  return nonNegativeInteger(existing) + nonNegativeInteger(drafted)
}
