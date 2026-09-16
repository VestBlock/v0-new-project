export type PipelineExecutionModeInput = {
  dryRun?: boolean
  deliveryEnabled?: boolean
}

export type PipelineExecutionMode = {
  dryRun: boolean
  deliveryEnabled: boolean
  deliveryDryRun: boolean
}

/**
 * Keeps preparation work independent from provider delivery. A disabled
 * delivery switch must not turn discovery, enrichment, scoring, or drafting
 * into a preview, while an explicit dry run must keep every stage read-only.
 */
export function resolvePipelineExecutionMode(
  input: PipelineExecutionModeInput = {}
): PipelineExecutionMode {
  const dryRun = Boolean(input.dryRun)
  const deliveryEnabled = !dryRun && input.deliveryEnabled !== false

  return {
    dryRun,
    deliveryEnabled,
    deliveryDryRun: dryRun || !deliveryEnabled,
  }
}
