import type { NormalizedLeadInput } from '@/lib/leads/types'
import { decodeHtmlEntities, stripHtml, toTitleCase } from '@/lib/leads/utils'

type SearchWisconsinBusinessesInput = {
  query: string
  limit: number
  daysBack: number
}

type DfiResult = {
  entityId: string
  entityName: string
  entityType: string
  registeredEffectiveDate: string | null
  status: string | null
  detailsPath: string | null
}

function extractRows(html: string): DfiResult[] {
  const tableMatch = html.match(/<table id="results">([\s\S]*?)<\/table>/i)
  if (!tableMatch) return []
  const rowMatches = Array.from(tableMatch[1].matchAll(/<tr class="[^"]*"[\s\S]*?<\/tr>/gi))
  return rowMatches.map((match) => {
    const row = match[0]
    const id = row.match(/<td class="entityID">\s*([^<]+)\s*<\/td>/i)?.[1]?.trim() || ''
    const href = row.match(/<a href="([^"]+)">/)
    const entityName = decodeHtmlEntities(
      stripHtml(row.match(/<span class="name">([\s\S]*?)<\/span>/i)?.[1] || '')
    )
    const entityType = decodeHtmlEntities(
      stripHtml(row.match(/<span class="typeDescription">([\s\S]*?)<\/span>/i)?.[1] || '')
    )
    const registeredEffectiveDate =
      row.match(/<td class="registeredEffectiveDate">\s*([^<]+)\s*<\/td>/i)?.[1]?.trim() || null
    const status = decodeHtmlEntities(
      stripHtml(row.match(/<span class="statusDescription">([\s\S]*?)<\/span>/i)?.[1] || '')
    ) || null

    return {
      entityId: id,
      entityName,
      entityType,
      registeredEffectiveDate,
      status,
      detailsPath: href?.[1] ? `https://apps.dfi.wi.gov/apps/CorpSearch/${href[1]}` : null,
    }
  })
}

async function fetchDetails(url: string) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'VestBlock Lead Intelligence/1.0 (+https://www.vestblock.io)' },
  })
  const html = await response.text()
  const agentOfficeBlock = html.match(
    /<td class="label">\s*Registered Agent<br \/>\s*Office<\/td>\s*<td class="data">([\s\S]*?)<\/td>/i
  )?.[1]

  const officeText = stripHtml(agentOfficeBlock || '')
  const lines = officeText
    .split(/\s{2,}/)
    .map((value) => value.trim())
    .filter(Boolean)

  return {
    registeredAgent: lines[0] || null,
    registeredOffice: lines.slice(1).join(', ') || null,
  }
}

export async function searchWisconsinBusinesses(input: SearchWisconsinBusinessesInput) {
  const url = `https://apps.dfi.wi.gov/apps/CorpSearch/Results.aspx?type=Simple&q=${encodeURIComponent(
    input.query
  )}`
  const response = await fetch(url, {
    headers: { 'user-agent': 'VestBlock Lead Intelligence/1.0 (+https://www.vestblock.io)' },
  })

  if (!response.ok) {
    throw new Error(`Wisconsin DFI search failed with ${response.status}.`)
  }

  const html = await response.text()
  const rawResults = extractRows(html).slice(0, input.limit)
  const leads: NormalizedLeadInput[] = []

  for (const result of rawResults) {
    let details = { registeredAgent: null as string | null, registeredOffice: null as string | null }
    if (result.detailsPath) {
      try {
        details = await fetchDetails(result.detailsPath)
      } catch {
        // keep list result only
      }
    }

    leads.push({
      leadType: 'new_business_filing',
      source: 'wisconsin_dfi_new_businesses',
      sourceUrl: result.detailsPath,
      category: 'business_setup',
      externalId: result.entityId,
      name: details.registeredAgent,
      businessName: toTitleCase(result.entityName) || result.entityName,
      propertyAddress: details.registeredOffice,
      mailingAddress: details.registeredOffice,
      city: details.registeredOffice?.split(',')[1]?.trim() || 'Milwaukee',
      state: 'WI',
      painSignal: 'Recently indexed public business filing; likely needs setup, compliance, and funding readiness support',
      bestOffer: 'Business Setup / Compliance Help',
      marketSegment: 'new_business',
      outreachAngle: 'New business setup and funding readiness',
      contactInfo: {
        registeredAgent: details.registeredAgent,
      },
      formData: {
        entityId: result.entityId,
        entityType: result.entityType,
        status: result.status,
      },
      metadata: {
        registered_effective_date: result.registeredEffectiveDate,
        entityType: result.entityType,
        status: result.status,
        registeredAgent: details.registeredAgent,
        registeredOffice: details.registeredOffice,
        urbanMarket: /milwaukee|madison|green bay/i.test(details.registeredOffice || ''),
      },
    })
  }

  return leads
}
