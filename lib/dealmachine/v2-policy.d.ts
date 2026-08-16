export const DEALMACHINE_PROPERTY_FIELD_ALLOWLIST: readonly string[]
export const DEALMACHINE_PROPERTY_FILTER_ALLOWLIST: readonly string[]

export type DealMachinePolicyValidation = {
  ok: boolean
  violations: string[]
}

export class DealMachinePolicyError extends Error {
  code: string
  violations: string[]
}

export function isDealMachineSourceEnabled(env?: Record<string, string | undefined>): boolean
export function isDealMachineDiscoveryEnabled(env?: Record<string, string | undefined>): boolean
export function isDealMachinePaidSearchEnabled(env?: Record<string, string | undefined>): boolean

export function validatePropertyOnlySearchBody(
  body: unknown,
  options?: { requireFields?: boolean }
): DealMachinePolicyValidation
export function assertPropertyOnlySearchBody<T>(
  body: T,
  options?: { requireFields?: boolean }
): T

export function findProhibitedPropertyPayloadPaths(payload: unknown): string[]
export function assertPropertyOnlyResponsePayload<T>(payload: T): T
export function assertPropertyCountResponsePayload<T>(payload: T): T
export function assertPropertyEstimateResponsePayload<T>(payload: T): T
export function assertPaidPropertySearchResponsePayload<T>(
  payload: T,
  options?: { maxRows?: number; maxCredits?: number; allowedFields?: readonly string[] }
): T

export function assertDealMachineDiscoveryEnabled(env?: Record<string, string | undefined>): void
export function assertDealMachinePaidSearchEnabled(env?: Record<string, string | undefined>): void
