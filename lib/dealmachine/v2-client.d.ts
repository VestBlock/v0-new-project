export const DEALMACHINE_V2_BASE_URL: string

export class DealMachineApiError extends Error {
  status: number | null
  code: string | null
  requestId: string | null
  retryable: boolean
  details: unknown
}

export function dealMachineApiKey(env?: Record<string, string | undefined>): string
export function isDealMachineCredentialFormat(value: unknown): boolean
export function hasDealMachineCredentials(env?: Record<string, string | undefined>): boolean
export function isDealMachineSourceEnabled(env?: Record<string, string | undefined>): boolean

export type DealMachineConnectionState =
  | 'not_configured'
  | 'configured_unverified'
  | 'working'
  | 'rate_limited'
  | 'unauthorized'
  | 'provider_unavailable'

export type DealMachineRateLimit = {
  limit: number | null
  remaining: number | null
  reset: string | null
  dayLimit: number | null
  dayRemaining: number | null
  retryAfterSeconds: number | null
}

export type DealMachineConnectionHealth = {
  configured: boolean
  enabled: boolean
  checkedAt: string
  state: DealMachineConnectionState
  message: string
  requestId: string | null
  rateLimit: DealMachineRateLimit | null
}

export type DealMachineV2Client = {
  request(path: string, options?: Record<string, unknown>): Promise<any>
  account(): Promise<any>
  usage(): Promise<any>
  listFilters(sourceType: 'properties' | 'people'): Promise<any[]>
  listFields(sourceType: 'properties' | 'people'): Promise<any[]>
  searchLocations(query: Record<string, unknown>): Promise<any>
  resolveCity(city: string, state: string): Promise<any>
  countProperties(body: Record<string, unknown>): Promise<any>
  searchProperties(body: Record<string, unknown>): Promise<any>
  estimatePropertySearch(body: Record<string, unknown>): Promise<any>
  listLists(query?: Record<string, unknown>): Promise<any>
  createList(body: Record<string, unknown>): Promise<any>
  getList(listId: string): Promise<any>
  getRateLimit(): DealMachineRateLimit | null
}

export function createDealMachineV2Client(options?: {
  apiKey?: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  maxRetries?: number
  minRequestIntervalMs?: number
  userAgent?: string
}): DealMachineV2Client

export function getDealMachineConnectionHealth(options?: {
  apiKey?: string
  env?: Record<string, string | undefined>
  verify?: boolean
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<DealMachineConnectionHealth>
