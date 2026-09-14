export const PARTNER_PIPELINE_LANES = ['buyers', 'lenders', 'investors'] as const

export function allocatePartnerPipelineSendCap(totalLimit: number) {
  const safeLimit = Math.max(0, Math.floor(totalLimit))
  const allocations = { buyers: 0, lenders: 0, investors: 0 }
  for (let index = 0; index < safeLimit; index += 1) {
    allocations[PARTNER_PIPELINE_LANES[index % PARTNER_PIPELINE_LANES.length]] += 1
  }
  return allocations
}
