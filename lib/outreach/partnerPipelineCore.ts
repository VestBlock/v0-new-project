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
