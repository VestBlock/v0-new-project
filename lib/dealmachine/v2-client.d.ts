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

export type DealMachineDownload = { filename: string; url: string; size: number | null }
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
  exportProperties(body: Record<string, unknown>): Promise<any>
  listLists(query?: Record<string, unknown>): Promise<any>
  createList(body: Record<string, unknown>): Promise<any>
  getList(listId: string): Promise<any>
  exportList(listId: string, body?: Record<string, unknown>): Promise<any>
  listExports(query?: Record<string, unknown>): Promise<any>
  getExport(exportId: string): Promise<any>
  downloadUrls(payload: any): DealMachineDownload[]
  getRateLimit(): { limit: number | null; remaining: number | null; reset: string | null } | null
}

export function createDealMachineV2Client(options?: {
  apiKey?: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  maxRetries?: number
  minRequestIntervalMs?: number
  userAgent?: string
}): DealMachineV2Client

export function downloadDealMachineExportFile(
  download: DealMachineDownload,
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number }
): Promise<Buffer>
