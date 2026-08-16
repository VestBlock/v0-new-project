export {
  DealMachinePolicyError,
  assertDealMachineDiscoveryEnabled,
  assertDealMachinePaidSearchEnabled,
  assertPaidPropertySearchResponsePayload,
  assertPropertyCountResponsePayload,
  assertPropertyEstimateResponsePayload,
  assertPropertyOnlyResponsePayload,
  assertPropertyOnlySearchBody,
  findProhibitedPropertyPayloadPaths,
  isDealMachineDiscoveryEnabled,
  isDealMachinePaidSearchEnabled,
  isDealMachineSourceEnabled,
  validatePropertyOnlySearchBody,
} from './v2-policy.mjs'

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

export type DealMachineResponseMetadata = {
  status: number
  requestId: string | null
  rateLimit: DealMachineRateLimit
  receivedAt: string
}

export type DealMachineConnectionHealth = {
  configured: boolean
  enabled: boolean
  discoveryEnabled: boolean
  paidSearchEnabled: boolean
  checkedAt: string
  state: DealMachineConnectionState
  message: string
  requestId: string | null
  rateLimit: DealMachineRateLimit | null
}

export type DealMachinePropertySearchBody = {
  locations: Array<{ type: string; code: string }>
  filters: Array<{ filter_id: string; operator?: string; value: unknown }>
  fields?: string[]
  anchor: 'properties'
  contact_audience: 'none'
  page?: number
  per_page?: number
  sort?: unknown
  estimate_cost?: true
}

export type DealMachineV2Client = {
  account(): Promise<any>
  subscription(): Promise<any>
  usage(): Promise<any>
  listFilters(sourceType?: 'properties'): Promise<any[]>
  listFields(sourceType?: 'properties'): Promise<any[]>
  searchLocations(query: Record<string, unknown>): Promise<any>
  resolveCity(city: string, state: string): Promise<any>
  countProperties(body: DealMachinePropertySearchBody): Promise<any>
  estimatePropertySearch(body: DealMachinePropertySearchBody): Promise<any>
  getRateLimit(): DealMachineRateLimit | null
  getLastResponseMetadata(): DealMachineResponseMetadata | null
}

export type DealMachinePaidSearchClient = {
  searchProperties(body: DealMachinePropertySearchBody): Promise<any>
  getRateLimit(): DealMachineRateLimit | null
  getLastResponseMetadata(): DealMachineResponseMetadata | null
}

export type DealMachineClientOptions = {
  apiKey?: string
  env?: Record<string, string | undefined>
  baseUrl?: string
  fetchImpl?: typeof fetch
  maxRetries?: number
  minRequestIntervalMs?: number
  userAgent?: string
}

export function createDealMachineV2Client(options?: DealMachineClientOptions): DealMachineV2Client
export const createDealMachineV2DiscoveryClient: typeof createDealMachineV2Client
export function createDealMachineV2PaidSearchClient(options?: DealMachineClientOptions): DealMachinePaidSearchClient

export function getDealMachineConnectionHealth(options?: {
  apiKey?: string
  env?: Record<string, string | undefined>
  verify?: boolean
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<DealMachineConnectionHealth>
