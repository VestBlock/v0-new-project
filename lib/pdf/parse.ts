import 'server-only'

import { createRequire } from 'node:module'

type PdfParseInfo = Record<string, unknown> | null
type PdfParseMetadata = Record<string, unknown> | null

export type PdfParseResult = {
  numpages: number
  numrender: number
  info: PdfParseInfo
  metadata: PdfParseMetadata
  text: string
  version: string | null
}

export type PdfParseOptions = {
  max?: number
  version?: string
  pagerender?: (pageData: unknown) => Promise<string>
}

type PdfParseFn = (
  dataBuffer: Buffer,
  options?: PdfParseOptions
) => Promise<PdfParseResult>

const require = createRequire(import.meta.url)
const pdfParseInternal = require('pdf-parse/lib/pdf-parse.js') as PdfParseFn

export function parsePdfBuffer(dataBuffer: Buffer, options?: PdfParseOptions) {
  return pdfParseInternal(dataBuffer, options)
}
