export const RULES = {
  residential: 0.7,
  land: 0.65,
  commercial: 0.65,
} as const

export type DealRuleType = keyof typeof RULES
export type ArvMode = 'BASELINE' | 'COMPS_AVG' | 'MANUAL'
export type DealGrade = 'RISKY' | 'GOOD'

export type DealComp = {
  salePrice: number | null
}

function rounded(value: number | null, digits = 2) {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(Number(value) * factor) / factor
}

function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function getDealRuleType(propertyType?: string | null): DealRuleType {
  const normalized = String(propertyType || '').toLowerCase()
  if (!normalized) return 'residential'
  if (/land|lot/.test(normalized)) return 'land'
  if (/commercial|industrial|retail|office/.test(normalized)) return 'commercial'
  return 'residential'
}

export function getDealRulePercent(propertyType?: string | null) {
  return RULES[getDealRuleType(propertyType)]
}

export function computeArv({
  selectedComps,
  manualArv,
  mode,
  baselineValue,
}: {
  selectedComps?: DealComp[]
  manualArv?: number | null
  mode: ArvMode
  baselineValue?: number | null
}) {
  if (mode === 'MANUAL') return rounded(manualArv ?? null, 0)
  if (mode === 'BASELINE') return rounded(baselineValue ?? null, 0)

  const compAverage = average(
    (selectedComps || [])
      .map((comp) => comp.salePrice)
      .filter((value): value is number => Number.isFinite(value))
  )

  return rounded(compAverage, 0)
}

export function computeMao({
  arv,
  rulePct,
  repairCost,
  assignmentFee,
}: {
  arv: number | null
  rulePct: number
  repairCost?: number | null
  assignmentFee?: number | null
}) {
  if (!Number.isFinite(arv) || !Number.isFinite(rulePct)) return null
  return rounded(Number(arv) * Number(rulePct) - Number(repairCost || 0) - Number(assignmentFee || 0), 0)
}

export function computeSpread({
  mao,
  sellerAsk,
}: {
  mao: number | null
  sellerAsk: number | null
}) {
  if (!Number.isFinite(mao) || !Number.isFinite(sellerAsk)) return null
  return rounded(Number(mao) - Number(sellerAsk), 0)
}

export function computeEndBuyerProfit({
  arv,
  sellerAsk,
  assignmentFee,
  repairCost,
}: {
  arv: number | null
  sellerAsk: number | null
  assignmentFee?: number | null
  repairCost?: number | null
}) {
  if (!Number.isFinite(arv) || !Number.isFinite(sellerAsk)) return null
  return rounded(
    Number(arv) -
      Number(sellerAsk) -
      Number(assignmentFee || 0) -
      Number(repairCost || 0),
    0
  )
}

export function gradeDeal({
  spread,
  riskyFloor = 0,
}: {
  spread: number | null
  riskyFloor?: number
}): DealGrade | null {
  if (!Number.isFinite(spread)) return null
  return Number(spread) < riskyFloor ? 'RISKY' : 'GOOD'
}
