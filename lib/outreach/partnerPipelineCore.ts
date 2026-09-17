export const PARTNER_PIPELINE_LANES = ['buyers', 'lenders', 'investors'] as const
export type PartnerPipelineLane = (typeof PARTNER_PIPELINE_LANES)[number]

export function allocatePartnerPipelineSendCap(
  totalLimit: number,
  rotationOffset = 0,
  enabledLanes: readonly PartnerPipelineLane[] = PARTNER_PIPELINE_LANES
) {
  const safeLimit = Math.max(0, Math.floor(totalLimit))
  const allocations = { buyers: 0, lenders: 0, investors: 0 }
  const lanes = PARTNER_PIPELINE_LANES.filter((lane) => enabledLanes.includes(lane))
  if (!lanes.length) return allocations
  const safeOffset = ((Math.floor(rotationOffset) % lanes.length) + lanes.length) % lanes.length
  for (let index = 0; index < safeLimit; index += 1) {
    allocations[lanes[(index + safeOffset) % lanes.length]] += 1
  }
  return allocations
}

export function partnerPipelineRotationOffset(now = new Date()) {
  const utcDay = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000
  )
  return utcDay % PARTNER_PIPELINE_LANES.length
}

const PARTNER_PIPELINE_INVOCATION_BUCKET_MS = 3 * 60 * 60 * 1000

/**
 * Advance the first partner lane for each scheduled three-hour invocation.
 * A date-only offset can starve the same third lane for an entire day because
 * the shared Outlook budget permits only two partner sends per invocation.
 */
export function partnerPipelineInvocationRotationOffset(
  dailyOffset: number,
  now = new Date()
) {
  const safeDailyOffset =
    ((Math.floor(dailyOffset) % PARTNER_PIPELINE_LANES.length) + PARTNER_PIPELINE_LANES.length) %
    PARTNER_PIPELINE_LANES.length
  const invocationBucket = Math.floor(now.getTime() / PARTNER_PIPELINE_INVOCATION_BUCKET_MS)
  return (safeDailyOffset + invocationBucket) % PARTNER_PIPELINE_LANES.length
}
